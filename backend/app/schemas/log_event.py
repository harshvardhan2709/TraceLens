from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict
from app.core.config import get_settings

ALLOWED_SEVERITIES = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}


class LogSeverity(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class LogEventCreate(BaseModel):
    timestamp: datetime = Field(..., description="UTC-aware timestamp of the log event")
    severity: str = Field(..., description="Log severity level: DEBUG, INFO, WARNING, ERROR, CRITICAL")
    message: str = Field(..., min_length=1, max_length=10000, description="Original log message text")
    request_id: Optional[str] = Field(None, max_length=100, description="Correlated HTTP/gRPC request ID")
    service_name: Optional[str] = Field(None, max_length=100, description="Originating service or component name")
    source_metadata: Optional[Dict[str, Any]] = Field(None, description="Arbitrary structured metadata or headers")

    @field_validator("severity")
    @classmethod
    def validate_and_normalize_severity(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("Severity must be a string")
        normalized = v.strip().upper()
        if normalized not in ALLOWED_SEVERITIES:
            raise ValueError(
                f"Invalid severity '{v}'. Allowed values: {', '.join(sorted(ALLOWED_SEVERITIES))}"
            )
        return normalized

    @field_validator("timestamp")
    @classmethod
    def ensure_utc_timestamp(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            # Assume UTC for naive timestamps
            return v.replace(tzinfo=timezone.utc)
        return v.astimezone(timezone.utc)


class LogBatchCreate(BaseModel):
    logs: List[LogEventCreate] = Field(..., min_length=1, description="List of log events to ingest")

    @field_validator("logs")
    @classmethod
    def check_batch_size(cls, v: List[LogEventCreate]) -> List[LogEventCreate]:
        settings = get_settings()
        if len(v) > settings.MAX_LOG_BATCH_SIZE:
            raise ValueError(
                f"Batch size of {len(v)} exceeds the maximum allowable limit of {settings.MAX_LOG_BATCH_SIZE} logs per request"
            )
        return v


class LogEventResponse(BaseModel):
    id: str = Field(..., description="Unique log event UUID")
    incident_id: str = Field(..., description="Associated incident UUID")
    timestamp: datetime = Field(..., description="UTC event timestamp")
    severity: str = Field(..., description="Normalized severity level")
    message: str = Field(..., description="Original log message text")
    request_id: Optional[str] = Field(None, description="Optional request ID")
    service_name: Optional[str] = Field(None, description="Originating service name")
    source_metadata: Optional[Dict[str, Any]] = Field(None, description="Contextual metadata")
    created_at: datetime = Field(..., description="Ingestion timestamp (UTC)")

    model_config = ConfigDict(from_attributes=True)


class LogEventListResponse(BaseModel):
    items: List[LogEventResponse] = Field(..., description="List of correlated log events")
    total: int = Field(..., description="Total matching logs for this incident")
    skip: int = Field(..., description="Pagination offset")
    limit: int = Field(..., description="Pagination limit")


class LogIngestionResponse(BaseModel):
    incident_id: str = Field(..., description="Target incident UUID")
    ingested_count: int = Field(..., description="Number of log records successfully persisted")
    message: str = Field(..., description="Status summary message")
