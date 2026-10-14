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
  Activity,
  Cpu,
  Flame,
  GitCommit,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Info,
  Server,
  Brain,
  CheckSquare,
  HelpCircle,
  ListFilter,
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
  DiagnosticFinding,
  IncidentInvestigationResponse,
} from '../types/incident';

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Deterministic Analysis State (Phase 3)
  const [analysis, setAnalysis] = useState<IncidentAnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisTab, setAnalysisTab] = useState<'findings' | 'groups' | 'requests'>('findings');
  const [highlightedLogId, setHighlightedLogId] = useState<string | null>(null);

  // AI Investigation State (Phase 4)
  const [investigation, setInvestigation] = useState<IncidentInvestigationResponse | null>(null);
  const [isInvestigating, setIsInvestigating] = useState<boolean>(false);

  // Section toggle view
  const [activeViewSection, setActiveViewSection] = useState<'all' | 'ai' | 'deterministic'>('all');

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

      // Silently load existing deterministic analysis if available
      try {
        const analysisData = await fetchIncidentAnalysis(id);
        setAnalysis(analysisData);
      } catch {
        // Analysis not yet run
      }

      // Silently load existing AI investigation if available
      try {
        const investData = await fetchIncidentInvestigation(id);
        setInvestigation(investData);
      } catch {
        // Investigation not yet run
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
      setIngestNotice('Deterministic correlation analysis refreshed.');
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
      // Synchronize analysis state
      try {
        const analysisData = await fetchIncidentAnalysis(id);
        setAnalysis(analysisData);
      } catch {}
      setIngestNotice('AI diagnostic investigation completed with evidence-grounded hypotheses.');
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
    }, 100);

    setTimeout(() => {
      setHighlightedLogId(null);
    }, 3000);
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

  const getRuleBadge = (finding: DiagnosticFinding) => {
    switch (finding.rule_id) {
      case 'RULE_REPEATED_ERROR':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950/70 text-rose-300 border border-rose-800 flex items-center gap-1">
            <RefreshCw className="w-2.5 h-2.5" />
            REPEATED ERROR
          </span>
        );
      case 'RULE_ERROR_BURST':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950/70 text-purple-300 border border-purple-800 flex items-center gap-1">
            <Flame className="w-2.5 h-2.5" />
            ERROR BURST
          </span>
        );
      case 'RULE_REQUEST_WARNING_BEFORE_ERROR':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/70 text-amber-300 border border-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            WARNING → ERROR CASCADE
          </span>
        );
      case 'RULE_SERVICE_ERROR_CONCENTRATION':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950/70 text-sky-300 border border-sky-800 flex items-center gap-1">
            <Server className="w-2.5 h-2.5" />
            SERVICE CONCENTRATION
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
            {finding.rule_id}
          </span>
        );
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds && seconds !== 0) return '0s';
    if (seconds < 1.0) return `${Math.round(seconds * 1000)}ms`;
    if (seconds < 60.0) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const rem = Math.round(seconds % 60);
    return `${mins}m ${rem}s`;
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

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* Phase 4: AI Investigation Button */}
            <button
              onClick={handleRunInvestigation}
              disabled={isInvestigating}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-950/50 border border-violet-400/30 transition-all disabled:opacity-50"
              title="Generate evidence-backed diagnostic hypotheses using AI"
            >
              <Brain className={`w-3.5 h-3.5 text-violet-200 ${isInvestigating ? 'animate-pulse' : ''}`} />
              <span>{isInvestigating ? 'Investigating...' : 'AI Investigation'}</span>
            </button>

            {/* Phase 3: Deterministic Analysis Button */}
            <button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#161F30] hover:bg-[#1E293B] text-slate-200 border border-[#23314B] transition-colors disabled:opacity-50"
              title="Run deterministic pattern correlation"
            >
              <Activity className={`w-3.5 h-3.5 text-indigo-400 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Analyzing...' : 'Deterministic Analysis'}</span>
            </button>

            <button
              onClick={handleIngestSample}
              disabled={isIngesting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#161F30] hover:bg-indigo-950 text-indigo-300 border border-indigo-900/60 hover:border-indigo-600 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Sample Logs</span>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#161F30] hover:bg-[#1E293B] text-slate-200 border border-[#23314B] transition-colors"
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
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {ingestNotice}
          </span>
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

      {/* Navigation View Filter Tabs: All, AI Investigation, Deterministic */}
      <div className="flex items-center gap-2 border-b border-[#1F2937] pb-1 text-xs font-mono">
        <button
          onClick={() => setActiveViewSection('all')}
          className={`px-3 py-1 rounded transition-colors ${
            activeViewSection === 'all'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161F30]'
          }`}
        >
          All Panels
        </button>
        <button
          onClick={() => setActiveViewSection('ai')}
          className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
            activeViewSection === 'ai'
              ? 'bg-violet-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161F30]'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>AI Investigation {investigation ? `(${investigation.ranked_hypotheses.length})` : ''}</span>
        </button>
        <button
          onClick={() => setActiveViewSection('deterministic')}
          className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
            activeViewSection === 'deterministic'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161F30]'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Deterministic Findings {analysis ? `(${analysis.findings.length})` : ''}</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* PHASE 4: AI DIAGNOSTIC INVESTIGATION PANEL               */}
      {/* ========================================================= */}
      {(activeViewSection === 'all' || activeViewSection === 'ai') && (
        <section className="bg-[#0E1022] border border-violet-900/40 rounded-xl overflow-hidden shadow-xl shadow-black/50">
          <div className="px-5 py-4 border-b border-violet-900/40 bg-gradient-to-r from-[#12112A] to-[#171438] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-violet-950/80 border border-violet-700/80 text-violet-300">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                    Evidence-Grounded AI Investigation
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-violet-950 text-violet-300 border border-violet-700/60">
                    Phase 4 Active
                  </span>
                  {investigation && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
                      provider: {investigation.provider} ({investigation.model_name})
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Hypotheses synthesized strictly from verified telemetry events with server-side validation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {investigation && (
                <span className="text-[11px] font-mono text-slate-400">
                  {new Date(investigation.investigated_at).toLocaleTimeString()} UTC
                </span>
              )}
              <button
                onClick={handleRunInvestigation}
                disabled={isInvestigating}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md bg-violet-600 hover:bg-violet-500 text-white transition-all disabled:opacity-50"
              >
                <Brain className={`w-3.5 h-3.5 ${isInvestigating ? 'animate-pulse' : ''}`} />
                <span>{isInvestigating ? 'Investigating...' : 'Re-Investigate'}</span>
              </button>
            </div>
          </div>

          {/* AI Investigation Content Body */}
          {!investigation && !isInvestigating ? (
            <div className="p-8 text-center space-y-3">
              <Brain className="w-10 h-10 text-violet-400/80 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-200">No AI Investigation Stored Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Generate evidence-backed diagnostic hypotheses. The investigation analyzes deterministic correlations, ranks probable causes, and provides concrete debugging steps.
              </p>
              <button
                onClick={handleRunInvestigation}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-violet-600 hover:bg-violet-500 text-white shadow-md transition-all"
              >
                <Brain className="w-4 h-4" />
                <span>Run AI Investigation</span>
              </button>
            </div>
          ) : isInvestigating && !investigation ? (
            <div className="p-10 text-center space-y-3">
              <Brain className="w-8 h-8 text-violet-400 animate-pulse mx-auto" />
              <h3 className="text-sm font-semibold text-slate-200">Interpreting Diagnostic Patterns...</h3>
              <p className="text-xs text-slate-400">
                Synthesizing ranked diagnostic hypotheses with server-side evidence verification.
              </p>
            </div>
          ) : investigation ? (
            <div className="p-5 space-y-5">
              {/* Incident Narrative Summary */}
              <div className="p-4 rounded-lg bg-[#14122C] border border-violet-800/40 text-xs font-mono text-slate-200 leading-relaxed space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-violet-300 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                    Incident Narrative Synthesis
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    Verified References: {investigation.total_evidence_referenced} log IDs
                  </span>
                </div>
                <p className="text-slate-200 text-xs">{investigation.incident_summary}</p>
              </div>

              {/* Observed Facts */}
              {investigation.observed_facts.length > 0 && (
                <div className="p-3.5 rounded-lg bg-[#0F1424] border border-[#1F2937] space-y-2 text-xs">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Strictly Observed Telemetry Facts (Separated from Inferences)
                  </span>
                  <ul className="space-y-1 text-slate-300 font-mono text-[11px] list-disc list-inside">
                    {investigation.observed_facts.map((fact, fIdx) => (
                      <li key={fIdx}>{fact}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ranked Diagnostic Hypotheses */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <ListFilter className="w-3.5 h-3.5 text-violet-400" />
                    Ranked Diagnostic Hypotheses ({investigation.ranked_hypotheses.length})
                  </span>
                  <span className="text-slate-500 text-[10px]">
                    Non-probabilistic • Ranked by evidence coherence
                  </span>
                </div>

                {investigation.ranked_hypotheses.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-[#111827] rounded-lg border border-[#1F2937]">
                    No hypotheses generated. Telemetry is either empty or uninformative.
                  </div>
                ) : (
                  investigation.ranked_hypotheses.map((hypo) => (
                    <div
                      key={hypo.rank}
                      className="p-4 rounded-lg bg-[#11162B] border border-violet-900/30 hover:border-violet-700/60 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-950 text-violet-300 border border-violet-700/80">
                            Rank #{hypo.rank}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                            Status: {hypo.status}
                          </span>
                          <h4 className="text-xs font-bold text-slate-100">{hypo.title}</h4>
                        </div>
                      </div>

                      {/* Plausibility Reasoning */}
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {hypo.plausibility_reasoning}
                      </p>

                      {/* Supporting Evidence with Interactive Scroll Links */}
                      {hypo.supporting_evidence_ids.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap text-xs font-mono pt-1">
                          <span className="text-slate-400 text-[11px]">Supporting Evidence:</span>
                          {hypo.supporting_evidence_ids.map((logId) => (
                            <button
                              key={logId}
                              onClick={() => scrollToEvidenceLog(logId)}
                              className="px-2 py-0.5 rounded bg-[#1A1838] hover:bg-violet-950 text-violet-300 hover:text-violet-100 border border-violet-800/60 hover:border-violet-500 transition-all flex items-center gap-1 text-[10px]"
                              title={`Jump to log event ${logId}`}
                            >
                              <span>evt-{logId.slice(0, 8)}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Invalid Pruned Evidence Warning if any were rejected server-side */}
                      {hypo.invalid_evidence_ids && hypo.invalid_evidence_ids.length > 0 && (
                        <div className="p-2 rounded bg-amber-950/20 border border-amber-900/40 text-amber-300 text-[11px] font-mono flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>
                            Pruned {hypo.invalid_evidence_ids.length} unsupported reference(s) rejected by server-side validation.
                          </span>
                        </div>
                      )}

                      {/* Contradictory or Missing Evidence Callout */}
                      {hypo.contradictory_or_missing_evidence && (
                        <div className="p-2.5 rounded bg-[#0A0D18] border border-[#1F2937] text-[11px] font-mono text-slate-400 flex items-start gap-2">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-amber-300 font-semibold block text-[10px] uppercase">
                              Contradictory Signals & Telemetry Gaps:
                            </span>
                            <span>{hypo.contradictory_or_missing_evidence}</span>
                          </div>
                        </div>
                      )}

                      {/* Recommended Debugging Steps */}
                      {hypo.recommended_debugging_steps.length > 0 && (
                        <div className="pt-2 border-t border-[#1F2937] space-y-1.5">
                          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <CheckSquare className="w-3 h-3 text-emerald-400" />
                            <span>Recommended Debugging Actions</span>
                          </div>
                          <ul className="space-y-1 font-mono text-[11px] text-slate-300">
                            {hypo.recommended_debugging_steps.map((step, sIdx) => (
                              <li key={sIdx} className="flex items-start gap-1.5">
                                <span className="text-violet-400 select-none">›</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Explicit Uncertainty and Limitations */}
              {investigation.uncertainty_and_limitations.length > 0 && (
                <div className="p-3.5 rounded-lg bg-[#090C16] border border-[#1F2937] text-[11px] font-mono text-slate-400 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-300 font-bold text-[10px] uppercase tracking-wider">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Explicit Investigation Caveats & Limitations</span>
                  </div>
                  <ul className="space-y-1 list-disc list-inside text-slate-400 text-[10px]">
                    {investigation.uncertainty_and_limitations.map((lim, lIdx) => (
                      <li key={lIdx}>{lim}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </section>
      )}

      {/* ========================================================= */}
      {/* PHASE 3: DETERMINISTIC FAILURE CORRELATION & DIAGNOSTIC PANEL */}
      {/* ========================================================= */}
      {(activeViewSection === 'all' || activeViewSection === 'deterministic') && (
        <section className="bg-[#0D121F] border border-[#1F2937] rounded-xl overflow-hidden shadow-lg shadow-black/40">
          <div className="px-5 py-4 border-b border-[#1F2937] bg-gradient-to-r from-[#111827] to-[#161F30] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-950/60 border border-indigo-800/80 text-indigo-400">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                    Deterministic Failure Correlation Engine
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Phase 3 Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Evidence-backed, reproducible diagnostic synthesis without probabilistic speculation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {analysis && (
                <span className="text-[11px] font-mono text-slate-400">
                  Last analyzed: {new Date(analysis.analyzed_at).toLocaleTimeString()} UTC
                </span>
              )}
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-indigo-600/80 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzing ? 'Analyzing...' : 'Re-Analyze'}</span>
              </button>
            </div>
          </div>

          {/* Diagnostic Engine Content */}
          {!analysis && !isAnalyzing ? (
            <div className="p-8 text-center space-y-3">
              <ShieldAlert className="w-8 h-8 text-indigo-400/80 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-200">No Analysis Stored Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Run the deterministic correlation engine to inspect event patterns, cluster repeated error signatures, and reconstruct request-correlated degradation cascades.
              </p>
              <button
                onClick={handleRunAnalysis}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all"
              >
                <Activity className="w-4 h-4" />
                <span>Run Diagnostic Analysis</span>
              </button>
            </div>
          ) : isAnalyzing && !analysis ? (
            <div className="p-10 text-center space-y-3">
              <Activity className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <h3 className="text-sm font-semibold text-slate-200">Processing Log Telemetry...</h3>
              <p className="text-xs text-slate-400">
                Correlating request identifiers, grouping error signatures, and reconstructing timeline.
              </p>
            </div>
          ) : analysis ? (
            <div className="p-5 space-y-5">
              {/* Summary Metrics & Factual Synthesis */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937]">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Analyzed Logs</div>
                  <div className="text-lg font-bold text-slate-100 mt-0.5">{analysis.total_logs}</div>
                  <div className="text-[10px] text-slate-400 mt-1">100% telemetry coverage</div>
                </div>

                <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937]">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Time Window</div>
                  <div className="text-lg font-bold text-indigo-300 mt-0.5">
                    {formatDuration(analysis.time_window.duration_seconds)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 truncate">
                    {analysis.time_window.first_event_at
                      ? `${new Date(analysis.time_window.first_event_at).toLocaleTimeString()} - ${new Date(
                          analysis.time_window.last_event_at!,
                        ).toLocaleTimeString()}`
                      : 'N/A'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937]">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Diagnostic Findings</div>
                  <div className="text-lg font-bold text-amber-300 mt-0.5">{analysis.findings.length}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Evidence-backed rules</div>
                </div>

                <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937]">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Error Signatures</div>
                  <div className="text-lg font-bold text-rose-300 mt-0.5">{analysis.error_groups.length}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Unique normalized clusters</div>
                </div>
              </div>

              {/* Severity Distribution Bar */}
              <div className="p-3.5 rounded-lg bg-[#111827] border border-[#1F2937] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-300 font-medium">Telemetry Severity Breakdown</span>
                  <span className="font-mono text-slate-400 text-[11px]">
                    Total: {analysis.severity_distribution.total}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                  {analysis.severity_distribution.critical > 0 && (
                    <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[11px] font-bold">
                      CRITICAL: {analysis.severity_distribution.critical}
                    </span>
                  )}
                  {analysis.severity_distribution.error > 0 && (
                    <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/80 text-[11px] font-bold">
                      ERROR: {analysis.severity_distribution.error}
                    </span>
                  )}
                  {analysis.severity_distribution.warning > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[11px] font-bold">
                      WARNING: {analysis.severity_distribution.warning}
                    </span>
                  )}
                  {analysis.severity_distribution.info > 0 && (
                    <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[11px]">
                      INFO: {analysis.severity_distribution.info}
                    </span>
                  )}
                  {analysis.severity_distribution.debug > 0 && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]">
                      DEBUG: {analysis.severity_distribution.debug}
                    </span>
                  )}
                </div>
              </div>

              {/* Factual Summary Notice */}
              <div className="p-3.5 rounded-lg bg-[#080C14] border border-[#1F2937] text-xs font-mono text-slate-200 leading-relaxed flex items-start gap-3">
                <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-indigo-300 uppercase tracking-wider text-[10px] block mb-1">
                    Deterministic Observation Summary
                  </span>
                  <p>{analysis.summary}</p>
                </div>
              </div>

              {/* Tabs for Findings / Error Groups / Request Correlations */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#1F2937] pb-2 text-xs font-mono">
                  <button
                    onClick={() => setAnalysisTab('findings')}
                    className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                      analysisTab === 'findings'
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#161F30]'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Findings ({analysis.findings.length})</span>
                  </button>

                  <button
                    onClick={() => setAnalysisTab('groups')}
                    className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                      analysisTab === 'groups'
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#161F30]'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Error Groups ({analysis.error_groups.length})</span>
                  </button>

                  <button
                    onClick={() => setAnalysisTab('requests')}
                    className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                      analysisTab === 'requests'
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#161F30]'
                    }`}
                  >
                    <GitCommit className="w-3.5 h-3.5" />
                    <span>Request Traces ({analysis.request_correlations.length})</span>
                  </button>
                </div>

                {/* Subtab 1: Findings */}
                {analysisTab === 'findings' && (
                  <div className="space-y-3">
                    {analysis.findings.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 bg-[#111827] rounded-lg border border-[#1F2937]">
                        No deterministic rule violations detected for this telemetry window.
                      </div>
                    ) : (
                      analysis.findings.map((f, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-lg bg-[#111827] border border-[#1F2937] hover:border-[#374151] space-y-2.5 transition-all"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getRuleBadge(f)}
                              <h4 className="text-xs font-bold text-slate-100">{f.title}</h4>
                            </div>
                            {f.first_timestamp && (
                              <span className="text-[11px] font-mono text-slate-400">
                                {new Date(f.first_timestamp).toLocaleTimeString()} UTC
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed">{f.description}</p>

                          {/* Evidence References */}
                          {f.evidence_log_ids.length > 0 && (
                            <div className="pt-2 border-t border-[#1F2937] flex items-center gap-2 flex-wrap text-xs font-mono">
                              <span className="text-slate-400 text-[11px]">Supporting Evidence:</span>
                              {f.evidence_log_ids.map((logId) => (
                                <button
                                  key={logId}
                                  onClick={() => scrollToEvidenceLog(logId)}
                                  className="px-2 py-0.5 rounded bg-[#161F30] hover:bg-indigo-950 text-indigo-300 hover:text-indigo-200 border border-indigo-900/60 hover:border-indigo-600 transition-all flex items-center gap-1 text-[10px]"
                                  title={`Jump to log event ${logId}`}
                                >
                                  <span>evt-{logId.slice(0, 8)}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Subtab 2: Error Groups */}
                {analysisTab === 'groups' && (
                  <div className="space-y-3">
                    {analysis.error_groups.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 bg-[#111827] rounded-lg border border-[#1F2937]">
                        No error signatures encountered in the selected dataset.
                      </div>
                    ) : (
                      analysis.error_groups.map((group, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-lg bg-[#111827] border border-[#1F2937] space-y-3 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                {group.count} {group.count === 1 ? 'occurrence' : 'occurrences'}
                              </span>
                              {group.service_names.map((svc) => (
                                <span
                                  key={svc}
                                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700"
                                >
                                  {svc}
                                </span>
                              ))}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              First seen: {new Date(group.first_seen_at).toLocaleTimeString()} UTC
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                              Normalized Signature
                            </div>
                            <div className="p-2.5 rounded bg-[#090D15] border border-[#1F2937] font-mono text-[11px] text-amber-200">
                              {group.signature}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                              Sample Message
                            </div>
                            <div className="p-2.5 rounded bg-[#06090F] border border-[#1F2937] font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                              {group.sample_message}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#1F2937] font-mono text-[11px]">
                            <span className="text-slate-400">Evidence Logs:</span>
                            {group.evidence_log_ids.map((logId) => (
                              <button
                                key={logId}
                                onClick={() => scrollToEvidenceLog(logId)}
                                className="px-2 py-0.5 rounded bg-[#161F30] hover:bg-indigo-950 text-indigo-300 hover:text-indigo-200 border border-indigo-900/60 hover:border-indigo-600 transition-all flex items-center gap-1 text-[10px]"
                              >
                                <span>evt-{logId.slice(0, 8)}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Subtab 3: Request Correlations */}
                {analysisTab === 'requests' && (
                  <div className="space-y-3">
                    {analysis.request_correlations.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 bg-[#111827] rounded-lg border border-[#1F2937]">
                        No request IDs correlated in this incident's logs.
                      </div>
                    ) : (
                      analysis.request_correlations.map((req, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg bg-[#111827] border ${
                            req.warning_preceded_error
                              ? 'border-amber-700/80 bg-amber-950/10'
                              : req.has_error
                              ? 'border-rose-900/60'
                              : 'border-[#1F2937]'
                          } space-y-3 text-xs`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded font-mono font-bold bg-slate-800 text-indigo-300 border border-slate-700">
                                {req.request_id}
                              </span>
                              {req.warning_preceded_error && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Degradation Cascade (Warning → Error)
                                </span>
                              )}
                              {req.has_error && !req.warning_preceded_error && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                  Encountered Error
                                </span>
                              )}
                              {!req.has_error && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                                  Healthy Trace
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              {req.total_events} events • {new Date(req.first_event_at).toLocaleTimeString()} UTC
                            </span>
                          </div>

                          {req.service_names.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-slate-300">
                              <span className="text-slate-400">Trace Flow:</span>
                              {req.service_names.map((svc, sIdx) => (
                                <React.Fragment key={svc}>
                                  <span className="px-2 py-0.5 rounded bg-[#161F30] text-slate-200 border border-[#23314B]">
                                    {svc}
                                  </span>
                                  {sIdx < req.service_names.length - 1 && (
                                    <ArrowRight className="w-3 h-3 text-slate-500" />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#1F2937] font-mono text-[11px]">
                            <span className="text-slate-400">Correlated Events:</span>
                            {req.event_ids.map((logId) => (
                              <button
                                key={logId}
                                onClick={() => scrollToEvidenceLog(logId)}
                                className="px-2 py-0.5 rounded bg-[#161F30] hover:bg-indigo-950 text-indigo-300 hover:text-indigo-200 border border-indigo-900/60 hover:border-indigo-600 transition-all flex items-center gap-1 text-[10px]"
                              >
                                <span>evt-{logId.slice(0, 8)}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* ========================================================= */}
      {/* TIMELINE & LOG EXPLORER SECTION                           */}
      {/* ========================================================= */}
      <div className="space-y-4">
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
              const isHighlighted = highlightedLogId === log.id;

              return (
                <div
                  key={log.id}
                  id={`log-${log.id}`}
                  className={`bg-[#111827] border rounded-lg p-4 space-y-2 transition-all font-mono text-xs ${
                    isHighlighted
                      ? 'border-violet-500 ring-2 ring-violet-500/60 bg-[#161F38] shadow-lg shadow-violet-950'
                      : 'border-[#1F2937] hover:border-[#374151]'
                  }`}
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

                      <span className="text-[10px] text-slate-500">id: {log.id.slice(0, 8)}</span>
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
      </div>

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
