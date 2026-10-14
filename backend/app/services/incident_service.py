import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from pymongo import DESCENDING
from app.db.mongo import get_incidents_collection, get_log_events_collection
from app.schemas.incident import IncidentCreate, IncidentStatus

logger = logging.getLogger("tracelens.services.incidents")


async def create_incident(payload: IncidentCreate) -> dict:
    """Create a new incident document in the incidents collection."""
    incidents_col = get_incidents_collection()
    now = datetime.now(timezone.utc)
    incident_id = str(uuid.uuid4())

    status_val = payload.status.value if isinstance(payload.status, IncidentStatus) else payload.status

    doc = {
        "id": incident_id,
        "title": payload.title,
        "description": payload.description,
        "status": status_val,
        "created_at": now,
        "updated_at": now,
    }

    await incidents_col.insert_one(doc)
    doc.pop("_id", None)
    doc["log_count"] = 0
    logger.info("Created incident %s: %s", incident_id, payload.title)
    return doc


async def get_incident_by_id(incident_id: str) -> Optional[dict]:
    """Retrieve an incident by UUID string, including its correlated log count."""
    incidents_col = get_incidents_collection()
    doc = await incidents_col.find_one({"id": incident_id})
    if not doc:
        return None

    doc.pop("_id", None)
    log_col = get_log_events_collection()
    doc["log_count"] = await log_col.count_documents({"incident_id": incident_id})
    return doc


async def list_incidents(skip: int = 0, limit: int = 50) -> Tuple[List[dict], int]:
    """List incidents ordered by creation time with pagination."""
    incidents_col = get_incidents_collection()
    log_col = get_log_events_collection()

    total = await incidents_col.count_documents({})
    cursor = incidents_col.find({}).sort("created_at", DESCENDING).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)

    for item in items:
        item.pop("_id", None)
        item["log_count"] = await log_col.count_documents({"incident_id": item["id"]})

    return items, total
