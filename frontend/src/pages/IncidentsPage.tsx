import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSearch,
  Plus,
  RefreshCw,
  AlertCircle,
  Clock,
  ArrowRight,
  Layers,
  X,
} from 'lucide-react';
import { fetchIncidents, createIncident } from '../api/incidents';
import type { Incident, IncidentStatus } from '../types/incident';

export const IncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Create Incident Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [status, setStatus] = useState<IncidentStatus>('open');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadIncidents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchIncidents(0, 50);
      setIncidents(data.items);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load incidents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Incident title is required');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await createIncident({
        title: title.trim(),
        description: description.trim() || undefined,
        status,
      });
      setTitle('');
      setDescription('');
      setStatus('open');
      setIsModalOpen(false);
      await loadIncidents();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || err.message || 'Failed to create incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (statusVal: string) => {
    switch (statusVal) {
      case 'open':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-rose-950/80 text-rose-300 border border-rose-800/60">
            open
          </span>
        );
      case 'investigating':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-950/80 text-amber-300 border border-amber-800/60">
            investigating
          </span>
        );
      case 'resolved':
      case 'closed':
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
            {statusVal}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
            {statusVal}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#1F2937]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <FileSearch className="w-6 h-6 text-indigo-400" />
            Failure Incidents
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage captured API failures, correlate log telemetry, and trace root causes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadIncidents}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#161F30] hover:bg-[#1E293B] text-slate-200 border border-[#23314B] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Incident</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-lg bg-rose-950/30 border border-rose-800/60 p-4 text-rose-200 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && incidents.length === 0 && (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#111827] border border-[#1F2937] rounded-lg p-5 animate-pulse space-y-3"
            >
              <div className="h-5 bg-slate-800 rounded w-1/3" />
              <div className="h-4 bg-slate-800/60 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && incidents.length === 0 && (
        <div className="border border-dashed border-[#1F2937] rounded-lg p-12 text-center bg-[#0E131F]/40">
          <FileSearch className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-200 mb-1">No incidents recorded yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Register a failure investigation or trigger a simulated API crash to ingest telemetry logs.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Incident</span>
          </button>
        </div>
      )}

      {/* Incident List */}
      {!isLoading && incidents.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-mono text-slate-400 flex items-center justify-between px-1">
            <span>Showing {incidents.length} of {total} incidents</span>
            <span>Sorted by Latest First</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                className="bg-[#111827] border border-[#1F2937] hover:border-[#374151] rounded-lg p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    {getStatusBadge(incident.status)}
                    <h2 className="text-base font-semibold text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                      {incident.title}
                    </h2>
                  </div>

                  {incident.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {incident.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs font-mono text-slate-400 pt-1">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(incident.created_at).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{incident.log_count} log{incident.log_count === 1 ? '' : 's'}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                  <Link
                    to={`/incidents/${incident.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#161F30] hover:bg-indigo-950 text-indigo-300 border border-indigo-900/60 hover:border-indigo-600 transition-all"
                  >
                    <span>Timeline & Logs</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Incident Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#111827] border border-[#1F2937] rounded-lg max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2937]">
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                Register New Failure Incident
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Incident Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., POST /api/v1/orders/checkout - 504 Gateway Timeout"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0F17] border border-[#1F2937] rounded-md text-sm text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description / Context
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the symptoms, impacted endpoints, or error rates..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B0F17] border border-[#1F2937] rounded-md text-sm text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Initial Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as IncidentStatus)}
                  className="w-full px-3 py-2 bg-[#0B0F17] border border-[#1F2937] rounded-md text-sm text-slate-200 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="open">Open (Newly detected)</option>
                  <option value="investigating">Investigating (Triage active)</option>
                  <option value="mitigated">Mitigated</option>
                  <option value="resolved">Resolved</option>
                </select>
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
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Creating...' : 'Create Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentsPage;
