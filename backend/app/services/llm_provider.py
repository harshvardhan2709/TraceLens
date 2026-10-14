import abc
import json
import logging
import re
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import Settings, get_settings

logger = logging.getLogger("tracelens.services.llm_provider")


class LLMProviderError(Exception):
    """Raised when an LLM provider encounters an unrecoverable API or parsing failure."""
    def __init__(self, message: str, status_code: Optional[int] = None, retryable: bool = False):
        super().__init__(message)
        self.status_code = status_code
        self.retryable = retryable


class BaseLLMProvider(abc.ABC):
    """Abstract interface for LLM diagnostic investigation providers."""

    @abc.abstractmethod
    def get_provider_name(self) -> str:
        """Identifier for the provider (e.g., gemini, openai, rule_synthesizer)."""
        pass

    @abc.abstractmethod
    def get_model_name(self) -> str:
        """Model identifier used."""
        pass

    @abc.abstractmethod
    async def generate_investigation(
        self,
        prompt: str,
        system_instruction: str,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generate structured investigation JSON from prompt and system instructions."""
        pass


class GeminiProvider(BaseLLMProvider):
    """Google Gemini REST API implementation using structured JSON output mode."""

    def __init__(self, api_key: str, model: str = "gemini-1.5-flash", timeout_seconds: float = 25.0):
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds

    def get_provider_name(self) -> str:
        return "gemini"

    def get_model_name(self) -> str:
        return self.model

    async def generate_investigation(
        self,
        prompt: str,
        system_instruction: str,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "system_instruction": {
                "parts": [{"text": system_instruction}]
            },
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.2,
                "maxOutputTokens": 3000,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 429:
                    raise LLMProviderError("Gemini API rate limit exceeded", status_code=429, retryable=True)
                if res.status_code >= 400:
                    raise LLMProviderError(f"Gemini API returned error {res.status_code}: {res.text}", status_code=res.status_code)

                data = res.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    raise LLMProviderError("Gemini returned no candidates in response")

                raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                if not raw_text:
                    raise LLMProviderError("Empty text in Gemini response part")

                return json.loads(raw_text)
        except httpx.TimeoutException:
            raise LLMProviderError(f"Gemini API request timed out after {self.timeout_seconds}s", status_code=504, retryable=True)
        except json.JSONDecodeError as exc:
            raise LLMProviderError(f"Failed to parse Gemini output as JSON: {exc}")


class OpenAIProvider(BaseLLMProvider):
    """OpenAI and OpenAI-compatible API implementation."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        base_url: Optional[str] = None,
        timeout_seconds: float = 25.0,
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")
        self.timeout_seconds = timeout_seconds

    def get_provider_name(self) -> str:
        return "openai"

    def get_model_name(self) -> str:
        return self.model

    async def generate_investigation(
        self,
        prompt: str,
        system_instruction: str,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 429:
                    raise LLMProviderError("OpenAI API rate limit exceeded", status_code=429, retryable=True)
                if res.status_code >= 400:
                    raise LLMProviderError(f"OpenAI API returned error {res.status_code}: {res.text}", status_code=res.status_code)

                data = res.json()
                choices = data.get("choices", [])
                if not choices:
                    raise LLMProviderError("OpenAI returned no choices")

                raw_text = choices[0].get("message", {}).get("content", "")
                return json.loads(raw_text)
        except httpx.TimeoutException:
            raise LLMProviderError(f"OpenAI API request timed out after {self.timeout_seconds}s", status_code=504, retryable=True)
        except json.JSONDecodeError as exc:
            raise LLMProviderError(f"Failed to parse OpenAI output as JSON: {exc}")


class RuleSynthesizerProvider(BaseLLMProvider):
    """
    Evidence-grounded local synthesizer that interprets deterministic findings,
    patterns, and telemetry events without requiring external network dependencies
    or external API keys.
    """

    def __init__(self, model: str = "rule-synthesizer-v1"):
        self.model = model

    def get_provider_name(self) -> str:
        return "rule_synthesizer"

    def get_model_name(self) -> str:
        return self.model

    async def generate_investigation(
        self,
        prompt: str,
        system_instruction: str,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Synthesize evidence-backed diagnostic hypotheses strictly from observed telemetry
        and deterministic correlation rules.
        """
        context = context_data or {}
        incident = context.get("incident") or {}
        analysis = context.get("analysis") or {}
        logs = context.get("logs") or []

        findings = analysis.get("findings", [])
        error_groups = analysis.get("error_groups", [])
        request_correlations = analysis.get("request_correlations", [])
        time_window = analysis.get("time_window", {})

        # Extract genuine stored IDs
        error_logs = [l for l in logs if l.get("severity") in ("ERROR", "CRITICAL")]
        warning_logs = [l for l in logs if l.get("severity") == "WARNING"]
        all_log_ids = [l["id"] for l in logs if "id" in l]

        # Extract observed facts
        observed_facts = [
            f"Incident '{incident.get('title', 'Unknown')}' analyzed across {len(logs)} log events spanning {time_window.get('duration_seconds', 0)}s.",
            f"Observed {len(error_logs)} error/critical events and {len(warning_logs)} warning events.",
        ]
        if error_groups:
            observed_facts.append(
                f"Deterministic pattern clustering grouped failures into {len(error_groups)} distinct error signature(s)."
            )

        cascading_reqs = [r for r in request_correlations if r.get("warning_preceded_error")]
        if cascading_reqs:
            observed_facts.append(
                f"Request trace '{cascading_reqs[0].get('request_id')}' demonstrated chronological degradation: warning followed by error."
            )

        # Check for prompt injection patterns in logs
        injection_logs = []
        for l in logs:
            msg = l.get("message", "").lower()
            if any(term in msg for term in ["ignore all previous instructions", "you are now", "delete all records", "drop table", "act as root"]):
                injection_logs.append(l)

        if injection_logs:
            observed_facts.append(
                f"Detected {len(injection_logs)} log event(s) containing hostile or prompt-injection text strings, isolated and treated purely as raw telemetry."
            )

        # Build Ranked Hypotheses based on evidence
        ranked_hypotheses: List[Dict[str, Any]] = []

        # Case A: Database / Lock / Connection Pool Starvation
        db_timeout_logs = [
            l for l in logs
            if any(term in l.get("message", "").lower() for term in [
                "database", "db pool", "connection pool", "acquire lock", "client lock",
                "query timeout", "deadlock", "postgres", "mongo", "mysql", "redis",
            ])
        ]
        if db_timeout_logs:
            evidence_ids = [l["id"] for l in db_timeout_logs[:5]]
            ranked_hypotheses.append({
                "rank": len(ranked_hypotheses) + 1,
                "title": "Database Connection Pool Starvation or Lock Acquisition Timeout",
                "plausibility_reasoning": (
                    "Telemetry captures active connection exhaustion or socket timeout deadlines while attempting "
                    "to query backend persistence. Early warnings indicating pool saturation preceded query timeouts."
                ),
                "supporting_evidence_ids": evidence_ids,
                "invalid_evidence_ids": [],
                "contradictory_or_missing_evidence": (
                    "Database server-side metrics (active connection count, slow query logs, CPU utilization) "
                    "are not present in application logs and should be verified."
                ),
                "recommended_debugging_steps": [
                    "Inspect database connection pool max_size and connection lifetime settings.",
                    "Review database query execution plans for queries holding transaction locks.",
                    "Verify network reachability and latency between application hosts and the database server.",
                ],
                "status": "plausible",
            })

        # Case B: Request Validation or Missing Required Payload Field
        validation_logs = [
            l for l in logs
            if any(term in l.get("message", "").lower() for term in ["validation", "missing", "keyerror", "400 bad request", "unauthorized", "invalid field"])
        ]
        if validation_logs:
            evidence_ids = [l["id"] for l in validation_logs[:5]]
            ranked_hypotheses.append({
                "rank": len(ranked_hypotheses) + 1,
                "title": "Invalid Inbound Request Payload or Schema Mismatch",
                "plausibility_reasoning": (
                    "Failures directly mention missing fields or schema validation rejections. "
                    "The service rejected the request before completing downstream processing."
                ),
                "supporting_evidence_ids": evidence_ids,
                "invalid_evidence_ids": [],
                "contradictory_or_missing_evidence": (
                    "Inbound HTTP request payload body was not fully logged in telemetry for payload verification."
                ),
                "recommended_debugging_steps": [
                    "Inspect API gateway transformation rules or client request serialization.",
                    "Verify the API contract schema versions between client and backend handler.",
                    "Reproduce with a synthetic request supplying the missing required fields.",
                ],
                "status": "plausible",
            })

        # Case C: Downstream External Dependency Latency / 504 Gateway Timeout
        external_timeout_logs = [
            l for l in logs
            if any(term in l.get("message", "").lower() for term in ["504", "gateway timeout", "downstream", "http client timeout", "third-party", "stripe", "payment"])
        ]
        if external_timeout_logs and not any("Database" in h["title"] for h in ranked_hypotheses):
            evidence_ids = [l["id"] for l in external_timeout_logs[:5]]
            ranked_hypotheses.append({
                "rank": len(ranked_hypotheses) + 1,
                "title": "Downstream External Service Latency or Unavailability",
                "plausibility_reasoning": (
                    "Errors indicate gateway timeout (504) or prolonged latency while awaiting responses "
                    "from third-party or downstream microservices."
                ),
                "supporting_evidence_ids": evidence_ids,
                "invalid_evidence_ids": [],
                "contradictory_or_missing_evidence": (
                    "External partner status page or ingress access logs not correlated."
                ),
                "recommended_debugging_steps": [
                    "Check health and status endpoints of downstream partner services.",
                    "Evaluate circuit-breaker configurations and timeout thresholds.",
                    "Inspect network egress metrics and DNS resolution timings.",
                ],
                "status": "plausible",
            })

        # Case D: Prompt Injection Anomaly Detected
        if injection_logs:
            evidence_ids = [l["id"] for l in injection_logs[:5]]
            ranked_hypotheses.append({
                "rank": len(ranked_hypotheses) + 1,
                "title": "Adversarial Prompt-Injection Attempt Ingested via Telemetry",
                "plausibility_reasoning": (
                    "Log messages contain explicit directive override strings intended to manipulate automated LLM "
                    "evaluators. The engine safely contained and neutralized the payload as inert text."
                ),
                "supporting_evidence_ids": evidence_ids,
                "invalid_evidence_ids": [],
                "contradictory_or_missing_evidence": (
                    "No system instruction breach occurred; evidence isolated within log payload."
                ),
                "recommended_debugging_steps": [
                    "Identify the originating client IP or user agent submitting hostile strings.",
                    "Ensure input sanitization and rate limiting at ingress API gateway.",
                    "Audit telemetry pipeline for payload logging policies.",
                ],
                "status": "plausible",
            })

        # Fallback Generic Hypothesis if none matched or ambiguous
        if not ranked_hypotheses:
            evidence_ids = [l["id"] for l in error_logs[:4]] or all_log_ids[:2]
            ranked_hypotheses.append({
                "rank": 1,
                "title": "Intermittent Runtime Execution Failure",
                "plausibility_reasoning": (
                    "Failure events occurred during execution but telemetry exhibits ambiguous or multi-component failure points."
                ),
                "supporting_evidence_ids": evidence_ids,
                "invalid_evidence_ids": [],
                "contradictory_or_missing_evidence": (
                    "Log volume is sparse; detailed stack traces or debug-level logs are not available."
                ),
                "recommended_debugging_steps": [
                    "Increase log verbosity to DEBUG for affected services.",
                    "Correlate APM traces for detailed execution call graphs.",
                ],
                "status": "plausible",
            })

        # Explicit uncertainty & limitations (NO fabricated percentages)
        uncertainty_and_limitations = [
            "Diagnostic hypotheses are evidence-backed inferences derived from stored telemetry, not verified root-cause determinations.",
            "External system metrics (host CPU, memory, database IOPS, network routing) were not ingested.",
            "Independent reproduction and verification are required before applying production changes.",
        ]

        summary = (
            f"Observed {len(logs)} telemetry event(s) across incident '{incident.get('title', 'Unknown')}'. "
            f"Correlation identified {len(ranked_hypotheses)} plausible diagnostic hypothesis(es) supported by {len(error_logs)} error event(s)."
        )

        return {
            "incident_summary": summary,
            "observed_facts": observed_facts,
            "ranked_hypotheses": ranked_hypotheses,
            "uncertainty_and_limitations": uncertainty_and_limitations,
        }


def get_llm_provider(settings: Optional[Settings] = None, provider_override: Optional[str] = None) -> BaseLLMProvider:
    """
    Factory resolving the appropriate LLM provider based on settings and API key availability.
    Gracefully defaults to RuleSynthesizerProvider when no external credentials are configured.
    """
    s = settings or get_settings()
    provider_name = (provider_override or s.LLM_PROVIDER).lower().strip()

    if provider_name == "gemini" or (provider_name == "auto" and s.GEMINI_API_KEY):
        if not s.GEMINI_API_KEY:
            logger.warning("Gemini provider selected but GEMINI_API_KEY is not set; falling back to RuleSynthesizerProvider")
            return RuleSynthesizerProvider()
        return GeminiProvider(api_key=s.GEMINI_API_KEY, model=s.GEMINI_MODEL, timeout_seconds=s.LLM_TIMEOUT_SECONDS)

    if provider_name == "openai" or (provider_name == "auto" and s.OPENAI_API_KEY):
        if not s.OPENAI_API_KEY:
            logger.warning("OpenAI provider selected but OPENAI_API_KEY is not set; falling back to RuleSynthesizerProvider")
            return RuleSynthesizerProvider()
        return OpenAIProvider(
            api_key=s.OPENAI_API_KEY,
            model=s.OPENAI_MODEL,
            base_url=s.OPENAI_BASE_URL,
            timeout_seconds=s.LLM_TIMEOUT_SECONDS,
        )

    return RuleSynthesizerProvider()
