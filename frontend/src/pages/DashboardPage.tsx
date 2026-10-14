import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Database,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Code2,
  Cpu,
  Layers,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchServiceHealth, fetchDatabaseHealth } from '../api/health';
import { fetchIncidents } from '../api/incidents';
import type { ServiceHealth, DatabaseHealth } from '../types/health';
import type { Incident } from '../types/incident';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';

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

      // If database is connected, also fetch recent incidents
      if (dbRes.connected) {
        try {
          const incRes = await fetchIncidents(0, 5);
          setRecentIncidents(incRes.items);
        } catch {
          // Non-blocking for health check
        }
      }

      const isHealthy = serviceRes.status === 'healthy';
      if (onHealthUpdate) {
        onHealthUpdate(isHealthy, false);
      }
    } catch (err: any) {
      const errorMessage =
        err.message || 'Failed to reach FastAPI backend service';
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

  return (
    <div className="space-y-8">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#1F2937]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            System Infrastructure & Connectivity
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            TraceLens AI foundation: FastAPI core, MongoDB async client, and Vite React frontend.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              Checked {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={checkHealth}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md bg-[#161F30] hover:bg-[#1E293B] text-slate-200 border border-[#23314B] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{isLoading ? 'Checking...' : 'Refresh Health'}</span>
          </button>
        </div>
      </div>

      {/* Error Alert Banner if Backend Unreachable */}
      {error && (
        <div className="rounded-lg bg-rose-950/30 border border-rose-800/60 p-4 text-rose-200 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-rose-300">FastAPI Backend Unreachable</div>
              <p className="text-xs text-rose-300/80">
                {error}. Ensure the backend server is running on <code className="font-mono bg-rose-950 px-1 py-0.5 rounded">http://127.0.0.1:8000</code>.
              </p>
              <div className="text-xs font-mono text-slate-400 mt-2 bg-black/40 p-2 rounded border border-rose-900/40">
                # Start backend in PowerShell:<br />
                cd backend; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 8000
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Service Card */}
        <MetricCard
          title="Backend API"
          icon={<Server className="w-4 h-4 text-indigo-400" />}
          value={
            isLoading ? (
              <span className="text-slate-400 text-sm">Probing...</span>
            ) : serviceHealth?.status === 'healthy' ? (
              <span className="text-emerald-400">FastAPI</span>
            ) : (
              <span className="text-rose-400">Disconnected</span>
            )
          }
          subtitle={serviceHealth ? `v${serviceHealth.version} (${serviceHealth.environment})` : 'Endpoint: /api/health'}
          statusBadge={
            isLoading ? (
              <StatusBadge status="loading" />
            ) : serviceHealth?.status === 'healthy' ? (
              <StatusBadge status="healthy" label="Online" />
            ) : (
              <StatusBadge status="unhealthy" label="Offline" />
            )
          }
        />

        {/* Database Card */}
        <MetricCard
          title="Database"
          icon={<Database className="w-4 h-4 text-cyan-400" />}
          value={
            isLoading ? (
              <span className="text-slate-400 text-sm">Checking...</span>
            ) : dbHealth?.connected ? (
              <span className="text-emerald-400">MongoDB</span>
            ) : (
              <span className="text-amber-400">Unavailable</span>
            )
          }
          subtitle={
            dbHealth?.connected
              ? 'Active connection (AsyncMongoClient)'
              : dbHealth?.details
              ? dbHealth.details
              : 'MongoDB instance not reachable'
          }
          statusBadge={
            isLoading ? (
              <StatusBadge status="loading" />
            ) : dbHealth?.connected ? (
              <StatusBadge status="healthy" label="Connected" />
            ) : (
              <StatusBadge status="warning" label="Pending DB" />
            )
          }
        />

        {/* Latency Card */}
        <MetricCard
          title="Health Latency"
          icon={<Clock className="w-4 h-4 text-emerald-400" />}
          value={
            latencyMs !== null ? (
              <span>{latencyMs} <span className="text-xs text-slate-400 font-normal">ms</span></span>
            ) : (
              <span className="text-slate-400 text-sm">—</span>
            )
          }
          subtitle="Round-trip HTTP ping"
          statusBadge={
            latencyMs !== null && latencyMs < 100 ? (
              <StatusBadge status="healthy" label="Fast" />
            ) : latencyMs !== null ? (
              <StatusBadge status="warning" label="Normal" />
            ) : null
          }
        />

        {/* Frontend Core */}
        <MetricCard
          title="Frontend Client"
          icon={<Code2 className="w-4 h-4 text-amber-400" />}
          value="React + Vite"
          subtitle="Tailwind CSS + Axios"
          statusBadge={<StatusBadge status="healthy" label="Running" />}
        />
      </div>

      {/* Database Setup Notice if DB is unavailable */}
      {!isLoading && dbHealth && !dbHealth.connected && (
        <div className="bg-[#111827] border border-amber-900/40 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <div className="font-semibold text-amber-300">
                MongoDB Connection Notice
              </div>
              <p className="text-xs text-slate-300">
                The FastAPI service is operational, but MongoDB is not reachable at the configured address (
                <code className="font-mono bg-black/40 px-1 py-0.5 text-amber-200">mongodb://127.0.0.1:27017</code>).
              </p>
              <div className="text-xs text-slate-400 space-y-1">
                <div>To connect MongoDB:</div>
                <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px] text-slate-300">
                  <li>Option A: Start local MongoDB service (<code className="bg-slate-900 px-1 py-0.5 rounded">net start MongoDB</code> in an elevated terminal)</li>
                  <li>Option B: Configure <code className="bg-slate-900 px-1 py-0.5 rounded">MONGODB_URL</code> in <code className="bg-slate-900 px-1 py-0.5 rounded">backend/.env</code> with MongoDB Atlas or your remote cluster</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Raw Health JSON Accordion */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-lg overflow-hidden">
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-[#161F30]/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-slate-400">DEBUG</span>
            <span className="text-slate-300 font-semibold">Inspect Raw Health Response Payloads</span>
          </div>
          {showRawJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showRawJson && (
          <div className="p-5 border-t border-[#1F2937] grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0D121D]">
            <div>
              <div className="text-xs font-mono text-slate-400 mb-2">GET /api/health</div>
              <pre className="p-3 bg-[#080B11] border border-[#1F2937] rounded font-mono text-xs text-emerald-400 overflow-x-auto">
                {JSON.stringify(serviceHealth, null, 2) || '// No response received'}
              </pre>
            </div>
            <div>
              <div className="text-xs font-mono text-slate-400 mb-2">GET /api/health/db</div>
              <pre className="p-3 bg-[#080B11] border border-[#1F2937] rounded font-mono text-xs text-cyan-400 overflow-x-auto">
                {JSON.stringify(dbHealth, null, 2) || '// No response received'}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Phase 2 Preview: Incident Analysis Placeholder Panel */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-[#1F2937]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-indigo-950/80 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
              <FileSearch className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Incident Triage & Failure Investigation
              </h2>
              <p className="text-xs text-slate-400">
                Core diagnostic workflow pipeline (Phase 2 preview)
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161F30] border border-[#23314B] text-[11px] font-mono text-indigo-300">
            Phase 2 Scope
          </span>
        </div>

        {/* Pipeline Steps Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded border border-[#1F2937] bg-[#0E131F]/50">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-1">
              <Cpu className="w-3.5 h-3.5" />
              <span>1. Ingestion & Correlation</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Capture failed API request payloads, correlate timestamps with application logs, and cluster error signatures.
            </p>
          </div>

          <div className="p-4 rounded border border-[#1F2937] bg-[#0E131F]/50">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-1">
              <Layers className="w-3.5 h-3.5" />
              <span>2. Diagnostic Hypotheses</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              AI-driven causal hypothesis generation backed by concrete stack trace evidence and code context.
            </p>
          </div>

          <div className="p-4 rounded border border-[#1F2937] bg-[#0E131F]/50">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>3. Regression Generation</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automatically convert reproduced failures into executable pytest/HTTPX regression suites.
            </p>
          </div>
        </div>

        {/* Active Tracked Incidents Section */}
        <div className="border border-[#1F2937] rounded-md overflow-hidden">
          <div className="bg-[#0D121D] px-4 py-2.5 text-xs font-mono text-slate-400 border-b border-[#1F2937] flex items-center justify-between">
            <span className="font-semibold text-slate-300">Live Tracked Incidents</span>
            <Link
              to="/incidents"
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-sans transition-colors"
            >
              View All Incidents →
            </Link>
          </div>
          {recentIncidents.length > 0 ? (
            <div className="divide-y divide-[#1F2937] text-xs font-mono">
              {recentIncidents.map((inc) => (
                <Link
                  key={inc.id}
                  to={`/incidents/${inc.id}`}
                  className="p-3 flex items-center justify-between bg-[#111827]/40 hover:bg-[#161F30]/60 transition-colors group"
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] uppercase">
                      {inc.status}
                    </span>
                    <span className="text-slate-200 group-hover:text-indigo-300 transition-colors truncate">
                      {inc.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-slate-400 text-[11px]">
                    <span>{inc.log_count} logs</span>
                    <span className="hidden sm:inline">{new Date(inc.created_at).toLocaleTimeString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400 font-mono bg-[#111827]/20">
              No incidents recorded yet.{' '}
              <Link to="/incidents" className="text-indigo-400 hover:underline">
                Create an incident
              </Link>{' '}
              to start ingesting telemetry logs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
