import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from pymongo import ASCENDING
from app.db.mongo import (
    get_incidents_collection,
    get_log_events_collection,
    get_analyses_collection,
)
from app.schemas.analysis import (
    DiagnosticFinding,
    ErrorGroup,
    IncidentAnalysisResponse,
    RequestCorrelation,
    SeverityDistribution,
    TimeWindow,
)

logger = logging.getLogger("tracelens.services.analysis")

# Regular expression patterns for careful deterministic message normalization
RE_UUID = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")
RE_HEX = re.compile(r"\b0x[0-9a-fA-F]+\b")
RE_ISO_TIMESTAMP = re.compile(r"\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b")
RE_IPV4 = re.compile(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b")
RE_REQ_ID = re.compile(r"\breq-[a-zA-Z0-9_\-]+\b")
# High-digit numbers (4 or more digits) preceded by whitespace or hash
RE_HIGH_DIGITS = re.compile(r"(?:(?<=\s)|(?<=#))\d{4,}(?=\s|$|,|\.|\))")
RE_WHITESPACE = re.compile(r"\s+")


def normalize_log_message(msg: str) -> str:
    """
    Carefully normalize variable runtime identifiers (UUIDs, timestamps, memory addresses)
    while strictly preserving semantic target names, HTTP status codes, and exception types
    so that distinct failure conditions are never incorrectly merged.
    """
    if not msg:
        return ""

    text = RE_UUID.sub("<UUID>", msg)
    text = RE_HEX.sub("<HEX>", text)
    text = RE_ISO_TIMESTAMP.sub("<TIMESTAMP>", text)
    text = RE_IPV4.sub("<IP>", text)
    text = RE_REQ_ID.sub("<REQ_ID>", text)
    text = RE_HIGH_DIGITS.sub("<NUM>", text)
    text = RE_WHITESPACE.sub(" ", text).strip()
    return text


def build_error_signature(log_event: dict) -> str:
    """
    Construct a deterministic signature using source_metadata exception fields if available,
    falling back to normalized message text.
    """
    meta = log_event.get("source_metadata") or {}
    if isinstance(meta, dict) and meta.get("exception_type"):
        exc = str(meta["exception_type"]).strip()
        norm_msg = normalize_log_message(log_event.get("message", ""))
        return f"{exc}: {norm_msg}"
    if isinstance(meta, dict) and meta.get("error_code"):
        code = str(meta["error_code"]).strip()
        norm_msg = normalize_log_message(log_event.get("message", ""))
        return f"[{code}] {norm_msg}"
    return normalize_log_message(log_event.get("message", ""))


def format_duration(seconds: float) -> str:
    """Format duration in human-readable notation."""
    if seconds < 1.0:
        return f"{seconds * 1000:.0f}ms"
    if seconds < 60.0:
        return f"{seconds:.1f}s"
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes}m {secs}s"


