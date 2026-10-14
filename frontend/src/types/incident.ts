export type IncidentStatus = 'open' | 'investigating' | 'mitigated' | 'resolved' | 'closed';

export interface Incident {
  id: string;
  title: string;
  description?: string | null;
  status: IncidentStatus;
  created_at: string;
  updated_at: string;
  log_count: number;
}

export interface IncidentCreate {
  title: string;
  description?: string;
  status?: IncidentStatus;
}

export interface IncidentListResponse {
  items: Incident[];
  total: number;
  skip: number;
  limit: number;
}

export type LogSeverity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface LogEvent {
  id: string;
  incident_id: string;
  timestamp: string;
  severity: LogSeverity;
  message: string;
  request_id?: string | null;
  service_name?: string | null;
  source_metadata?: Record<string, any> | null;
  created_at: string;
}

export interface LogEventCreate {
  timestamp: string;
  severity: LogSeverity;
  message: string;
  request_id?: string;
  service_name?: string;
  source_metadata?: Record<string, any>;
}

export interface LogEventListResponse {
  items: LogEvent[];
  total: number;
  skip: number;
  limit: number;
}

export interface LogIngestionResponse {
  incident_id: string;
  ingested_count: number;
  message: string;
}

export interface SeverityDistribution {
  debug: number;
  info: number;
  warning: number;
  error: number;
  critical: number;
  total: number;
}

export interface TimeWindow {
  first_event_at?: string | null;
  last_event_at?: string | null;
  duration_seconds: number;
}

export interface ErrorGroup {
  signature: string;
  sample_message: string;
  count: number;
  severity: string;
  service_names: string[];
  first_seen_at: string;
  last_seen_at: string;
  evidence_log_ids: string[];
}

export interface RequestCorrelation {
  request_id: string;
  total_events: number;
  has_error: boolean;
  has_warning: boolean;
  warning_preceded_error: boolean;
  service_names: string[];
  event_ids: string[];
  first_event_at: string;
  last_event_at: string;
}

export interface DiagnosticFinding {
  finding_type: string;
  rule_id: string;
  title: string;
  description: string;
  evidence_log_ids: string[];
  first_timestamp?: string | null;
  last_timestamp?: string | null;
  metadata?: Record<string, any> | null;
}

export interface IncidentAnalysisResponse {
  incident_id: string;
  analyzed_at: string;
  total_logs: number;
  severity_distribution: SeverityDistribution;
  time_window: TimeWindow;
  summary: string;
  findings: DiagnosticFinding[];
  error_groups: ErrorGroup[];
  request_correlations: RequestCorrelation[];
}

export interface DiagnosticHypothesis {
  rank: number;
  title: string;
  plausibility_reasoning: string;
  supporting_evidence_ids: string[];
  invalid_evidence_ids: string[];
  contradictory_or_missing_evidence?: string | null;
  recommended_debugging_steps: string[];
  status: string;
}

export interface IncidentInvestigationResponse {
  incident_id: string;
  investigated_at: string;
  provider: string;
  model_name: string;
  incident_summary: string;
  observed_facts: string[];
  ranked_hypotheses: DiagnosticHypothesis[];
  uncertainty_and_limitations: string[];
  total_evidence_referenced: number;
}


