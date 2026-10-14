import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Database,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Cpu,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchServiceHealth, fetchDatabaseHealth } from '../api/health';
import { fetchIncidents } from '../api/incidents';
import type { ServiceHealth, DatabaseHealth } from '../types/health';
import type { Incident } from '../types/incident';
import MetricCard from '../components/MetricCard';
import IncidentStatusBadge from '../components/IncidentStatusBadge';

interface DashboardPageProps {
  onHealthUpdate?: (isHealthy: boolean, isLoading: boolean) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onHealthUpdate }) => {
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth | null>(null);
  const [dbHealth, setDbHealth] = useState<DatabaseHealth | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [totalIncidents, setTotalIncidents] = useState<number>(0);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      const [serviceRes, dbRes] = await Promise.all([
        fetchServiceHealth(),
        fetchDatabaseHealth(),
      ]);

      const duration = Math.round(performance.now() - startTime);
      setServiceHealth(serviceRes);
      setDbHealth(dbRes);
      setLatencyMs(duration);
      setLastUpdated(new Date());

      if (dbRes.connected) {
        try {
          const incRes = await fetchIncidents(0, 6);
          setRecentIncidents(incRes.items);
          setTotalIncidents(incRes.total);
        } catch {
          // Non-blocking
        }
      }

      const isHealthy = serviceRes.status === 'healthy';
      if (onHealthUpdate) {
        onHealthUpdate(isHealthy, false);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to reach FastAPI backend service';
      setError(errorMessage);
      setServiceHealth(null);
      setDbHealth(null);
      setLatencyMs(null);
      setLastUpdated(new Date());

      if (onHealthUpdate) {
        onHealthUpdate(false, false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [onHealthUpdate]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const openCount = recentIncidents.filter((i) => i.status === 'open').length;

  return (
    <div className="space-y-6">
      {/* Console Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#1E293B]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Operations & Health Overview
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational status of connected services, MongoDB telemetry storage, and active failure investigations
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {lastUpdated && (
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              Sampled {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={checkHealth}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#162032] hover:bg-[#1E293B] text-slate-200 border border-[#2B3B53] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
            <span>{isLoading ? 'Sampling...' : 'Refresh Status'}</span>
          </button>
        </div>
      </div>

      {/* Backend Alert Banner if Down */}
      {error && (
        <div className="rounded-lg bg-red-950/30 border border-red-800/60 p-3.5 text-red-200 text-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-red-300">FastAPI Telemetry Backend Unreachable</div>
              <p className="text-red-300/80">
                {error}. Ensure the backend service is running on <code className="font-mono bg-red-950 px-1 py-0.5 rounded">http://127.0.0.1:8000</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Operational Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Monitored Incidents"
          icon={<FileSearch className="w-4 h-4 text-slate-400" />}
          value={isLoading ? '...' : totalIncidents}
          subtitle={`${openCount} open in current sample`}
        />

        <MetricCard
          title="API Gateway / Core"
          icon={<Server className="w-4 h-4 text-slate-400" />}
          value={
            isLoading ? (
              <span className="text-slate-400 text-sm">Probing...</span>
            ) : serviceHealth?.status === 'healthy' ? (
              <span className="text-emerald-400 text-lg">FastAPI {serviceHealth.version ? `v${serviceHealth.version}` : 'Core'}</span>
            ) : (
              <span className="text-red-400 text-lg">Offline</span>
            )
          }
          subtitle={latencyMs !== null ? `${latencyMs}ms roundtrip` : 'Status unavailable'}
        />

        <MetricCard
          title="Database Persistence"
          icon={<Database className="w-4 h-4 text-slate-400" />}
          value={
            isLoading ? (
              <span className="text-slate-400 text-sm">Probing...</span>
            ) : dbHealth?.connected ? (
              <span className="text-emerald-400 text-lg">MongoDB {dbHealth.database ? `(${dbHealth.database})` : 'Connected'}</span>
            ) : (
              <span className="text-amber-400 text-lg">Disconnected</span>
            )
          }
          subtitle={dbHealth?.details || (dbHealth?.database ? `database: ${dbHealth.database}` : 'Connection timed out')}
        />

        <MetricCard
          title="Diagnostic Engine"
          icon={<Cpu className="w-4 h-4 text-slate-400" />}
          value={<span className="text-blue-400 text-lg">Rules + AI</span>}
          subtitle="4 deterministic rules + validation"
        />
      </div>

      {/* Recent Incidents Table */}
      <section className="bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Recent Incidents
            </h2>
            <span className="text-[11px] font-mono text-slate-400">({totalIncidents} total)</span>
          </div>

          <Link
            to="/incidents"
            className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 transition-colors"
          >
            <span>View All Incidents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentIncidents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 space-y-2">
            <p>No incidents recorded yet.</p>
            <Link
              to="/incidents"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              <span>Go to Incidents Workspace</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#0E131F] text-slate-400 text-[11px] font-mono border-b border-[#1E293B]">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Incident</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Telemetry Logs</th>
                  <th className="py-2.5 px-4 font-medium">Created (UTC)</th>
                  <th className="py-2.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {recentIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-[#162032]/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200">{inc.title}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>id: {inc.id.slice(0, 8)}</span>
                        {inc.description && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-sm">{inc.description}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <IncidentStatusBadge status={inc.status} />
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-[#1E293B] text-slate-300 border border-slate-700">
                        {inc.log_count} events
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {new Date(inc.created_at).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/incidents/${inc.id}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
                      >
                        <span>Investigate</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Diagnostic Capabilities Overview Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-4 rounded-lg bg-[#111827] border border-[#1E293B] space-y-2">
          <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            Deterministic Diagnostic Rules
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Engine correlates telemetry into evidence-backed findings using strictly deterministic pattern rules:
          </p>
          <ul className="space-y-1 font-mono text-[11px] text-slate-300 list-disc list-inside">
            <li><code className="text-blue-300">RULE_REPEATED_ERROR</code>: Identical signature recurring across traces</li>
            <li><code className="text-blue-300">RULE_ERROR_BURST</code>: Concentrated errors (≥3 within 30s sliding window)</li>
            <li><code className="text-blue-300">RULE_REQUEST_WARNING_BEFORE_ERROR</code>: Warning preceding failure cascade</li>
            <li><code className="text-blue-300">RULE_SERVICE_ERROR_CONCENTRATION</code>: Concentration in single service ≥65%</li>
          </ul>
        </div>

        <div className="p-4 rounded-lg bg-[#111827] border border-[#1E293B] space-y-2">
          <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
            Evidence-Grounded AI Investigation
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Optional secondary diagnostic reasoning layer built with evidence verification:
          </p>
          <ul className="space-y-1 font-mono text-[11px] text-slate-300 list-disc list-inside">
            <li>Synthesizes ranked diagnostic hypotheses from verified telemetry</li>
            <li>Server-side validation prunes any hallucinated or unverified event references</li>
            <li>Prompt-injection containment treats log strings as strictly untrusted text</li>
            <li>Explicit separation between observed facts and inferred hypotheses</li>
          </ul>
        </div>
      </div>

      {/* Developer Raw JSON Diagnostics Drawer */}
      <div className="border border-[#1E293B] rounded-lg bg-[#0E131F] text-xs">
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-slate-400 hover:text-slate-200 transition-colors text-left"
        >
          <span className="font-mono text-[11px]">Raw System Health Probes JSON</span>
          {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showRawJson && (
          <div className="p-4 border-t border-[#1E293B] bg-[#080C14]">
            <pre className="p-3 bg-[#05080F] rounded border border-[#1E293B] font-mono text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
              {JSON.stringify({ serviceHealth, dbHealth, latencyMs, lastUpdated }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
