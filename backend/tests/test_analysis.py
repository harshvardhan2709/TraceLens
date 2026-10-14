import pytest
import uuid
from datetime import datetime, timedelta, timezone
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_empty_incident_analysis(client: AsyncClient):
    """Test analyzing an incident with 0 ingested logs."""
    # 1. Create incident
    inc_res = await client.post(
        "/api/incidents",
        json={"title": f"Empty Incident {uuid.uuid4().hex[:6]}"},
    )
    assert inc_res.status_code == 201
    inc_id = inc_res.json()["id"]

    # 2. Run analysis
    res = await client.post(f"/api/incidents/{inc_id}/analyze")
    assert res.status_code == 200
    data = res.json()

    assert data["incident_id"] == inc_id
    assert data["total_logs"] == 0
    assert data["severity_distribution"]["total"] == 0
    assert data["time_window"]["duration_seconds"] == 0.0
    assert len(data["findings"]) == 0
    assert len(data["error_groups"]) == 0
    assert len(data["request_correlations"]) == 0
    assert "No log telemetry events" in data["summary"]

    # 3. Verify GET /analysis retrieves equivalent data
    get_res = await client.get(f"/api/incidents/{inc_id}/analysis")
    assert get_res.status_code == 200
    assert get_res.json()["incident_id"] == inc_id


@pytest.mark.anyio
async def test_nonexistent_incident_analysis_returns_404(client: AsyncClient):
    """Test that analyzing or fetching analysis for a missing incident returns 404."""
    fake_id = str(uuid.uuid4())
    post_res = await client.post(f"/api/incidents/{fake_id}/analyze")
    assert post_res.status_code == 404
    assert "not found" in post_res.json()["detail"].lower()

    get_res = await client.get(f"/api/incidents/{fake_id}/analysis")
    assert get_res.status_code == 404
    assert "not found" in get_res.json()["detail"].lower()


@pytest.mark.anyio
async def test_repeated_errors_grouping_and_evidence(client: AsyncClient):
    """Test deterministic grouping of repeated error signatures with valid evidence IDs."""
    inc_res = await client.post(
        "/api/incidents",
        json={"title": f"Repeated Error Test {uuid.uuid4().hex[:6]}"},
    )
    inc_id = inc_res.json()["id"]

    base_time = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)
    # Ingest 3 repeated errors with variable UUIDs that should be normalized together
    logs_payload = {
        "logs": [
            {
                "timestamp": (base_time + timedelta(seconds=1)).isoformat(),
                "severity": "ERROR",
                "message": "Connection refused to auth-db at 10.0.0.5:5432 for session 4a8b9c1d-1111-2222-3333-444455556666",
                "service_name": "gateway",
                "request_id": "req-1",
            },
            {
                "timestamp": (base_time + timedelta(seconds=5)).isoformat(),
                "severity": "ERROR",
                "message": "Connection refused to auth-db at 10.0.0.5:5432 for session 9f8e7d6c-5555-6666-7777-888899990000",
                "service_name": "gateway",
                "request_id": "req-2",
            },
            {
                "timestamp": (base_time + timedelta(seconds=10)).isoformat(),
                "severity": "ERROR",
                "message": "Connection refused to auth-db at 10.0.0.5:5432 for session 11223344-aabb-ccdd-eeff-001122334455",
                "service_name": "gateway",
                "request_id": "req-3",
            },
        ]
    }
    ingest_res = await client.post(f"/api/incidents/{inc_id}/logs", json=logs_payload)
    assert ingest_res.status_code == 201

    # Fetch stored log IDs from logs endpoint to verify evidence references
    logs_get = await client.get(f"/api/incidents/{inc_id}/logs")
    stored_ids = {item["id"] for item in logs_get.json()["items"]}
    assert len(stored_ids) == 3

    # Analyze
    analysis_res = await client.post(f"/api/incidents/{inc_id}/analyze")
    assert analysis_res.status_code == 200
    data = analysis_res.json()

    assert data["total_logs"] == 3
    assert len(data["error_groups"]) == 1
    group = data["error_groups"][0]
    assert group["count"] == 3
    assert "<UUID>" in group["signature"]
    assert "Connection refused to auth-db" in group["signature"]
    assert set(group["evidence_log_ids"]) == stored_ids

    # Check repeated error finding
    repeated_findings = [f for f in data["findings"] if f["rule_id"] == "RULE_REPEATED_ERROR"]
    assert len(repeated_findings) == 1
    rf = repeated_findings[0]
    assert rf["finding_type"] == "repeated_error"
    assert set(rf["evidence_log_ids"]) == stored_ids
    assert rf["metadata"]["count"] == 3