async def analyze_incident(incident_id: str) -> IncidentAnalysisResponse:
    """
    Execute deterministic diagnostic analysis on an incident's correlated log telemetry.
    Reconstructs timeline, groups error patterns, tracks request chains, and generates
    verifiable, evidence-backed findings.
    """
    incidents_col = get_incidents_collection()
    incident = await incidents_col.find_one({"id": incident_id})
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found",
        )

    log_col = get_log_events_collection()
    cursor = log_col.find({"incident_id": incident_id}).sort([("timestamp", ASCENDING), ("id", ASCENDING)])
    raw_logs = await cursor.to_list(length=10000)

    for item in raw_logs:
        item.pop("_id", None)
        # Handle string or missing timestamps safely for legacy/malformed records
        ts = item.get("timestamp")
        if isinstance(ts, str):
            try:
                item["timestamp"] = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                item["timestamp"] = datetime.now(timezone.utc)
        elif isinstance(ts, datetime):
            if ts.tzinfo is None:
                item["timestamp"] = ts.replace(tzinfo=timezone.utc)
        else:
            item["timestamp"] = datetime.now(timezone.utc)

        # Normalize default fields for legacy or missing values
        if not item.get("id"):
            item["id"] = "unknown-log-id"
        if not item.get("message"):
            item["message"] = ""
        if not item.get("severity"):
            item["severity"] = "INFO"
        else:
            item["severity"] = str(item["severity"]).upper()

    # Ensure chronological order regardless of ingestion order
    raw_logs.sort(key=lambda x: (x["timestamp"], str(x.get("id", ""))))

    # 1. Severity Distribution & Event Counting
    dist = {"DEBUG": 0, "INFO": 0, "WARNING": 0, "ERROR": 0, "CRITICAL": 0}
    for log in raw_logs:
        sev = log.get("severity", "").upper()
        if sev in dist:
            dist[sev] += 1
        elif sev == "WARN":
            dist["WARNING"] += 1

    total_logs = len(raw_logs)
    sev_distribution = SeverityDistribution(
        debug=dist["DEBUG"],
        info=dist["INFO"],
        warning=dist["WARNING"],
        error=dist["ERROR"],
        critical=dist["CRITICAL"],
        total=total_logs,
    )

    # 2. Chronological Timeline Reconstruction
    if total_logs > 0:
        first_event = raw_logs[0]["timestamp"]
        last_event = raw_logs[-1]["timestamp"]
        duration_sec = max(0.0, (last_event - first_event).total_seconds())
        time_window = TimeWindow(
            first_event_at=first_event,
            last_event_at=last_event,
            duration_seconds=round(duration_sec, 2),
        )
    else:
        time_window = TimeWindow(first_event_at=None, last_event_at=None, duration_seconds=0.0)

    # 3. Handle Empty Logs
    if total_logs == 0:
        response = IncidentAnalysisResponse(
            incident_id=incident_id,
            analyzed_at=datetime.now(timezone.utc),
            total_logs=0,
            severity_distribution=sev_distribution,
            time_window=time_window,
            summary="No log telemetry events recorded for this incident yet.",
            findings=[],
            error_groups=[],
            request_correlations=[],
        )
        await persist_analysis(response)
        return response

    # 4. Error Grouping by Normalized Signature
    error_buckets: Dict[str, dict] = {}
    error_logs: List[dict] = []

    for log in raw_logs:
        if log.get("severity") in ("ERROR", "CRITICAL"):
            error_logs.append(log)
            sig = build_error_signature(log)
            if sig not in error_buckets:
                error_buckets[sig] = {
                    "signature": sig,
                    "sample_message": log.get("message", ""),
                    "count": 0,
                    "severity": log.get("severity"),
                    "service_names": set(),
                    "first_seen_at": log["timestamp"],
                    "last_seen_at": log["timestamp"],
                    "evidence_log_ids": [],
                }
            bucket = error_buckets[sig]
            bucket["count"] += 1
            if log.get("severity") == "CRITICAL":
                bucket["severity"] = "CRITICAL"
            if log.get("service_name"):
                bucket["service_names"].add(log["service_name"])
            if log["timestamp"] < bucket["first_seen_at"]:
                bucket["first_seen_at"] = log["timestamp"]
            if log["timestamp"] > bucket["last_seen_at"]:
                bucket["last_seen_at"] = log["timestamp"]
            bucket["evidence_log_ids"].append(log["id"])

    error_groups: List[ErrorGroup] = [
        ErrorGroup(
            signature=b["signature"],
            sample_message=b["sample_message"],
            count=b["count"],
            severity=b["severity"],
            service_names=sorted(list(b["service_names"])),
            first_seen_at=b["first_seen_at"],
            last_seen_at=b["last_seen_at"],
            evidence_log_ids=b["evidence_log_ids"],
        )
        for b in error_buckets.values()
    ]
    # Sort groups by highest occurrence count, then earliest observation
    error_groups.sort(key=lambda g: (-g.count, g.first_seen_at))

    # 5. Request-Correlated Event Sequences
    req_buckets: Dict[str, List[dict]] = {}
    for log in raw_logs:
        req_id = log.get("request_id")
        if req_id and str(req_id).strip():
            req_buckets.setdefault(str(req_id).strip(), []).append(log)

    request_correlations: List[RequestCorrelation] = []
    for req_id, req_events in req_buckets.items():
        req_services = sorted(list({e["service_name"] for e in req_events if e.get("service_name")}))
        has_error = any(e.get("severity") in ("ERROR", "CRITICAL") for e in req_events)
        has_warning = any(e.get("severity") == "WARNING" for e in req_events)

        warning_preceded_error = False
        saw_warning = False
        for e in req_events:
            sev = e.get("severity")
            if sev == "WARNING":
                saw_warning = True
            elif sev in ("ERROR", "CRITICAL") and saw_warning:
                warning_preceded_error = True
                break

        request_correlations.append(
            RequestCorrelation(
                request_id=req_id,
                total_events=len(req_events),
                has_error=has_error,
                has_warning=has_warning,
                warning_preceded_error=warning_preceded_error,
                service_names=req_services,
                event_ids=[e["id"] for e in req_events],
                first_event_at=req_events[0]["timestamp"],
                last_event_at=req_events[-1]["timestamp"],
            )
        )

    # Sort request correlations: put requests with cascading failures first
    request_correlations.sort(
        key=lambda r: (
            not r.warning_preceded_error,
            not r.has_error,
            -r.total_events,
            r.first_event_at,
        )
    )

    # 6. Deterministic Findings Detection
    findings: List[DiagnosticFinding] = []

    # Rule 1: Repeated Error Patterns (RULE_REPEATED_ERROR)
    for group in error_groups:
        if group.count >= 2:
            services_str = ", ".join(group.service_names) if group.service_names else "unspecified"
            findings.append(
                DiagnosticFinding(
                    finding_type="repeated_error",
                    rule_id="RULE_REPEATED_ERROR",
                    title=f"Repeated Error Pattern ({group.count} occurrences)",
                    description=(
                        f"Error pattern '{group.signature}' observed {group.count} times "
                        f"across service(s) [{services_str}]. Identical signature recurs over "
                        f"{format_duration((group.last_seen_at - group.first_seen_at).total_seconds())}."
                    ),
                    evidence_log_ids=group.evidence_log_ids,
                    first_timestamp=group.first_seen_at,
                    last_timestamp=group.last_seen_at,
                    metadata={"signature": group.signature, "count": group.count, "services": group.service_names},
                )
            )

    # Rule 2: Error Burst Detection (RULE_ERROR_BURST) - 3 or more errors within 30s window
    if len(error_logs) >= 3:
        burst_clusters: List[List[dict]] = []
        current_cluster: List[dict] = []

        for log in error_logs:
            if not current_cluster:
                current_cluster.append(log)
                continue

            delta = (log["timestamp"] - current_cluster[0]["timestamp"]).total_seconds()
            if delta <= 30.0:
                current_cluster.append(log)
            else:
                if len(current_cluster) >= 3:
                    burst_clusters.append(current_cluster)
                current_cluster = [log]

        if len(current_cluster) >= 3:
            burst_clusters.append(current_cluster)

        for cluster in burst_clusters:
            span = (cluster[-1]["timestamp"] - cluster[0]["timestamp"]).total_seconds()
            findings.append(
                DiagnosticFinding(
                    finding_type="error_burst",
                    rule_id="RULE_ERROR_BURST",
                    title=f"High-Density Error Burst ({len(cluster)} errors in {format_duration(span)})",
                    description=(
                        f"Detected a concentrated burst of {len(cluster)} failure events within "
                        f"{format_duration(span)} (between {cluster[0]['timestamp'].strftime('%H:%M:%S')} "
                        f"and {cluster[-1]['timestamp'].strftime('%H:%M:%S')} UTC)."
                    ),
                    evidence_log_ids=[e["id"] for e in cluster],
                    first_timestamp=cluster[0]["timestamp"],
                    last_timestamp=cluster[-1]["timestamp"],
                    metadata={"error_count": len(cluster), "duration_seconds": round(span, 2)},
                )
            )

    # Rule 3: Warning Preceding Error in Same Request Context (RULE_REQUEST_WARNING_BEFORE_ERROR)
    for rc in request_correlations:
        if rc.warning_preceded_error:
            services_str = ", ".join(rc.service_names) if rc.service_names else "unspecified"
            findings.append(
                DiagnosticFinding(
                    finding_type="warning_preceded_error",
                    rule_id="RULE_REQUEST_WARNING_BEFORE_ERROR",
                    title=f"Warning Preceded Error in Request {rc.request_id}",
                    description=(
                        f"In request '{rc.request_id}', an early warning event occurred prior to an error "
                        f"across service(s) [{services_str}]. Chronological progression demonstrates degradation "
                        f"preceding failure within the single request context."
                    ),
                    evidence_log_ids=rc.event_ids,
                    first_timestamp=rc.first_event_at,
                    last_timestamp=rc.last_event_at,
                    metadata={"request_id": rc.request_id, "services": rc.service_names, "total_events": rc.total_events},
                )
            )

    # Rule 4: Service Error Concentration (RULE_SERVICE_ERROR_CONCENTRATION)
    service_error_counts: Dict[str, List[str]] = {}
    for err in error_logs:
        svc = err.get("service_name") or "unknown-service"
        service_error_counts.setdefault(svc, []).append(err["id"])

    total_errors = len(error_logs)
    if total_errors >= 3:
        for svc, ids in service_error_counts.items():
            pct = (len(ids) / total_errors) * 100.0
            if pct >= 65.0:
                findings.append(
                    DiagnosticFinding(
                        finding_type="service_concentration",
                        rule_id="RULE_SERVICE_ERROR_CONCENTRATION",
                        title=f"Failure Concentration in {svc} ({pct:.0f}%)",
                        description=(
                            f"Service '{svc}' is responsible for {len(ids)} of {total_errors} ({pct:.1f}%) "
                            f"total error events recorded across this incident."
                        ),
                        evidence_log_ids=ids,
                        first_timestamp=time_window.first_event_at,
                        last_timestamp=time_window.last_event_at,
                        metadata={"service": svc, "error_count": len(ids), "percentage": round(pct, 1)},
                    )
                )

    # 7. Deterministic Factual Summary
    distinct_services = sorted(list({l["service_name"] for l in raw_logs if l.get("service_name")}))
    services_count = len(distinct_services)
    total_failures = dist["ERROR"] + dist["CRITICAL"]

    summary_parts = [
        f"Analyzed {total_logs} log event(s) across {services_count or 1} service(s) over {format_duration(time_window.duration_seconds)}.",
        f"Encountered {total_failures} failure event(s) ({dist['ERROR']} errors, {dist['CRITICAL']} critical) and {dist['WARNING']} warning(s).",
    ]
    if findings:
        summary_parts.append(
            f"Deterministic correlation identified {len(findings)} evidence-backed pattern(s): "
            f"{len(error_groups)} unique error signature(s) and {sum(1 for f in findings if f.finding_type == 'warning_preceded_error')} request degradation sequence(s)."
        )
    else:
        summary_parts.append("No recurring error signatures or request-level warning degradation patterns detected.")

    summary = " ".join(summary_parts)

    response = IncidentAnalysisResponse(
        incident_id=incident_id,
        analyzed_at=datetime.now(timezone.utc),
        total_logs=total_logs,
        severity_distribution=sev_distribution,
        time_window=time_window,
        summary=summary,
        findings=findings,
        error_groups=error_groups,
        request_correlations=request_correlations,
    )

    await persist_analysis(response)
    return response


async def get_latest_analysis(incident_id: str) -> IncidentAnalysisResponse:
    """
    Retrieve stored analysis for an incident. If analysis has not been executed yet,
    computes it on-the-fly to guarantee idempotent access.
    """
    incidents_col = get_incidents_collection()
    incident = await incidents_col.find_one({"id": incident_id})
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{incident_id}' not found",
        )

    analyses_col = get_analyses_collection()
    cached = await analyses_col.find_one({"incident_id": incident_id})
    if cached:
        cached.pop("_id", None)
        return IncidentAnalysisResponse.model_validate(cached)

    # Compute on the fly if not yet cached
    return await analyze_incident(incident_id)


async def persist_analysis(analysis: IncidentAnalysisResponse) -> None:
    """Persist or update incident analysis in MongoDB analyses collection."""
    analyses_col = get_analyses_collection()
    data = analysis.model_dump()
    await analyses_col.update_one(
        {"incident_id": analysis.incident_id},
        {"$set": data},
        upsert=True,
    )
    logger.info("Persisted analysis for incident %s (%d findings)", analysis.incident_id, len(analysis.findings))
