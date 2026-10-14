from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict


class DiagnosticHypothesis(BaseModel):
    rank: int = Field(..., ge=1, description="Relative plausibility rank (1 is most likely)")
    title: str = Field(..., description="Concise diagnostic hypothesis title")
    plausibility_reasoning: str = Field(..., description="Explanation of why this hypothesis is plausible given the evidence")
    supporting_evidence_ids: List[str] = Field(default_factory=list, description="Validated log event UUIDs directly supporting this hypothesis")
    invalid_evidence_ids: List[str] = Field(default_factory=list, description="IDs pruned server-side because they did not exist in stored logs")
    contradictory_or_missing_evidence: Optional[str] = Field(None, description="Observed contradictory data or missing telemetry that should be verified")
    recommended_debugging_steps: List[str] = Field(default_factory=list, description="Concrete, actionable debugging steps for engineers")
    status: str = Field(default="plausible", description="Investigation status: plausible, unverified, requires_more_telemetry")


class IncidentInvestigationResponse(BaseModel):
    incident_id: str = Field(..., description="Target incident UUID")
    investigated_at: datetime = Field(..., description="UTC timestamp of the investigation")
    provider: str = Field(..., description="LLM provider used (e.g. gemini, openai, rule_synthesizer)")
    model_name: str = Field(..., description="Model identifier used")
    incident_summary: str = Field(..., description="High-level narrative synthesis of the incident failure")
    observed_facts: List[str] = Field(default_factory=list, description="Strictly observed facts extracted from logs and deterministic analysis")
    ranked_hypotheses: List[DiagnosticHypothesis] = Field(default_factory=list, description="Ranked diagnostic hypotheses")
    uncertainty_and_limitations: List[str] = Field(default_factory=list, description="Explicit caveats, assumptions, and observational limitations")
    total_evidence_referenced: int = Field(default=0, description="Count of genuine, verified log evidence references")

    model_config = ConfigDict(from_attributes=True)
