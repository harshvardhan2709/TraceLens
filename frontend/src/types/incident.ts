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
