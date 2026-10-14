from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class SeverityDistribution(BaseModel):
    debug: int = Field(default=0, description="Count of DEBUG events")
    info: int = Field(default=0, description="Count of INFO events")
    warning: int = Field(default=0, description="Count of WARNING events")
    error: int = Field(default=0, description="Count of ERROR events")
    critical: int = Field(default=0, description="Count of CRITICAL events")
    total: int = Field(default=0, description="Total log events analyzed")


class TimeWindow(BaseModel):
    first_event_at: Optional[datetime] = Field(None, description="Earliest event timestamp")
    last_event_at: Optional[datetime] = Field(None, description="Latest event timestamp")
    duration_seconds: float = Field(default=0.0, description="Duration between first and last events in seconds")


class ErrorGroup(BaseModel):
    signature: str = Field(..., description="Normalized error message pattern")
    sample_message: str = Field(..., description="Representative verbatim log message")
    count: int = Field(..., description="Number of occurrences of this error pattern")
    severity: str = Field(..., description="Dominant or maximum severity in this group")
    service_names: List[str] = Field(default_factory=list, description="Services reporting this error")
    first_seen_at: datetime = Field(..., description="First observed timestamp")
    last_seen_at: datetime = Field(..., description="Last observed timestamp")
    evidence_log_ids: List[str] = Field(default_factory=list, description="IDs of matching log events")


class RequestCorrelation(BaseModel):
    request_id: str = Field(..., description="Correlated HTTP or trace request ID")
    total_events: int = Field(..., description="Number of events logged with this request ID")
    has_error: bool = Field(default=False, description="Whether this request encountered ERROR or CRITICAL events")
    has_warning: bool = Field(default=False, description="Whether this request encountered WARNING events")
    warning_preceded_error: bool = Field(default=False, description="Whether a warning chronologically preceded an error within this request")
    service_names: List[str] = Field(default_factory=list, description="Services involved in this request")
    event_ids: List[str] = Field(default_factory=list, description="Log event IDs in chronological order")
    first_event_at: datetime = Field(..., description="Start of request trace")
    last_event_at: datetime = Field(..., description="End of request trace")


class DiagnosticFinding(BaseModel):
    finding_type: str = Field(..., description="Type of finding: repeated_error, error_burst, warning_preceded_error, etc.")
    rule_id: str = Field(..., description="Identifier of the deterministic rule that triggered this finding")
    title: str = Field(..., description="Concise human-readable finding title")
    description: str = Field(..., description="Factual description of the observation without speculation")
    evidence_log_ids: List[str] = Field(default_factory=list, description="List of specific log event UUIDs serving as evidence")
    first_timestamp: Optional[datetime] = Field(None, description="Earliest relevant timestamp")
    last_timestamp: Optional[datetime] = Field(None, description="Latest relevant timestamp")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Supporting quantitative metrics")


class IncidentAnalysisResponse(BaseModel):
    incident_id: str = Field(..., description="Target incident UUID")
    analyzed_at: datetime = Field(..., description="UTC timestamp when analysis was performed")
    total_logs: int = Field(..., description="Total logs processed")
    severity_distribution: SeverityDistribution = Field(..., description="Breakdown of event counts by severity")
    time_window: TimeWindow = Field(..., description="Temporal boundary of observed events")
    summary: str = Field(..., description="Deterministic human-readable summary of observations")
    findings: List[DiagnosticFinding] = Field(default_factory=list, description="List of evidence-backed findings")
    error_groups: List[ErrorGroup] = Field(default_factory=list, description="Cluster of similar errors by signature")
    request_correlations: List[RequestCorrelation] = Field(default_factory=list, description="Traces grouped by request ID")

    model_config = ConfigDict(from_attributes=True)
