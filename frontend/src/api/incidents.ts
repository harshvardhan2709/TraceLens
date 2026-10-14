import { apiClient } from './client';
import type {
  Incident,
  IncidentCreate,
  IncidentListResponse,
  LogEventCreate,
  LogEventListResponse,
  LogIngestionResponse,
} from '../types/incident';

export async function fetchIncidents(skip: number = 0, limit: number = 50): Promise<IncidentListResponse> {
  const response = await apiClient.get<IncidentListResponse>('/incidents', {
    params: { skip, limit },
  });
  return response.data;
}

export async function fetchIncident(incidentId: string): Promise<Incident> {
  const response = await apiClient.get<Incident>(`/incidents/${incidentId}`);
  return response.data;
}

export async function createIncident(data: IncidentCreate): Promise<Incident> {
  const response = await apiClient.post<Incident>('/incidents', data);
  return response.data;
}

export async function fetchIncidentLogs(
  incidentId: string,
  skip: number = 0,
  limit: number = 50,
  severity?: string,
  requestId?: string,
  sort: string = 'desc',
): Promise<LogEventListResponse> {
  const params: Record<string, any> = { skip, limit, sort };
  if (severity && severity !== 'ALL') {
    params.severity = severity;
  }
  if (requestId) {
    params.request_id = requestId;
  }

  const response = await apiClient.get<LogEventListResponse>(`/incidents/${incidentId}/logs`, {
    params,
  });
  return response.data;
}

export async function ingestIncidentLogs(
  incidentId: string,
  logs: LogEventCreate[],
): Promise<LogIngestionResponse> {
  const response = await apiClient.post<LogIngestionResponse>(`/incidents/${incidentId}/logs`, {
    logs,
  });
  return response.data;
}
