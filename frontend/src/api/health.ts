import { apiClient } from './client';
import type { ServiceHealth, DatabaseHealth } from '../types/health';

export async function fetchServiceHealth(): Promise<ServiceHealth> {
  const response = await apiClient.get<ServiceHealth>('/health');
  return response.data;
}

export async function fetchDatabaseHealth(): Promise<DatabaseHealth> {
  try {
    const response = await apiClient.get<DatabaseHealth>('/health/db');
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      return error.response.data as DatabaseHealth;
    }
    return {
      status: 'unhealthy',
      database: 'mongodb',
      connected: false,
      details: error.message || 'Database connection error',
    };
  }
}
