import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Clock,
  Layers,
  Tag,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
  FileCode,
} from 'lucide-react';
import { fetchIncident, fetchIncidentLogs, ingestIncidentLogs } from '../api/incidents';
import type { Incident, LogEvent, LogSeverity } from '../types/incident';

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  // Expanded metadata toggle state: Map of log.id -> boolean
  const [expandedMeta, setExpandedMeta] = useState<Record<string, boolean>>({});

  // Ingest Log Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [logSeverity, setLogSeverity] = useState<LogSeverity>('ERROR');
  const [logMessage, setLogMessage] = useState<string>('');
  const [serviceName, setServiceName] = useState<string>('order-service');
  const [requestId, setRequestId] = useState<string>('');
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [ingestNotice, setIngestNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [incData, logsData] = await Promise.all([
        fetchIncident(id),
        fetchIncidentLogs(id, 0, 50, severityFilter, undefined, sortOrder),
      ]);
      setIncident(incData);
      setLogs(logsData.items);
      setTotalLogs(logsData.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load incident details');
    } finally {
      setIsLoading(false);
    }
  }, [id, severityFilter, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleMetadata = (logId: string) => {
    setExpandedMeta((prev) => ({ ...prev, [logId]: !prev[logId] }));
  };

  const handleIngestSample = async () => {
    if (!id) return;
    setIsIngesting(true);
    setIngestNotice(null);
    const now = new Date().toISOString();
    const sampleLogs = [
      {
        timestamp: now,
        severity: 'INFO' as LogSeverity,
        message: 'Inbound POST /checkout received from client API gateway',
        request_id: `req-${Math.floor(Math.random() * 9000 + 1000)}`,
        service_name: 'api-gateway',
      },
      {
        timestamp: now,
        severity: 'WARNING' as LogSeverity,
        message: 'Connection pool high saturation warning: 37/40 active pooled sockets',
        request_id: `req-${Math.floor(Math.random() * 9000 + 1000)}`,
        service_name: 'order-service',
        source_metadata: { pool_capacity: 40, active_conns: 37, threshold_pct: 92.5 },
      },
      {
        timestamp: now,
        severity: 'ERROR' as LogSeverity,
        message: 'Database query timeout after 5000ms: Failed to acquire client lock',
        request_id: `req-${Math.floor(Math.random() * 9000 + 1000)}`,
        service_name: 'order-service',
        source_metadata: {
          error_code: 'ETIMEDOUT',
          driver: 'mongodb-async',
          stack: 'TimeoutError: connection acquisition exceeded deadline\n    at acquirePoolSocket (/src/db/pool.js:42)',
        },
      },
    ];

    try {
      await ingestIncidentLogs(id, sampleLogs);
      setIngestNotice('Successfully ingested 3 sample telemetry events.');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to ingest sample logs');
    } finally {
      setIsIngesting(false);
    }
  };

  const handleCustomIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !logMessage.trim()) return;

    setIsIngesting(true);
    try {
      await ingestIncidentLogs(id, [
        {
          timestamp: new Date().toISOString(),
          severity: logSeverity,
          message: logMessage.trim(),
          service_name: serviceName.trim() || undefined,
          request_id: requestId.trim() || undefined,
        },
      ]);
      setLogMessage('');
      setIsModalOpen(false);
      setIngestNotice('Log event successfully ingested.');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to ingest log event');
    } finally {
      setIsIngesting(false);
    }
  };

  const getSeverityPill = (sev: string) => {
    switch (sev) {
      case 'ERROR':
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
            {sev}
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
            {sev}
          </span>
        );
      case 'INFO':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-950 text-blue-300 border border-blue-800">
            {sev}
          </span>
        );
      case 'DEBUG':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
            {sev}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top back navigation and incident title */}
      <div className="space-y-3 pb-4 border-b border-[#1F2937]">
        <Link
          to="/incidents"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Incidents</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/60 uppercase">
                {incident?.status || 'OPEN'}
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-100">
                {incident?.title || 'Incident Details'}
              </h1>
            </div>
            {incident?.description && (
              <p className="text-xs text-slate-400 max-w-2xl">
                {incident.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400 pt-1 flex-wrap">
              <span>ID: <code className="text-slate-300">{incident?.id}</code></span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {incident ? new Date(incident.created_at).toLocaleString() : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleIngestSample}
              disabled={isIngesting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#161F30] hover:bg-indigo-950 text-indigo-300 border border-indigo-900/60 hover:border-indigo-600 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Ingest Sample Logs</span>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Log</span>
            </button>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded border border-[#1F2937] hover:bg-[#161F30] transition-colors"
              title="Refresh timeline"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Success / Error Banners */}
      {ingestNotice && (
        <div className="p-3 rounded-md bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between">
          <span>{ingestNotice}</span>
          <button onClick={() => setIngestNotice(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-md bg-rose-950/30 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Controls: Severity Filter and Sort Order */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111827] border border-[#1F2937] px-4 py-2.5 rounded-lg text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-mono">Severity:</span>
          <div className="flex items-center gap-1">
            {['ALL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors ${
                  severityFilter === sev
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-[#161F30] text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-slate-400">
            Total Logs: <strong className="text-slate-200">{totalLogs}</strong>
          </span>
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {sortOrder === 'desc' ? '▼ Latest First' : '▲ Oldest First'}
          </button>
        </div>
      </div>

      {/* Empty State */}
      {!isLoading && logs.length === 0 && (
        <div className="border border-dashed border-[#1F2937] rounded-lg p-12 text-center bg-[#0E131F]/30 space-y-3">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">No telemetry logs found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {severityFilter !== 'ALL'
              ? `No logs match the '${severityFilter}' severity filter.`
              : 'This incident has not received any log records yet. Click below to ingest a sample sequence.'}
          </p>
          <button
            onClick={handleIngestSample}
            disabled={isIngesting}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ingest Sample Logs</span>
          </button>
        </div>
      )}

      {/* Log Timeline */}
      {logs.length > 0 && (
        <div className="space-y-3">
          {logs.map((log) => {
            const hasMeta = log.source_metadata && Object.keys(log.source_metadata).length > 0;
            const isExpanded = !!expandedMeta[log.id];

            return (
              <div
                key={log.id}
                className="bg-[#111827] border border-[#1F2937] hover:border-[#374151] rounded-lg p-4 space-y-2 transition-all font-mono text-xs"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getSeverityPill(log.severity)}

                    {log.service_name && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700 flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5 text-indigo-400" />
                        {log.service_name}
                      </span>
                    )}

                    {log.request_id && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] border border-slate-700">
                        req: {log.request_id}
                      </span>
                    )}
                  </div>

                  <span className="text-slate-400 text-[11px]">
                    {new Date(log.timestamp).toISOString()}
                  </span>
                </div>

                <div className="p-3 rounded bg-[#090D15] border border-[#1F2937] text-slate-200 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
                  {log.message}
                </div>

                {hasMeta && (
                  <div>
                    <button
                      onClick={() => toggleMetadata(log.id)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <FileCode className="w-3 h-3 text-indigo-400" />
                      <span>{isExpanded ? 'Hide' : 'View'} Context Metadata ({Object.keys(log.source_metadata!).length} keys)</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {isExpanded && (
                      <pre className="mt-2 p-3 bg-[#06090F] border border-[#1F2937] rounded text-[11px] text-indigo-300 overflow-x-auto">
                        {JSON.stringify(log.source_metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Ingest Log Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#111827] border border-[#1F2937] rounded-lg max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2937]">
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Ingest Log Event
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCustomIngest} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Severity *</label>
                <select
                  value={logSeverity}
                  onChange={(e) => setLogSeverity(e.target.value as LogSeverity)}
                  className="w-full px-3 py-2 bg-[#0B0F17] border border-[#1F2937] rounded-md text-slate-200 font-mono focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="ERROR">ERROR</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="WARNING">WARNING</option>
                  <option value="INFO">INFO</option>
                  <option value="DEBUG">DEBUG</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Originating Service</label>
                <input
                  type="text"
                  placeholder="e.g., checkout-service"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0F17] border border-[#1F2937] rounded-md text-slate-200 font-mono focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Request ID (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., req-4921-checkout"
                  value={requestId}
                  onChange={(e) => setRequestId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0F17] border border-[#1F2937] rounded-md text-slate-200 font-mono focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Log Message *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Paste log output, error trace, or telemetry line..."
                  value={logMessage}
                  onChange={(e) => setLogMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0F17] border border-[#1F2937] rounded-md text-slate-200 font-mono focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1F2937]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-[#161F30] hover:bg-[#1E293B] text-slate-300 border border-[#23314B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isIngesting}
                  className="px-4 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors"
                >
                  {isIngesting ? 'Ingesting...' : 'Ingest Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentDetailPage;
