import asyncio
import logging
from typing import Optional, Tuple
from pymongo import AsyncMongoClient, ASCENDING, DESCENDING
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.asynchronous.collection import AsyncCollection
from pymongo.errors import PyMongoError
from app.core.config import get_settings

logger = logging.getLogger("tracelens.db")

# Global async client reference, initialized only during app lifespan
_mongo_client: Optional[AsyncMongoClient] = None

# Collection constants
COLLECTION_INCIDENTS = "incidents"
COLLECTION_LOG_EVENTS = "log_events"
COLLECTION_ANALYSES = "analyses"


def get_client() -> AsyncMongoClient:
    """Return an AsyncMongoClient instance bound to the current running event loop."""
    global _mongo_client
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _mongo_client is None or (_mongo_client._loop is not None and current_loop is not None and _mongo_client._loop != current_loop):
        settings = get_settings()
        _mongo_client = AsyncMongoClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=settings.MONGODB_TIMEOUT_MS,
            connectTimeoutMS=settings.MONGODB_TIMEOUT_MS,
        )
    return _mongo_client


def get_database() -> AsyncDatabase:
    """Return the application's AsyncDatabase instance."""
    settings = get_settings()
    client = get_client()
    return client[settings.MONGODB_DATABASE]


def get_incidents_collection() -> AsyncCollection:
    """Return collection for incident metadata and lifecycle status."""
    return get_database()[COLLECTION_INCIDENTS]


def get_log_events_collection() -> AsyncCollection:
    """Return collection for individual searchable log event documents."""
    return get_database()[COLLECTION_LOG_EVENTS]


def get_analyses_collection() -> AsyncCollection:
    """Return collection for deterministic incident analysis reports."""
    return get_database()[COLLECTION_ANALYSES]


async def init_db_client() -> AsyncMongoClient:
    """Initialize AsyncMongoClient on application startup."""
    global _mongo_client
    settings = get_settings()
    if _mongo_client is None:
        logger.info("Initializing AsyncMongoClient...")
        _mongo_client = AsyncMongoClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=settings.MONGODB_TIMEOUT_MS,
            connectTimeoutMS=settings.MONGODB_TIMEOUT_MS,
        )
    return _mongo_client


async def close_db_client() -> None:
    """Gracefully close AsyncMongoClient on application shutdown."""
    global _mongo_client
    if _mongo_client is not None:
        logger.info("Closing AsyncMongoClient connection...")
        await _mongo_client.close()
        _mongo_client = None


async def check_mongo_connection(client_override: Optional[AsyncMongoClient] = None) -> Tuple[bool, str]:
    """
    Safely ping the MongoDB server using admin ping command.
    Returns (is_connected: bool, message: str) without exposing credentials.
    """
    settings = get_settings()
    client = client_override or _mongo_client
    temp_client = False

    # If client not initialized in lifespan yet, create a temporary probe client
    if client is None:
        client = AsyncMongoClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=settings.MONGODB_TIMEOUT_MS,
            connectTimeoutMS=settings.MONGODB_TIMEOUT_MS,
        )
        temp_client = True

    try:
        response = await client.admin.command("ping")
        if response.get("ok") == 1.0:
            return True, "Database connection healthy"
        return False, "Database ping failed"
    except PyMongoError:
        logger.warning("MongoDB ping failed")
        return False, "Database unavailable or connection timed out"
    except Exception:
        logger.error("Unexpected error checking MongoDB connectivity")
        return False, "Database check failed"
    finally:
        if temp_client:
            await client.close()


async def ensure_indexes() -> None:
    """
    Ensure required indexes exist on collections when the database is available.
    - incidents: status (asc), created_at (desc)
    - log_events: incident_id (asc), timestamp (desc), severity (asc), request_id (sparse)
    """
    try:
        incidents = get_incidents_collection()
        log_events = get_log_events_collection()

        await incidents.create_index([("id", ASCENDING)], name="idx_incident_id_unique", unique=True)
        await incidents.create_index([("status", ASCENDING)], name="idx_incident_status")
        await incidents.create_index([("created_at", DESCENDING)], name="idx_incident_created_at")

        await log_events.create_index([("id", ASCENDING)], name="idx_log_event_id_unique", unique=True)
        await log_events.create_index([("incident_id", ASCENDING)], name="idx_log_incident_id")
        await log_events.create_index([("timestamp", DESCENDING)], name="idx_log_timestamp")
        await log_events.create_index(
            [("incident_id", ASCENDING), ("timestamp", DESCENDING)],
            name="idx_log_incident_timestamp",
        )
        await log_events.create_index([("severity", ASCENDING)], name="idx_log_severity")
        await log_events.create_index([("request_id", ASCENDING)], name="idx_log_request_id", sparse=True)

        analyses = get_analyses_collection()
        await analyses.create_index([("incident_id", ASCENDING)], name="idx_analysis_incident_id", unique=True)
        await analyses.create_index([("analyzed_at", DESCENDING)], name="idx_analysis_analyzed_at")
        logger.info("MongoDB indexes verified successfully.")
    except Exception as exc:
        logger.warning("Could not verify MongoDB indexes: %s", exc)
