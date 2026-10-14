from fastapi import APIRouter, Response, status
from app.core.config import get_settings
from app.db.session import check_db_connection
from app.schemas.health import HealthResponse, DatabaseHealthResponse

router = APIRouter(prefix="", tags=["Health"])
settings = get_settings()


@router.get("/health", response_model=HealthResponse, summary="Service Health Check")
def get_service_health() -> HealthResponse:
    """Return basic health status of the FastAPI service."""
    return HealthResponse(
        status="healthy",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )


@router.get(
    "/health/db",
    response_model=DatabaseHealthResponse,
    summary="Database Connectivity Check",
    responses={
        200: {"description": "Database is reachable"},
        503: {"description": "Database connection failed or unreachable"},
    },
)
def get_db_health(response: Response) -> DatabaseHealthResponse:
    """Check PostgreSQL database connectivity."""
    connected, details = check_db_connection()
    if not connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return DatabaseHealthResponse(
            status="unhealthy",
            database="postgresql",
            connected=False,
            details=details,
        )

    return DatabaseHealthResponse(
        status="healthy",
        database="postgresql",
        connected=True,
        details=details,
    )