@pytest.mark.anyio
async def test_similar_messages_not_incorrectly_merged(client: AsyncClient):
    """
    Ensure normalization preserves meaningful differences such that distinct errors
    (e.g., UserNotFound vs OrderNotFound, or different endpoints) are NOT merged.
    """
    inc_res = await client.post(
        "/api/incidents",
        json={"title": f"Normalization Safety Test {uuid.uuid4().hex[:6]}"},
    )
    inc_id = inc_res.json()["id"]

    base_time = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)
    logs_payload = {
        "logs": [
            {
                "timestamp": (base_time + timedelta(seconds=1)).isoformat(),
                "severity": "ERROR",
                "message": "ResourceNotFoundException: Entity 'User' with id 12345 was not located",
                "service_name": "user-service",
            },
            {
                "timestamp": (base_time + timedelta(seconds=2)).isoformat(),
                "severity": "ERROR",
                "message": "ResourceNotFoundException: Entity 'Order' with id 67890 was not located",
                "service_name": "order-service",
            },
        ]
    }
    await client.post(f"/api/incidents/{inc_id}/logs", json=logs_payload)

    res = await client.post(f"/api/incidents/{inc_id}/analyze")
    data = res.json()

    # Must produce 2 separate error groups, not merge them
    assert len(data["error_groups"]) == 2
    signatures = [g["signature"] for g in data["error_groups"]]
    assert any("User" in s for s in signatures)
    assert any("Order" in s for s in signatures)


@pytest.mark.anyio
async def test_multiple_request_ids_and_warning_before_error(client: AsyncClient):
    """
    Test request correlation across multiple request IDs, identifying the request
    where an early warning preceded an error event.
    """
    inc_res = await client.post(
        "/api/incidents",
        json={"title": f"Request Cascade Test {uuid.uuid4().hex[:6]}"},
    )
    inc_id = inc_res.json()["id"]

    base_time = datetime(2026, 10, 14, 12, 0, 0, tzinfo=timezone.utc)
    logs_payload = {
        "logs": [
            # Request A: Successful trace
            {
                "timestamp": (base_time + timedelta(seconds=1)).isoformat(),
                "severity": "INFO",
                "message": "Authenticating user",
                "request_id": "req-alpha",
                "service_name": "auth",
            },
            {
                "timestamp": (base_time + timedelta(seconds=2)).isoformat(),
                "severity": "INFO",
                "message": "User authenticated successfully",
                "request_id": "req-alpha",
                "service_name": "auth",
            },
            # Request B: Warning preceding error cascade
            {
                "timestamp": (base_time + timedelta(seconds=3)).isoformat(),
                "severity": "INFO",
                "message": "Checkout initiated",
                "request_id": "req-beta",
                "service_name": "checkout",
            },
            {
                "timestamp": (base_time + timedelta(seconds=4)).isoformat(),
                "severity": "WARNING",
                "message": "Payment provider latency high: 4500ms",
                "request_id": "req-beta",
                "service_name": "payment",
            },
            {
                "timestamp": (base_time + timedelta(seconds=5)).isoformat(),
                "severity": "ERROR",
                "message": "Payment gateway timeout after 5000ms",
                "request_id": "req-beta",
                "service_name": "payment",
            },
        ]
    }
    await client.post(f"/api/incidents/{inc_id}/logs", json=logs_payload)

    res = await client.post(f"/api/incidents/{inc_id}/analyze")
    data = res.json()

    correlations = {rc["request_id"]: rc for rc in data["request_correlations"]}
    assert "req-alpha" in correlations
    assert "req-beta" in correlations

    # req-alpha has no errors
    assert correlations["req-alpha"]["has_error"] is False
    assert correlations["req-alpha"]["warning_preceded_error"] is False

    # req-beta experienced degradation
    assert correlations["req-beta"]["has_error"] is True
    assert correlations["req-beta"]["has_warning"] is True
    assert correlations["req-beta"]["warning_preceded_error"] is True
    assert "checkout" in correlations["req-beta"]["service_names"]
    assert "payment" in correlations["req-beta"]["service_names"]

    # RULE_REQUEST_WARNING_BEFORE_ERROR finding generated
    cascade_findings = [f for f in data["findings"] if f["rule_id"] == "RULE_REQUEST_WARNING_BEFORE_ERROR"]
    assert len(cascade_findings) == 1
    assert cascade_findings[0]["metadata"]["request_id"] == "req-beta"


