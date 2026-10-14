import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.llm_provider import BaseLLMProvider, LLMProviderError
from app.services.investigation_service import investigate_incident


@pytest.mark.anyio
async def test_e2e_complete_workflow():
    """
    Test Phase 5 Complete End-to-End Workflow:
    1. Create an incident.
    2. Ingest structured logs.
    3. Retrieve incident and logs.
    4. Run deterministic analysis.
    5. Run AI investigation.
    6. Verify evidence navigation consistency.
    7. Retrieve persisted results.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Step 1: Create incident
        create_res = await client.post(
            "/api/incidents",
            json={
                "title": "Phase 5 Audit - Payment Timeout Incident",
                "description": "Order service database pool starvation during checkout",
                "status": "open",
            },
        )
        assert create_res.status_code == 201
        incident = create_res.json()
        incident_id = incident["id"]
        assert incident["title"] == "Phase 5 Audit - Payment Timeout Incident"
        assert incident["status"] == "open"

        # Step 2: Ingest batch of structured logs
        req_id = f"audit-req-{uuid.uuid4().hex[:6]}"
        now = datetime.now(timezone.utc)
        logs_batch = [
            {
                "timestamp": (now - timedelta(seconds=15)).isoformat(),
                "severity": "INFO",
                "message": "Received checkout payload for user 8941",
                "service_name": "gateway-service",
                "request_id": req_id,
            },
            {
                "timestamp": (now - timedelta(seconds=10)).isoformat(),
                "severity": "WARNING",
                "message": "Connection pool usage above 90% (36/40 sockets active)",
                "service_name": "order-service",
                "request_id": req_id,
                "source_metadata": {"pool_saturation": 0.90},
            },
            {
                "timestamp": (now - timedelta(seconds=5)).isoformat(),
                "severity": "ERROR",
                "message": "ConnectionPoolTimeout: Unable to acquire connection within 5000ms",
                "service_name": "order-service",
                "request_id": req_id,
                "source_metadata": {"exception_type": "ConnectionPoolTimeout", "error_code": "ETIMEDOUT"},
            },
            {
                "timestamp": now.isoformat(),
                "severity": "ERROR",
                "message": "ConnectionPoolTimeout: Unable to acquire connection within 5000ms",
                "service_name": "order-service",
                "request_id": req_id,
                "source_metadata": {"exception_type": "ConnectionPoolTimeout", "error_code": "ETIMEDOUT"},
            },
        ]

        ingest_res = await client.post(
            f"/api/incidents/{incident_id}/logs",
            json={"logs": logs_batch},
        )
        assert ingest_res.status_code == 201
        assert ingest_res.json()["ingested_count"] == 4

        # Step 3: Retrieve incident and logs
        get_inc_res = await client.get(f"/api/incidents/{incident_id}")
        assert get_inc_res.status_code == 200
        assert get_inc_res.json()["log_count"] == 4

        get_logs_res = await client.get(f"/api/incidents/{incident_id}/logs?limit=10&sort=desc")
        assert get_logs_res.status_code == 200
        logs_data = get_logs_res.json()
        assert logs_data["total"] == 4
        assert len(logs_data["items"]) == 4
        # Verify descending order (most recent first)
        assert logs_data["items"][0]["timestamp"] >= logs_data["items"][-1]["timestamp"]
        all_stored_log_ids = {l["id"] for l in logs_data["items"]}

        # Step 4: Run deterministic analysis
        analyze_res = await client.post(f"/api/incidents/{incident_id}/analyze")
        assert analyze_res.status_code == 200
        analysis = analyze_res.json()
        assert analysis["incident_id"] == incident_id
        assert analysis["total_logs"] == 4
        assert analysis["severity_distribution"]["error"] == 2
        assert analysis["severity_distribution"]["warning"] == 1
        assert len(analysis["findings"]) >= 1

        # Check that all evidence IDs in findings exist in stored logs
        for finding in analysis["findings"]:
            for eid in finding["evidence_log_ids"]:
                assert eid in all_stored_log_ids

        # Step 5: Run AI investigation
        investigate_res = await client.post(
            f"/api/incidents/{incident_id}/investigate?provider=rule_synthesizer"
        )
        assert investigate_res.status_code == 200
        investigation = investigate_res.json()
        assert investigation["incident_id"] == incident_id
        assert len(investigation["ranked_hypotheses"]) >= 1

        # Step 6: Verify evidence validation & reference rate
        for hypo in investigation["ranked_hypotheses"]:
            assert hypo["status"] in ("plausible", "unverified", "requires_more_telemetry")
            assert hypo["status"] != "confirmed"
            # Every supporting evidence ID MUST be in the actual stored logs
            for eid in hypo["supporting_evidence_ids"]:
                assert eid in all_stored_log_ids
            # No invalid evidence IDs should have leaked into supporting
            assert len(hypo["invalid_evidence_ids"]) == 0

        # Step 7: Retrieve persisted results (idempotent GET)
        cached_analysis_res = await client.get(f"/api/incidents/{incident_id}/analysis")
        assert cached_analysis_res.status_code == 200
        assert cached_analysis_res.json()["summary"] == analysis["summary"]

        cached_invest_res = await client.get(f"/api/incidents/{incident_id}/investigation")
        assert cached_invest_res.status_code == 200
        assert cached_invest_res.json()["incident_summary"] == investigation["incident_summary"]


@pytest.mark.anyio
async def test_empty_incident_handling():
    """Verify workflow handling of incidents with 0 logs."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create empty incident
        create_res = await client.post(
            "/api/incidents",
            json={"title": "Empty Incident Audit", "status": "open"},
        )
        assert create_res.status_code == 201
        empty_id = create_res.json()["id"]

        # Deterministic analysis on empty incident
        analyze_res = await client.post(f"/api/incidents/{empty_id}/analyze")
        assert analyze_res.status_code == 200
        analysis = analyze_res.json()
        assert analysis["total_logs"] == 0
        assert len(analysis["findings"]) == 0
        assert "No log telemetry events" in analysis["summary"]

        # AI investigation on empty incident
        invest_res = await client.post(f"/api/incidents/{empty_id}/investigate")
        assert invest_res.status_code == 200
        investigation = invest_res.json()
        assert len(investigation["ranked_hypotheses"]) == 0
        assert investigation["total_evidence_referenced"] == 0
        assert "No log telemetry events" in investigation["incident_summary"]


