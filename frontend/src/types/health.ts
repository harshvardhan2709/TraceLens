export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  service: string;
  version: string;
  environment: string;
}

export interface DatabaseHealth {
  status: 'healthy' | 'unhealthy';
  database: string;
  connected: boolean;
  details?: string;
}

export interface HealthState {
  service: ServiceHealth | null;
  database: DatabaseHealth | null;
  isLoading: boolean;
  error: string | null;
  lastChecked: Date | null;
  latencyMs: number | null;
}