@pytest.mark.anyio
async def test_out_of_order_timestamps_and_error_burst(client: AsyncClient):
    """
    Test that logs ingested in reverse or out-of-order timestamps are reconstructed
    chronologically and trigger RULE_ERROR_BURST for dense clusters within 30s.
    """
    inc_res = await client.post(
        "/api/incidents",
        json={"title": f"Burst Test {uuid.uuid4().hex[:6]}"},
    )
    inc_id = inc_res.json()["id"]

    base_time = datetime(2026, 10, 14, 14, 0, 0, tzinfo=timezone.utc)
    # 4 errors inserted out-of-order, spanning 15 seconds total
    logs_payload = {
        "logs": [
            {
                "timestamp": (base_time + timedelta(seconds=15)).isoformat(),
                "severity": "ERROR",
                "message": "Downstream socket closed #4",
            },
            {
                "timestamp": (base_time + timedelta(seconds=10)).isoformat(),
                "severity": "ERROR",
                "message": "Downstream socket closed #3",
            },
            {
                "timestamp": (base_time + timedelta(seconds=0)).isoformat(),
                "severity": "ERROR",
                "message": "Downstream socket closed #1",
            },
            {
                "timestamp": (base_time + timedelta(seconds=5)).isoformat(),
                "severity": "ERROR",
                "message": "Downstream socket closed #2",
            },
        ]
    }
    await client.post(f"/api/incidents/{inc_id}/logs", json=logs_payload)

    res = await client.post(f"/api/incidents/{inc_id}/analyze")
    data = res.json()

    # Timeline reconstruction verified: duration should be 15s
    assert data["time_window"]["duration_seconds"] == 15.0
    assert "14:00:00" in data["time_window"]["first_event_at"]
    assert "14:00:15" in data["time_window"]["last_event_at"]

    # Error burst detected
    burst_findings = [f for f in data["findings"] if f["rule_id"] == "RULE_ERROR_BURST"]
    assert len(burst_findings) == 1
    assert burst_findings[0]["metadata"]["error_count"] == 4
    assert burst_findings[0]["metadata"]["duration_seconds"] == 15.0


@pytest.mark.anyio
async def test_analysis_idempotency(client: AsyncClient):
    """Test that repeated analysis calls on unchanged logs yield identical results."""
    inc_res = await client.post(
        "/api/incidents",
        json={"title": f"Idempotency Test {uuid.uuid4().hex[:6]}"},
    )
    inc_id = inc_res.json()["id"]

    base_time = datetime(2026, 10, 14, 15, 0, 0, tzinfo=timezone.utc)
    logs_payload = {
        "logs": [
            {
                "timestamp": base_time.isoformat(),
                "severity": "WARNING",
                "message": "Disk usage 85%",
                "request_id": "req-idem",
            },
            {
                "timestamp": (base_time + timedelta(seconds=2)).isoformat(),
                "severity": "ERROR",
                "message": "Out of disk space write failure",
                "request_id": "req-idem",
            },
        ]
    }
    await client.post(f"/api/incidents/{inc_id}/logs", json=logs_payload)

    run_1 = (await client.post(f"/api/incidents/{inc_id}/analyze")).json()
    run_2 = (await client.post(f"/api/incidents/{inc_id}/analyze")).json()
    run_3 = (await client.get(f"/api/incidents/{inc_id}/analysis")).json()

    # Findings, groups, correlations, and counts must be strictly identical
    assert len(run_1["findings"]) == len(run_2["findings"]) == len(run_3["findings"])
    assert run_1["summary"] == run_2["summary"] == run_3["summary"]
    assert run_1["severity_distribution"] == run_2["severity_distribution"] == run_3["severity_distribution"]
    assert len(run_1["error_groups"]) == len(run_2["error_groups"]) == len(run_3["error_groups"])
    assert len(run_1["request_correlations"]) == len(run_2["request_correlations"]) == len(run_3["request_correlations"])
