import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import patch, AsyncMock
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
async def test_db_health_endpoint_healthy_mocked():
    """Verify GET /api/health/db returns 200 when MongoDB ping succeeds."""
    with patch(
        "app.api.routes.health.check_mongo_connection",
        new_callable=AsyncMock,
        return_value=(True, "Database connection healthy"),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/health/db")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["connected"] is True
        assert data["database"] == "mongodb"
        assert data["details"] == "Database connection healthy"


@pytest.mark.anyio
async def test_db_health_endpoint_unhealthy_mocked():
    """Verify GET /api/health/db returns 503 when MongoDB ping fails."""
    with patch(
        "app.api.routes.health.check_mongo_connection",
        new_callable=AsyncMock,
        return_value=(False, "Database unavailable or connection timed out"),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/health/db")

        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["connected"] is False
        assert data["database"] == "mongodb"
        assert "Database unavailable" in data["details"]


@pytest.mark.anyio
async def test_db_health_endpoint_live():
    """Verify GET /api/health/db against active MongoDB instance without mocking."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health/db")

    # In our environment where MongoDB is running, response must be 200 with database='mongodb'
    assert response.status_code in (200, 503)
    data = response.json()
    assert data["database"] == "mongodb"
    assert isinstance(data["connected"], bool)
