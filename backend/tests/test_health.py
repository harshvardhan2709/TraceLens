import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import patch
from app.main import app


@pytest.mark.anyio
async def test_service_health_endpoint():
    """Verify GET /api/health returns 200 and healthy status."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "TraceLens AI"
    assert "version" in data
    assert "environment" in data


@pytest.mark.anyio
async def test_db_health_endpoint_healthy():
    """Verify GET /api/health/db returns 200 when database connection succeeds."""
    with patch("app.api.routes.health.check_db_connection", return_value=(True, "Connection OK")):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/health/db")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["connected"] is True
        assert data["database"] == "postgresql"
        assert data["details"] == "Connection OK"


@pytest.mark.anyio
async def test_db_health_endpoint_unhealthy():
    """Verify GET /api/health/db returns 503 when database is unavailable."""
    with patch("app.api.routes.health.check_db_connection", return_value=(False, "Connection refused")):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/health/db")

        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["connected"] is False
        assert data["database"] == "postgresql"
        assert "Connection refused" in data["details"]