@pytest.mark.anyio
async def test_invalid_input_and_error_handling():
    """Verify 404s, invalid payloads, and constraints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 404 for non-existent incident
        non_existent = str(uuid.uuid4())
        res = await client.get(f"/api/incidents/{non_existent}")
        assert res.status_code == 404

        res_logs = await client.get(f"/api/incidents/{non_existent}/logs")
        assert res_logs.status_code == 404

        res_analyze = await client.post(f"/api/incidents/{non_existent}/analyze")
        assert res_analyze.status_code == 404

        res_investigate = await client.post(f"/api/incidents/{non_existent}/investigate")
        assert res_investigate.status_code == 404

        # Validation error for empty title
        bad_create = await client.post("/api/incidents", json={"title": "   "})
        assert bad_create.status_code == 422


@pytest.mark.anyio
async def test_provider_failure_and_fallback():
    """Verify provider timeout / network failure gracefully falls back to local synthesis."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create incident with an error log
        inc_res = await client.post(
            "/api/incidents",
            json={"title": "Provider Failure Test Incident"},
        )
        inc_id = inc_res.json()["id"]

        await client.post(
            f"/api/incidents/{inc_id}/logs",
            json={
                "logs": [
                    {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "severity": "ERROR",
                        "message": "Gateway 504 Timeout",
                        "service_name": "api-gateway",
                    }
                ]
            },
        )

        # Mock a failing provider
        class FailingProvider(BaseLLMProvider):
            def get_provider_name(self) -> str:
                return "failing_mock"

            def get_model_name(self) -> str:
                return "mock_v1"

            async def generate_investigation(self, prompt, system_instruction, context_data=None):
                raise LLMProviderError("Simulated upstream provider timeout / rate limit")

        # Run investigation with failing provider injected
        result = await investigate_incident(inc_id, custom_provider=FailingProvider())
        assert result.incident_id == inc_id
        # Should have fallen back to rule_synthesizer
        assert result.provider == "rule_synthesizer"
        assert len(result.ranked_hypotheses) >= 1
        # Uncertainty should contain the fallback note
        assert any("Primary AI provider encountered an error" in u for u in result.uncertainty_and_limitations)


@pytest.mark.anyio
async def test_diagnostic_evaluation_known_and_ambiguous_causes():
    """
    Diagnostic Evaluation Suite:
    Tests synthetic incidents with known failure modes and measures:
    - Valid evidence reference rate
    - Unsupported evidence reference rate (must be 0%)
    - Top-ranked hypothesis accuracy
    - Behavior on ambiguous / insufficient logs
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        now = datetime.now(timezone.utc)

        # -------------------------------------------------------------
        # Case A: Known Cause - Database Connection Pool Exhaustion
        # -------------------------------------------------------------
        inc_a = (await client.post("/api/incidents", json={"title": "DB Pool Exhaustion"})).json()
        logs_a = [
            {
                "timestamp": (now - timedelta(seconds=20)).isoformat(),
                "severity": "WARNING",
                "message": "Connection pool usage above 95%: 38/40 connections active",
                "service_name": "order-service",
                "request_id": "req-pool-1",
            },
            {
                "timestamp": (now - timedelta(seconds=10)).isoformat(),
                "severity": "ERROR",
                "message": "TimeoutError: Pool exhausted, failed to acquire connection after 5000ms",
                "service_name": "order-service",
                "request_id": "req-pool-1",
                "source_metadata": {"exception_type": "TimeoutError"},
            },
        ]
        await client.post(f"/api/incidents/{inc_a['id']}/logs", json={"logs": logs_a})
        invest_a = (await client.post(f"/api/incidents/{inc_a['id']}/investigate?provider=rule_synthesizer")).json()

        hypo_a = invest_a["ranked_hypotheses"]
        assert len(hypo_a) >= 1
        top_a = hypo_a[0]
        # Verify top ranked hypothesis accurately identifies connection pool / timeout
        assert any(term in top_a["title"].lower() for term in ["connection", "pool", "timeout", "starvation"])
        # Verify evidence reference validity
        assert len(top_a["supporting_evidence_ids"]) > 0
        assert len(top_a["invalid_evidence_ids"]) == 0

        # -------------------------------------------------------------
        # Case B: Known Cause - Downstream Rate Limiting / 429 Cascade
        # -------------------------------------------------------------
        inc_b = (await client.post("/api/incidents", json={"title": "Rate Limit 429 Cascade"})).json()
        logs_b = [
            {
                "timestamp": (now - timedelta(seconds=15)).isoformat(),
                "severity": "WARNING",
                "message": "Rate limit quota warning: 490/500 requests used in 1m window",
                "service_name": "payment-service",
                "request_id": "req-rate-1",
            },
            {
                "timestamp": (now - timedelta(seconds=8)).isoformat(),
                "severity": "ERROR",
                "message": "HTTP 429 Too Many Requests: Rate limit exceeded for upstream API",
                "service_name": "payment-service",
                "request_id": "req-rate-1",
                "source_metadata": {"error_code": "RATE_LIMIT_EXCEEDED"},
            },
            {
                "timestamp": now.isoformat(),
                "severity": "ERROR",
                "message": "HTTP 429 Too Many Requests: Rate limit exceeded for upstream API",
                "service_name": "payment-service",
                "request_id": "req-rate-1",
                "source_metadata": {"error_code": "RATE_LIMIT_EXCEEDED"},
            },
        ]
        await client.post(f"/api/incidents/{inc_b['id']}/logs", json={"logs": logs_b})
        invest_b = (await client.post(f"/api/incidents/{inc_b['id']}/investigate?provider=rule_synthesizer")).json()

        hypo_b = invest_b["ranked_hypotheses"]
        assert len(hypo_b) >= 1
        top_b = hypo_b[0]
        assert any(term in top_b["title"].lower() for term in ["rate", "limit", "429", "upstream", "capacity"])
        assert len(top_b["supporting_evidence_ids"]) > 0
        assert len(top_b["invalid_evidence_ids"]) == 0

        # -------------------------------------------------------------
        # Case C: Ambiguous / Insufficient Telemetry (Only INFO logs)
        # -------------------------------------------------------------
        inc_c = (await client.post("/api/incidents", json={"title": "Ambiguous Routine Logs"})).json()
        logs_c = [
            {
                "timestamp": (now - timedelta(seconds=10)).isoformat(),
                "severity": "INFO",
                "message": "Healthcheck probe successful",
                "service_name": "auth-service",
            },
            {
                "timestamp": now.isoformat(),
                "severity": "INFO",
                "message": "Cache sync completed in 12ms",
                "service_name": "auth-service",
            },
        ]
        await client.post(f"/api/incidents/{inc_c['id']}/logs", json={"logs": logs_c})
        invest_c = (await client.post(f"/api/incidents/{inc_c['id']}/investigate?provider=rule_synthesizer")).json()

        # In insufficient telemetry with 0 errors, the engine should state unverified / requires more telemetry
        assert len(invest_c["ranked_hypotheses"]) >= 1
        top_c = invest_c["ranked_hypotheses"][0]
        assert top_c["status"] in ("unverified", "requires_more_telemetry", "plausible")
        assert any("telemetry" in u.lower() or "limit" in u.lower() or "error" in u.lower() for u in invest_c["uncertainty_and_limitations"])
