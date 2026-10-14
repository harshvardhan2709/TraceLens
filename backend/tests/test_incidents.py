import pytest
import uuid
from datetime import datetime, timezone
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.db.mongo import get_incidents_collection, get_log_events_collection


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_create_and_get_incident(client: AsyncClient):
    """Test successful incident creation and subsequent retrieval."""
    test_title = f"Test Incident {uuid.uuid4().hex[:8]}"
    create_res = await client.post(
        "/api/incidents",
        json={"title": test_title, "description": "Automated test description"},
    )
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["title"] == test_title
    assert created_data["status"] == "open"
    assert "id" in created_data
    assert created_data["log_count"] == 0
    incident_id = created_data["id"]

    # Retrieve by ID
    get_res = await client.get(f"/api/incidents/{incident_id}")
    assert get_res.status_code == 200
    fetched_data = get_res.json()
    assert fetched_data["id"] == incident_id
    assert fetched_data["title"] == test_title


@pytest.mark.anyio
async def test_get_nonexistent_incident(client: AsyncClient):
    """Test that requesting a missing incident returns 404."""
    random_id = str(uuid.uuid4())
    res = await client.get(f"/api/incidents/{random_id}")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


@pytest.mark.anyio
async def test_list_incidents_pagination(client: AsyncClient):
    """Test listing incidents with skip and limit."""
    # Ensure at least two incidents exist
    await client.post("/api/incidents", json={"title": f"Incident A {uuid.uuid4().hex[:6]}"})
    await client.post("/api/incidents", json={"title": f"Incident B {uuid.uuid4().hex[:6]}"})

    res = await client.get("/api/incidents?skip=0&limit=2")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) <= 2
    assert data["skip"] == 0
    assert data["limit"] == 2


@pytest.mark.anyio
async def test_log_ingestion_and_retrieval(client: AsyncClient):
    """Test batch log ingestion and subsequent correlated retrieval."""
    # 1. Create parent incident
    inc_res = await client.post("/api/incidents", json={"title": f"Log Test Incident {uuid.uuid4().hex[:6]}"})
    assert inc_res.status_code == 201
    incident_id = inc_res.json()["id"]

    # 2. Ingest 3 logs
    now = datetime.now(timezone.utc).isoformat()
    logs_payload = {
        "logs": [
            {
                "timestamp": now,
                "severity": "INFO",
                "message": "Service boot started",
                "service_name": "auth-service",
            },
            {
                "timestamp": now,
                "severity": "warning",  # tests case-insensitive normalization
                "message": "High memory consumption detected",
                "request_id": "req-1234",
                "source_metadata": {"cpu_pct": 87.5},
            },
            {
                "timestamp": now,
                "severity": "ERROR",
                "message": "Database connection pool exhausted",
                "request_id": "req-1234",
            },
        ]
    }

    ingest_res = await client.post(f"/api/incidents/{incident_id}/logs", json=logs_payload)
    assert ingest_res.status_code == 201
    ingest_data = ingest_res.json()
    assert ingest_data["ingested_count"] == 3
    assert ingest_data["incident_id"] == incident_id

    # 3. Retrieve logs
    get_logs_res = await client.get(f"/api/incidents/{incident_id}/logs")
    assert get_logs_res.status_code == 200
    logs_data = get_logs_res.json()
    assert logs_data["total"] == 3
    assert len(logs_data["items"]) == 3

    # Check normalization
    severities = [log["severity"] for log in logs_data["items"]]
    assert "WARNING" in severities
    assert "ERROR" in severities
    assert "INFO" in severities

    # 4. Verify incident log_count updated
    inc_check = await client.get(f"/api/incidents/{incident_id}")
    assert inc_check.json()["log_count"] == 3


@pytest.mark.anyio
async def test_log_ingestion_invalid_severity(client: AsyncClient):
    """Test that invalid severity values are rejected with 422."""
    inc_res = await client.post("/api/incidents", json={"title": "Severity Test"})
    incident_id = inc_res.json()["id"]

    invalid_payload = {
        "logs": [
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "severity": "FATAL_PANIC",  # Not in allowed list
                "message": "Unknown severity test",
            }
        ]
    }

    res = await client.post(f"/api/incidents/{incident_id}/logs", json=invalid_payload)
    assert res.status_code == 422
    error_text = str(res.json())
    assert "Invalid severity" in error_text


@pytest.mark.anyio
async def test_log_ingestion_malformed_timestamp(client: AsyncClient):
    """Test that malformed timestamps are rejected with 422."""
    inc_res = await client.post("/api/incidents", json={"title": "Timestamp Test"})
    incident_id = inc_res.json()["id"]

    malformed_payload = {
        "logs": [
            {
                "timestamp": "this-is-not-a-timestamp",
                "severity": "ERROR",
                "message": "Timestamp error test",
            }
        ]
    }

    res = await client.post(f"/api/incidents/{incident_id}/logs", json=malformed_payload)
    assert res.status_code == 422


@pytest.mark.anyio
async def test_log_ingestion_missing_incident(client: AsyncClient):
    """Test that ingesting logs for a nonexistent incident returns 404."""
    random_id = str(uuid.uuid4())
    payload = {
        "logs": [
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "severity": "ERROR",
                "message": "Orphan log test",
            }
        ]
    }
    res = await client.post(f"/api/incidents/{random_id}/logs", json=payload)
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


@pytest.mark.anyio
async def test_empty_incident_logs(client: AsyncClient):
    """Test that an incident with no logs returns an empty list."""
    inc_res = await client.post("/api/incidents", json={"title": "Empty Incident"})
    incident_id = inc_res.json()["id"]

    res = await client.get(f"/api/incidents/{incident_id}/logs")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.anyio
async def test_logs_filtering_and_pagination(client: AsyncClient):
    """Test filtering logs by severity and request ID with pagination."""
    inc_res = await client.post("/api/incidents", json={"title": "Filter Test"})
    incident_id = inc_res.json()["id"]

    now = datetime.now(timezone.utc).isoformat()
    logs = [
        {"timestamp": now, "severity": "DEBUG", "message": "msg 1", "request_id": "r1"},
        {"timestamp": now, "severity": "INFO", "message": "msg 2", "request_id": "r1"},
        {"timestamp": now, "severity": "ERROR", "message": "msg 3", "request_id": "r2"},
        {"timestamp": now, "severity": "ERROR", "message": "msg 4", "request_id": "r2"},
    ]
    await client.post(f"/api/incidents/{incident_id}/logs", json={"logs": logs})

    # Filter by severity
    res_err = await client.get(f"/api/incidents/{incident_id}/logs?severity=ERROR")
    assert res_err.status_code == 200
    assert res_err.json()["total"] == 2

    # Filter by request_id
    res_req = await client.get(f"/api/incidents/{incident_id}/logs?request_id=r1")
    assert res_req.status_code == 200
    assert res_req.json()["total"] == 2

    # Pagination: limit=1, skip=1
    res_page = await client.get(f"/api/incidents/{incident_id}/logs?limit=1&skip=1")
    assert res_page.status_code == 200
    page_data = res_page.json()
    assert page_data["total"] == 4
    assert len(page_data["items"]) == 1
