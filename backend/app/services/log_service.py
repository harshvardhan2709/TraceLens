import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from pymongo import ASCENDING, DESCENDING
from app.db.mongo import get_incidents_collection, get_log_events_collection
from app.schemas.log_event import LogBatchCreate

logger = logging.getLogger("tracelens.services.logs")


async def ingest_logs_for_incident(incident_id: str, batch: LogBatchCreate) -> int:
    """
    Ingest a batch of log records for an existing incident.
    Validates parent incident existence and performs transactional batch insert.
    """
    incidents_col = get_incidents_collection()
    incident = await incidents_col.find_one({"id": incident_id})
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found",
        )

    log_col = get_log_events_collection()
    now = datetime.now(timezone.utc)
    docs = []

    for event in batch.logs:
        docs.append(
            {
                "id": str(uuid.uuid4()),
                "incident_id": incident_id,
                "timestamp": event.timestamp,
                "severity": event.severity,
                "message": event.message,
                "request_id": event.request_id,
                "service_name": event.service_name,
                "source_metadata": event.source_metadata,
                "created_at": now,
            }
        )

    if docs:
        await log_col.insert_many(docs, ordered=True)
        # Touch incident updated_at
        await incidents_col.update_one(
            {"id": incident_id},
            {"$set": {"updated_at": now}},
        )

    logger.info("Ingested %d log events for incident %s", len(docs), incident_id)
    return len(docs)


async def get_logs_for_incident(
    incident_id: str,
    skip: int = 0,
    limit: int = 50,
    severity: Optional[str] = None,
    request_id: Optional[str] = None,
    sort_order: str = "desc",
) -> Tuple[List[dict], int]:
    """
    Retrieve paginated log records scoped to an incident with deterministic sorting.
    """
    incidents_col = get_incidents_collection()
    incident = await incidents_col.find_one({"id": incident_id})
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found",
        )

    query_filter: dict = {"incident_id": incident_id}

    if severity:
        query_filter["severity"] = severity.strip().upper()

    if request_id:
        query_filter["request_id"] = request_id.strip()

    sort_direction = DESCENDING if sort_order.lower() == "desc" else ASCENDING
    log_col = get_log_events_collection()

    total = await log_col.count_documents(query_filter)
    cursor = (
        log_col.find(query_filter)
        .sort([("timestamp", sort_direction), ("id", sort_direction)])
        .skip(skip)
        .limit(limit)
    )

    items = await cursor.to_list(length=limit)
    for item in items:
        item.pop("_id", None)

    return items, total
