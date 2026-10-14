from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.schemas.incident import IncidentCreate, IncidentResponse, IncidentListResponse
from app.schemas.log_event import (
    LogBatchCreate,
    LogIngestionResponse,
    LogEventListResponse,
)
from app.services.incident_service import (
    create_incident,
    get_incident_by_id,
    list_incidents,
)
from app.services.log_service import (
    ingest_logs_for_incident,
    get_logs_for_incident,
)

router = APIRouter(prefix="/incidents", tags=["Incidents & Logs"])


@router.post(
    "",
    response_model=IncidentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new incident",
)
async def post_incident(payload: IncidentCreate) -> IncidentResponse:
    """Create a new failure incident record."""
    created = await create_incident(payload)
    return IncidentResponse.model_validate(created)


@router.get(
    "",
    response_model=IncidentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all incidents",
)
async def get_all_incidents(
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(50, ge=1, le=100, description="Page limit (max 100)"),
) -> IncidentListResponse:
    """List recorded incidents ordered by latest creation date."""
    items, total = await list_incidents(skip=skip, limit=limit)
    return IncidentListResponse(
        items=[IncidentResponse.model_validate(item) for item in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{incident_id}",
    response_model=IncidentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get incident details",
)
async def get_single_incident(incident_id: str) -> IncidentResponse:
    """Fetch an incident by its unique UUID."""
    incident = await get_incident_by_id(incident_id)
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found",
        )
    return IncidentResponse.model_validate(incident)


@router.post(
    "/{incident_id}/logs",
    response_model=LogIngestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest structured logs for an incident",
)
async def post_incident_logs(
    incident_id: str,
    payload: LogBatchCreate,
) -> LogIngestionResponse:
    """Ingest a batch of validated, structured application log events for an incident."""
    count = await ingest_logs_for_incident(incident_id, payload)
    return LogIngestionResponse(
        incident_id=incident_id,
        ingested_count=count,
        message=f"Successfully ingested {count} log event(s)",
    )


@router.get(
    "/{incident_id}/logs",
    response_model=LogEventListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get correlated logs for an incident",
)
async def get_incident_logs(
    incident_id: str,
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(50, ge=1, le=100, description="Page limit (max 100)"),
    severity: Optional[str] = Query(None, description="Filter by severity level"),
    request_id: Optional[str] = Query(None, description="Filter by request ID"),
    sort: str = Query("desc", pattern="^(asc|desc)$", description="Sort order by timestamp (asc or desc)"),
) -> LogEventListResponse:
    """Retrieve correlated logs for a specific incident with deterministic pagination and optional filters."""
    items, total = await get_logs_for_incident(
        incident_id=incident_id,
        skip=skip,
        limit=limit,
        severity=severity,
        request_id=request_id,
        sort_order=sort,
    )
    return LogEventListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )
