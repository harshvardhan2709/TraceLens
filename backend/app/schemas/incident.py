from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class IncidentStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    MITIGATED = "mitigated"
    RESOLVED = "resolved"
    CLOSED = "closed"


class IncidentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Incident title or summary")
    description: Optional[str] = Field(None, max_length=2000, description="Optional incident description")
    status: IncidentStatus = Field(default=IncidentStatus.OPEN, description="Initial incident status")


class IncidentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    status: Optional[IncidentStatus] = None


class IncidentResponse(BaseModel):
    id: str = Field(..., description="UUID identifier")
    title: str = Field(..., description="Incident title")
    description: Optional[str] = Field(None, description="Optional incident description")
    status: str = Field(..., description="Lifecycle status")
    created_at: datetime = Field(..., description="Creation timestamp (UTC)")
    updated_at: datetime = Field(..., description="Last update timestamp (UTC)")
    log_count: int = Field(default=0, description="Number of correlated log events")

    model_config = ConfigDict(from_attributes=True)


class IncidentListResponse(BaseModel):
    items: List[IncidentResponse] = Field(..., description="List of incidents")
    total: int = Field(..., description="Total matching incidents")
    skip: int = Field(..., description="Pagination offset")
    limit: int = Field(..., description="Pagination limit")
