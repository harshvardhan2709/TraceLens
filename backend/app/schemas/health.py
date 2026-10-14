from typing import Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., description="Overall service status, e.g., 'healthy'")
    service: str = Field(..., description="Name of the service")
    version: str = Field(..., description="API version")
    environment: str = Field(..., description="Application environment")


class DatabaseHealthResponse(BaseModel):
    status: str = Field(..., description="Database status, 'healthy' or 'unhealthy'")
    database: str = Field(default="mongodb", description="Target database engine")
    connected: bool = Field(..., description="Whether connection test succeeded")
    details: Optional[str] = Field(None, description="Safe status message without exposing credentials")
