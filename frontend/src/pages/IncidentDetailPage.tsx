import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Clock,
  Layers,
  Sparkles,
  X,
  FileCode,
  Cpu,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Info,
  Brain,
  CheckSquare,
  HelpCircle,
  Search,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  fetchIncident,
  fetchIncidentLogs,
  ingestIncidentLogs,
  analyzeIncident,
  fetchIncidentAnalysis,
  investigateIncident,
  fetchIncidentInvestigation,
} from '../api/incidents';
import type {
  Incident,
  LogEvent,
  LogSeverity,
  IncidentAnalysisResponse,
  IncidentInvestigationResponse,
} from '../types/incident';
import SeverityBadge from '../components/SeverityBadge';
import IncidentStatusBadge from '../components/IncidentStatusBadge';
import EvidenceReference from '../components/EvidenceReference';

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active View Tab: 'logs' (primary), 'rules' (deterministic), 'ai' (secondary)
  const [activeTab, setActiveTab] = useState<'logs' | 'rules' | 'ai'>('logs');

  // Deterministic Analysis State (Phase 3)
  const [analysis, setAnalysis] = useState<IncidentAnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [rulesSubTab, setRulesSubTab] = useState<'findings' | 'signatures' | 'traces'>('findings');
  const [highlightedLogId, setHighlightedLogId] = useState<string | null>(null);

  // AI Investigation State (Phase 4)
  const [investigation, setInvestigation] = useState<IncidentInvestigationResponse | null>(null);
  const [isInvestigating, setIsInvestigating] = useState<boolean>(false);

  // Filters & Sorting for Log Explorer
  const [logSearch, setLogSearch] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  // Expanded metadata toggle state: Map of log.id -> boolean
  const [expandedMeta, setExpandedMeta] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<boolean>(false);

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
        fetchIncidentLogs(id, 0, 100, severityFilter, undefined, sortOrder),
      ]);
      setIncident(incData);
      setLogs(logsData.items);
      setTotalLogs(logsData.total);

      // Silently fetch existing deterministic analysis if available
      try {
        const analysisData = await fetchIncidentAnalysis(id);
        setAnalysis(analysisData);
      } catch {
        // Not analyzed yet
      }

      // Silently fetch existing AI investigation if available
      try {
        const investData = await fetchIncidentInvestigation(id);
        setInvestigation(investData);
      } catch {
        // Not investigated yet
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load incident details');
    } finally {
      setIsLoading(false);
    }
  }, [id, severityFilter, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunAnalysis = async () => {
    if (!id) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeIncident(id);
      setAnalysis(result);
      setActiveTab('rules');
      setIngestNotice('Deterministic rule correlation completed.');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to execute incident analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunInvestigation = async () => {
    if (!id) return;
    setIsInvestigating(true);
    setError(null);
    try {
      const result = await investigateIncident(id);
      setInvestigation(result);
      try {
        const analysisData = await fetchIncidentAnalysis(id);
        setAnalysis(analysisData);
      } catch {}
      setActiveTab('ai');
      setIngestNotice('AI diagnostic investigation completed with evidence validation.');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to execute AI investigation');
    } finally {
      setIsInvestigating(false);
    }
  };

  const toggleMetadata = (logId: string) => {
    setExpandedMeta((prev) => ({ ...prev, [logId]: !prev[logId] }));
  };

  const scrollToEvidenceLog = (logId: string) => {
    // Switch to log timeline tab
    setActiveTab('logs');
    if (severityFilter !== 'ALL') {
      setSeverityFilter('ALL');
    }
    setExpandedMeta((prev) => ({ ...prev, [logId]: true }));
    setHighlightedLogId(logId);

    setTimeout(() => {
      const el = document.getElementById(`log-${logId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    setTimeout(() => {
      setHighlightedLogId(null);
    }, 3500);
  };

  const handleCopyId = () => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleIngestSample = async () => {
    if (!id) return;
    setIsIngesting(true);
    setIngestNotice(null);
    const now = new Date().toISOString();
    const sampleReqId = `req-${Math.floor(Math.random() * 9000 + 1000)}`;

    const sampleLogs = [
      {
        timestamp: new Date(Date.now() - 12000).toISOString(),
        severity: 'INFO' as LogSeverity,
        message: 'Inbound POST /checkout received from client API gateway',
        request_id: sampleReqId,
        service_name: 'api-gateway',
      },
      {
        timestamp: new Date(Date.now() - 8000).toISOString(),
        severity: 'WARNING' as LogSeverity,
        message: 'High connection pool saturation: 38/40 active pooled sockets',
        request_id: sampleReqId,
        service_name: 'order-service',
        source_metadata: { pool_capacity: 40, active_conns: 38, threshold_pct: 95.0 },
      },
      {
        timestamp: new Date(Date.now() - 4000).toISOString(),
        severity: 'ERROR' as LogSeverity,
        message: 'Database query timeout after 5000ms: Failed to acquire client lock',
        request_id: sampleReqId,
        service_name: 'order-service',
        source_metadata: {
          exception_type: 'TimeoutError',
          error_code: 'ETIMEDOUT',
          driver: 'mongodb-async',
        },
      },
      {
        timestamp: now,
        severity: 'ERROR' as LogSeverity,
        message: 'Database query timeout after 5000ms: Failed to acquire client lock',
        request_id: sampleReqId,
        service_name: 'order-service',
        source_metadata: {
          exception_type: 'TimeoutError',
          error_code: 'ETIMEDOUT',
        },
      },
    ];

    try {
      await ingestIncidentLogs(id, sampleLogs);
      setIngestNotice('Successfully ingested 4 structured telemetry events.');
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

  // Filter logs by search term
  const filteredLogs = useMemo(() => {
    if (!logSearch.trim()) return logs;
    const q = logSearch.toLowerCase().trim();
    return logs.filter(
      (l) =>
        l.message.toLowerCase().includes(q) ||
        (l.service_name && l.service_name.toLowerCase().includes(q)) ||
        (l.request_id && l.request_id.toLowerCase().includes(q)) ||
        l.id.toLowerCase().includes(q)
    );
  }, [logs, logSearch]);

  // Operational metrics
  const errorCount = logs.filter((l) => l.severity === 'ERROR' || l.severity === 'CRITICAL').length;
  const warnCount = logs.filter((l) => l.severity === 'WARNING').length;
  const involvedServices = Array.from(new Set(logs.map((l) => l.service_name).filter(Boolean))) as string[];

  const formatDuration = (seconds?: number) => {
    if (!seconds && seconds !== 0) return '0s';
    if (seconds < 1.0) return `${Math.round(seconds * 1000)}ms`;
    if (seconds < 60.0) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const rem = Math.round(seconds % 60);
    return `${mins}m ${rem}s`;
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
        <Link to="/incidents" className="hover:text-slate-200 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Incidents</span>
        </Link>
        <span>/</span>
        <span className="text-slate-300 truncate max-w-xs">{id}</span>
      </div>

      {/* A. Professional Incident Header */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <IncidentStatusBadge status={incident?.status || 'open'} />
              <h1 className="text-lg font-bold tracking-tight text-slate-100">
                {incident?.title || 'Incident Triage'}
              </h1>
            </div>

            {incident?.description && (
              <p className="text-xs text-slate-400 max-w-3xl">
                {incident.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs font-mono text-slate-400 pt-1 flex-wrap">
              <button
                onClick={handleCopyId}
                className="hover:text-slate-200 flex items-center gap-1 bg-[#0B0F17] px-2 py-0.5 rounded border border-[#1E293B]"
                title="Copy Incident UUID"
              >
                <span>ID: {incident?.id}</span>
                {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
              </button>

              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                {incident ? new Date(incident.created_at).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : ''}
              </span>

              <span>{totalLogs} telemetry logs</span>
            </div>
          </div>

          {/* Contextual Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
              title="Run deterministic pattern correlation rules"
            >
              <Cpu className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Correlating...' : 'Correlate Rules'}</span>
            </button>

            <button
              onClick={handleRunInvestigation}
              disabled={isInvestigating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#162032] hover:bg-[#1E293B] text-violet-300 border border-violet-900/60 hover:border-violet-600 transition-colors disabled:opacity-50"
              title="Generate AI diagnostic hypotheses with evidence verification"
            >
              <Sparkles className={`w-3.5 h-3.5 text-violet-400 ${isInvestigating ? 'animate-pulse' : ''}`} />
              <span>{isInvestigating ? 'Investigating...' : 'AI Investigation'}</span>
            </button>

            <button
              onClick={handleIngestSample}
              disabled={isIngesting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-[#162032] hover:bg-[#1E293B] text-slate-300 border border-[#2B3B53] transition-colors disabled:opacity-50"
            >
              <span>+ Sample Logs</span>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded bg-[#162032] hover:bg-[#1E293B] text-slate-300 border border-[#2B3B53] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Log</span>
            </button>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded border border-[#1E293B] hover:bg-[#162032] transition-colors"
              title="Refresh timeline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* B. Operational Summary Bar */}
        <div className="pt-3 border-t border-[#1E293B] grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
          <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
            <div className="text-[10px] text-slate-400 uppercase">Total Events</div>
            <div className="text-sm font-semibold text-slate-200 mt-0.5">{totalLogs}</div>
          </div>

          <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
            <div className="text-[10px] text-slate-400 uppercase">Errors / Critical</div>
            <div className={`text-sm font-semibold mt-0.5 ${errorCount > 0 ? 'text-red-400' : 'text-slate-200'}`}>
              {errorCount}
            </div>
          </div>

          <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
            <div className="text-[10px] text-slate-400 uppercase">Warnings</div>
            <div className={`text-sm font-semibold mt-0.5 ${warnCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
              {warnCount}
            </div>
          </div>

          <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B]">
            <div className="text-[10px] text-slate-400 uppercase">Time Window</div>
            <div className="text-sm font-semibold text-slate-200 mt-0.5">
              {analysis ? formatDuration(analysis.time_window.duration_seconds) : 'N/A'}
            </div>
          </div>

          <div className="bg-[#0B0F17] p-2 rounded border border-[#1E293B] col-span-2 sm:col-span-1">
            <div className="text-[10px] text-slate-400 uppercase">Services</div>
            <div className="text-[11px] text-slate-300 mt-0.5 truncate">
              {involvedServices.length > 0 ? involvedServices.join(', ') : 'None'}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {ingestNotice && (
        <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {ingestNotice}
          </span>
          <button onClick={() => setIngestNotice(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded bg-red-950/30 border border-red-800 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main View Tabs: Evidence Log Explorer (Primary) | Deterministic Rules | AI Investigation */}
      <div className="flex items-center gap-1 border-b border-[#1E293B] text-xs font-mono">
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-3 py-2 border-b-2 font-medium flex items-center gap-2 transition-colors ${
            activeTab === 'logs'
              ? 'border-blue-500 text-slate-100 bg-[#162032]/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Log Explorer ({totalLogs})</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`px-3 py-2 border-b-2 font-medium flex items-center gap-2 transition-colors ${
            activeTab === 'rules'
              ? 'border-blue-500 text-slate-100 bg-[#162032]/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Deterministic Findings {analysis ? `(${analysis.findings.length})` : ''}</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`px-3 py-2 border-b-2 font-medium flex items-center gap-2 transition-colors ${
            activeTab === 'ai'
              ? 'border-violet-500 text-violet-200 bg-violet-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-3.5 h-3.5 text-violet-400" />
          <span>AI-Assisted Investigation {investigation ? `(${investigation.ranked_hypotheses.length})` : ''}</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: STRUCTURED LOG EXPLORER (PRIMARY INTERFACE)        */}
      {/* ========================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-3">
          {/* Log Explorer Controls Toolbar */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search log messages, services, or request IDs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0B0F17] border border-[#1E293B] rounded text-slate-200 placeholder-slate-500 text-xs font-mono focus:outline-hidden focus:border-blue-500"
              />
            </div>

            {/* Severity and Sort Controls */}
            <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap">
              <div className="flex items-center gap-1 font-mono text-[11px]">
                <span className="text-slate-400 mr-1 hidden md:inline">Severity:</span>
                {['ALL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      severityFilter === sev
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-[#162032] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-[#1E293B] hidden sm:block" />

              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="font-mono text-xs text-slate-400 hover:text-slate-200 transition-colors"
                title="Toggle chronological ordering"
              >
                {sortOrder === 'desc' ? '▼ Newest First' : '▲ Oldest First'}
              </button>
            </div>
          </div>

          {/* Structured Columnar Log Stream */}
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden font-mono text-xs">
            {isLoading && logs.length === 0 ? (
              <div className="p-8 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 bg-[#162032]/60 rounded animate-pulse" />
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                <Layers className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="font-semibold text-slate-300">No telemetry log events match filters</div>
                <p className="max-w-sm mx-auto text-slate-500">
                  {severityFilter !== 'ALL' || logSearch
                    ? 'Try adjusting your search query or severity filter.'
                    : 'Ingest sample logs to begin exploring event telemetry.'}
                </p>
                <button
                  onClick={handleIngestSample}
                  disabled={isIngesting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors mt-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ingest Sample Logs</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#1E293B]">
                {filteredLogs.map((log) => {
                  const hasMeta = log.source_metadata && Object.keys(log.source_metadata).length > 0;
                  const isExpanded = !!expandedMeta[log.id];
                  const isHighlighted = highlightedLogId === log.id;

                  return (
                    <div
                      key={log.id}
                      id={`log-${log.id}`}
                      className={`transition-colors ${
                        isHighlighted
                          ? 'bg-blue-950/40 border-l-4 border-l-blue-500'
                          : 'hover:bg-[#162032]/40 border-l-4 border-l-transparent'
                      }`}
                    >
                      {/* Log Row Line */}
                      <div className="px-3 py-2 flex items-start gap-3">
                        {/* Timestamp */}
                        <span className="text-[11px] text-slate-400 shrink-0 w-24">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>

                        {/* Severity Pill */}
                        <div className="shrink-0 w-16">
                          <SeverityBadge severity={log.severity} size="sm" />
                        </div>

                        {/* Service / Request ID */}
                        <div className="shrink-0 flex items-center gap-1.5 text-[10px] text-slate-400">
                          {log.service_name && (
                            <span className="px-1.5 py-0.2 rounded bg-[#162032] text-slate-300 border border-[#2B3B53]">
                              {log.service_name}
                            </span>
                          )}
                          {log.request_id && (
                            <span className="px-1.5 py-0.2 rounded bg-[#0E131F] text-slate-400 border border-[#1E293B]">
                              {log.request_id}
                            </span>
                          )}
                        </div>

                        {/* Log Message */}
                        <div className="flex-1 text-slate-200 text-xs leading-relaxed break-words whitespace-pre-wrap">
                          {log.message}
                        </div>

                        {/* Metadata Toggle & ID tag */}
                        <div className="shrink-0 flex items-center gap-1.5 text-[10px] text-slate-500">
                          <span title={log.id}>id:{log.id.slice(0, 6)}</span>
                          {hasMeta && (
                            <button
                              onClick={() => toggleMetadata(log.id)}
                              className="p-1 rounded hover:bg-[#1E293B] text-slate-400 hover:text-slate-200 transition-colors"
                              title="Toggle structured metadata"
                            >
                              <FileCode className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable JSON Metadata Drawer */}
                      {hasMeta && isExpanded && (
                        <div className="px-10 pb-3 pt-1 bg-[#090D15]/80 border-t border-[#1E293B]/60">
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <FileCode className="w-3 h-3 text-blue-400" />
                            <span>Context Metadata ({Object.keys(log.source_metadata!).length} keys)</span>
                          </div>
                          <pre className="p-2.5 bg-[#05080F] rounded border border-[#1E293B] text-[11px] text-blue-300 overflow-x-auto leading-relaxed">
                            {JSON.stringify(log.source_metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: DETERMINISTIC RULE FINDINGS                        */}
      {/* ========================================================= */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {!analysis && !isAnalyzing ? (
            <div className="p-10 text-center bg-[#111827] border border-[#1E293B] rounded-lg space-y-3">
              <Cpu className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-sm font-semibold text-slate-200">No Deterministic Correlation Stored Yet</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Execute deterministic rule correlation to group repeating exception signatures, detect burst clusters, and reconstruct request cascade traces.
              </p>
              <button
                onClick={handleRunAnalysis}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Run Deterministic Analysis</span>
              </button>
            </div>
          ) : isAnalyzing && !analysis ? (
            <div className="p-10 text-center bg-[#111827] border border-[#1E293B] rounded-lg space-y-2">
              <Cpu className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
              <div className="text-sm font-semibold text-slate-200">Correlating Telemetry Rules...</div>
              <p className="text-xs text-slate-400">Reconstructing timeline and clustering signatures.</p>
            </div>
          ) : analysis ? (
            <div className="space-y-4">
              {/* Deterministic Factual Summary Box */}
              <div className="p-3.5 rounded-lg bg-[#0E131F] border border-[#1E293B] text-xs font-mono text-slate-300 leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-200 uppercase text-[10px] block mb-0.5">
                    Deterministic Observation Synthesis
                  </span>
                  <p>{analysis.summary}</p>
                </div>
              </div>

              {/* Sub-tabs: Findings | Error Signatures | Request Traces */}
              <div className="flex items-center gap-1 border-b border-[#1E293B] pb-2 text-xs font-mono">
                <button
                  onClick={() => setRulesSubTab('findings')}
                  className={`px-3 py-1 rounded transition-colors ${
                    rulesSubTab === 'findings'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200 bg-[#162032]'
                  }`}
                >
                  Rule Findings ({analysis.findings.length})
                </button>
                <button
                  onClick={() => setRulesSubTab('signatures')}
                  className={`px-3 py-1 rounded transition-colors ${
                    rulesSubTab === 'signatures'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200 bg-[#162032]'
                  }`}
                >
                  Clustered Signatures ({analysis.error_groups.length})
                </button>
                <button
                  onClick={() => setRulesSubTab('traces')}
                  className={`px-3 py-1 rounded transition-colors ${
                    rulesSubTab === 'traces'
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200 bg-[#162032]'
                  }`}
                >
                  Request Traces ({analysis.request_correlations.length})
                </button>
              </div>

              {/* Subtab A: Rule Findings */}
              {rulesSubTab === 'findings' && (
                <div className="space-y-2.5">
                  {analysis.findings.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-[#111827] rounded-lg border border-[#1E293B]">
                      No deterministic rule violations detected in this dataset.
                    </div>
                  ) : (
                    analysis.findings.map((f, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg bg-[#111827] border border-[#1E293B] hover:border-slate-700 transition-colors space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#1E293B] text-slate-300 border border-slate-700">
                              {f.rule_id}
                            </span>
                            <span className="text-xs font-bold text-slate-100">{f.title}</span>
                          </div>
                          {f.first_timestamp && (
                            <span className="text-[11px] font-mono text-slate-400">
                              {new Date(f.first_timestamp).toLocaleTimeString()} UTC
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 font-sans leading-relaxed">{f.description}</p>

                        {/* Evidence References */}
                        {f.evidence_log_ids.length > 0 && (
                          <div className="pt-2 border-t border-[#1E293B] flex items-center gap-1.5 flex-wrap text-xs font-mono">
                            <span className="text-slate-400 text-[11px]">Supporting Evidence:</span>
                            {f.evidence_log_ids.map((logId) => (
                              <EvidenceReference key={logId} id={logId} onClick={scrollToEvidenceLog} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Subtab B: Error Signatures */}
              {rulesSubTab === 'signatures' && (
                <div className="space-y-2.5">
                  {analysis.error_groups.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-[#111827] rounded-lg border border-[#1E293B]">
                      No error signatures clustered.
                    </div>
                  ) : (
                    analysis.error_groups.map((group, idx) => (
                      <div key={idx} className="p-3.5 rounded-lg bg-[#111827] border border-[#1E293B] space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/60 text-red-300 border border-red-800/60">
                              {group.count} {group.count === 1 ? 'occurrence' : 'occurrences'}
                            </span>
                            {group.service_names.map((svc) => (
                              <span key={svc} className="px-1.5 py-0.5 rounded bg-[#162032] text-slate-300 border border-[#2B3B53] text-[10px]">
                                {svc}
                              </span>
                            ))}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            First seen: {new Date(group.first_seen_at).toLocaleTimeString()} UTC
                          </span>
                        </div>

                        <div className="p-2 bg-[#080C14] rounded border border-[#1E293B] text-amber-200 text-[11px]">
                          {group.signature}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                          <span className="text-slate-400">Evidence:</span>
                          {group.evidence_log_ids.map((logId) => (
                            <EvidenceReference key={logId} id={logId} onClick={scrollToEvidenceLog} />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Subtab C: Request Traces */}
              {rulesSubTab === 'traces' && (
                <div className="space-y-2.5">
                  {analysis.request_correlations.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-[#111827] rounded-lg border border-[#1E293B]">
                      No correlated request IDs.
                    </div>
                  ) : (
                    analysis.request_correlations.map((req, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-lg bg-[#111827] border text-xs font-mono space-y-2 ${
                          req.warning_preceded_error
                            ? 'border-amber-700/60 bg-amber-950/10'
                            : 'border-[#1E293B]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-[#1E293B] text-slate-200 border border-slate-700 font-bold">
                              {req.request_id}
                            </span>
                            {req.warning_preceded_error && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                Warning → Error Cascade
                              </span>
                            )}
                            {req.has_error && !req.warning_preceded_error && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-300 border border-red-800">
                                Encountered Error
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {req.total_events} events • {new Date(req.first_event_at).toLocaleTimeString()} UTC
                          </span>
                        </div>

                        {req.service_names.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                            <span className="text-slate-500">Path:</span>
                            {req.service_names.map((svc, sIdx) => (
                              <React.Fragment key={svc}>
                                <span className="px-1.5 py-0.2 rounded bg-[#162032] border border-[#2B3B53]">{svc}</span>
                                {sIdx < req.service_names.length - 1 && <ArrowRight className="w-3 h-3 text-slate-500" />}
                              </React.Fragment>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                          <span className="text-slate-400">Trace Events:</span>
                          {req.event_ids.map((logId) => (
                            <EvidenceReference key={logId} id={logId} onClick={scrollToEvidenceLog} />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: AI-ASSISTED INVESTIGATION (SECONDARY LAYER)        */}
      {/* ========================================================= */}
      {activeTab === 'ai' && (
        <div className="space-y-4">
          {!investigation && !isInvestigating ? (
            <div className="p-10 text-center bg-[#111827] border border-[#1E293B] rounded-lg space-y-3">
              <Brain className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-sm font-semibold text-slate-200">No AI-Assisted Investigation Run Yet</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Synthesize evidence-backed diagnostic hypotheses. The investigation operates as a secondary analytical layer interpreting deterministic telemetry findings.
              </p>
              <button
                onClick={handleRunInvestigation}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-violet-600 hover:bg-violet-500 text-white transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Run AI Investigation</span>
              </button>
            </div>
          ) : isInvestigating && !investigation ? (
            <div className="p-10 text-center bg-[#111827] border border-[#1E293B] rounded-lg space-y-2">
              <Brain className="w-8 h-8 text-violet-400 animate-pulse mx-auto" />
              <div className="text-sm font-semibold text-slate-200">Synthesizing Diagnostic Hypotheses...</div>
              <p className="text-xs text-slate-400">Verifying evidence references against stored telemetry.</p>
            </div>
          ) : investigation ? (
            <div className="space-y-4">
              {/* Secondary Layer Banner & Model Tag */}
              <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1E293B] text-slate-300 border border-slate-700">
                    AI-ASSISTED ANALYSIS
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    provider: {investigation.provider} ({investigation.model_name})
                  </span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  Validated References: {investigation.total_evidence_referenced} log IDs
                </div>
              </div>

              {/* Narrative Summary */}
              <div className="p-3.5 rounded-lg bg-[#0E131F] border border-[#1E293B] text-xs font-sans text-slate-200 leading-relaxed">
                <div className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Incident Narrative Summary
                </div>
                <p>{investigation.incident_summary}</p>
              </div>

              {/* Observed Facts */}
              {investigation.observed_facts.length > 0 && (
                <div className="p-3 rounded-lg bg-[#111827] border border-[#1E293B] space-y-1.5 text-xs">
                  <div className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Observed Telemetry Facts (Separated from Inferences)</span>
                  </div>
                  <ul className="space-y-1 font-mono text-[11px] text-slate-300 list-disc list-inside">
                    {investigation.observed_facts.map((fact, fIdx) => (
                      <li key={fIdx}>{fact}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ranked Diagnostic Hypotheses */}
              <div className="space-y-3">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
                  Ranked Diagnostic Hypotheses ({investigation.ranked_hypotheses.length})
                </div>

                {investigation.ranked_hypotheses.map((hypo) => (
                  <div
                    key={hypo.rank}
                    className="p-4 rounded-lg bg-[#111827] border border-[#1E293B] hover:border-slate-700 transition-colors space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#1E293B] text-slate-200 border border-slate-700">
                          RANK #{hypo.rank}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-[#0E131F] border border-[#1E293B] uppercase">
                          STATUS: {hypo.status}
                        </span>
                        <h4 className="text-xs font-bold text-slate-100">{hypo.title}</h4>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 font-sans leading-relaxed">
                      {hypo.plausibility_reasoning}
                    </p>

                    {/* Supporting Evidence */}
                    {hypo.supporting_evidence_ids.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono pt-1">
                        <span className="text-slate-400 text-[11px]">Evidence:</span>
                        {hypo.supporting_evidence_ids.map((logId) => (
                          <EvidenceReference key={logId} id={logId} onClick={scrollToEvidenceLog} />
                        ))}
                      </div>
                    )}

                    {/* Contradictory Signals / Gaps */}
                    {hypo.contradictory_or_missing_evidence && (
                      <div className="p-2.5 rounded bg-[#0A0D18] border border-[#1E293B] text-[11px] font-mono text-slate-400 flex items-start gap-2">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-amber-300 font-semibold block text-[10px] uppercase">
                            Telemetry Gaps to Verify:
                          </span>
                          <span>{hypo.contradictory_or_missing_evidence}</span>
                        </div>
                      </div>
                    )}

                    {/* Actionable Debugging Steps */}
                    {hypo.recommended_debugging_steps.length > 0 && (
                      <div className="pt-2 border-t border-[#1E293B] space-y-1">
                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <CheckSquare className="w-3 h-3 text-slate-400" />
                          <span>Recommended Debugging Actions</span>
                        </div>
                        <ul className="space-y-1 font-mono text-[11px] text-slate-300">
                          {hypo.recommended_debugging_steps.map((step, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-1.5">
                              <span className="text-slate-500 select-none">›</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Uncertainty and Limitations */}
              {investigation.uncertainty_and_limitations.length > 0 && (
                <div className="p-3 rounded-lg bg-[#090C16] border border-[#1E293B] text-[11px] font-mono text-slate-500 space-y-1">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold uppercase">
                    <ShieldAlert className="w-3 h-3 text-slate-400" />
                    <span>Analytical Limitations & Caveats</span>
                  </div>
                  <ul className="space-y-0.5 list-disc list-inside text-[10px]">
                    {investigation.uncertainty_and_limitations.map((lim, lIdx) => (
                      <li key={lIdx}>{lim}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Manual Ingest Log Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg max-w-lg w-full p-5 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                Ingest Telemetry Event
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCustomIngest} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1 font-mono text-[11px]">Severity *</label>
                <select
                  value={logSeverity}
                  onChange={(e) => setLogSeverity(e.target.value as LogSeverity)}
                  className="w-full px-3 py-1.5 bg-[#0B0F17] border border-[#1E293B] rounded text-slate-200 font-mono text-xs focus:outline-hidden focus:border-blue-500"
                >
                  <option value="ERROR">ERROR</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="WARNING">WARNING</option>
                  <option value="INFO">INFO</option>
                  <option value="DEBUG">DEBUG</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1 font-mono text-[11px]">Originating Service</label>
                <input
                  type="text"
                  placeholder="e.g., order-service"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0B0F17] border border-[#1E293B] rounded text-slate-200 font-mono text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1 font-mono text-[11px]">Request ID (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., req-4921-checkout"
                  value={requestId}
                  onChange={(e) => setRequestId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0B0F17] border border-[#1E293B] rounded text-slate-200 font-mono text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1 font-mono text-[11px]">Log Message *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Paste log output, error trace, or telemetry line..."
                  value={logMessage}
                  onChange={(e) => setLogMessage(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0B0F17] border border-[#1E293B] rounded text-slate-200 font-mono text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-[#162032] hover:bg-[#1E293B] text-slate-300 border border-[#2B3B53]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isIngesting}
                  className="px-4 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
                >
                  {isIngesting ? 'Ingesting...' : 'Ingest Log Event'}
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
