import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Layers,
  X,
  Search,
} from 'lucide-react';
import { fetchIncidents, createIncident } from '../api/incidents';
import type { Incident, IncidentStatus } from '../types/incident';
import IncidentStatusBadge from '../components/IncidentStatusBadge';

export const IncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search and status filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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
      const data = await fetchIncidents(0, 100);
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

  // Filtered incidents based on search query and status filter
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const matchesStatus = statusFilter === 'ALL' || inc.status.toLowerCase() === statusFilter.toLowerCase();
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        inc.title.toLowerCase().includes(query) ||
        inc.id.toLowerCase().includes(query) ||
        (inc.description && inc.description.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [incidents, statusFilter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#1E293B]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Incident Workspace
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Captured failure telemetry, correlated trace chains, and automated diagnostic reports
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={loadIncidents}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-[#162032] hover:bg-[#1E293B] text-slate-200 border border-[#2B3B53] transition-colors disabled:opacity-50"
            title="Refresh incident list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Incident</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-lg bg-red-950/30 border border-red-800/60 p-3.5 text-red-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter by title, ID, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#0B0F17] border border-[#1E293B] rounded text-slate-200 placeholder-slate-500 text-xs font-mono focus:outline-hidden focus:border-blue-500"
          />
        </div>

        {/* Status Filters & Total Count */}
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <div className="flex items-center gap-1">
            {['ALL', 'OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-[#162032] text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-mono text-slate-400 hidden lg:inline">
            {filteredIncidents.length} of {total}
          </span>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden">
        {isLoading && incidents.length === 0 ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-[#162032]/60 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <div className="font-semibold text-slate-300">No matching incidents found</div>
            <p className="max-w-sm mx-auto text-slate-500">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try clearing the search query or status filter.'
                : 'Create an incident to begin recording failure telemetry.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#0E131F] text-slate-400 text-[11px] font-mono border-b border-[#1E293B]">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Incident & Metadata</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Telemetry Log Count</th>
                  <th className="py-2.5 px-4 font-medium">Created (UTC)</th>
                  <th className="py-2.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {filteredIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-[#162032]/40 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        to={`/incidents/${inc.id}`}
                        className="font-semibold text-slate-100 hover:text-blue-400 transition-colors"
                      >
                        {inc.title}
                      </Link>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>id: {inc.id.slice(0, 8)}</span>
                        {inc.description && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400 truncate max-w-md">{inc.description}</span>
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#162032] hover:bg-[#1E293B] text-blue-400 hover:text-blue-300 border border-[#2B3B53] text-xs font-mono transition-colors"
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
      </div>

      {/* Create Incident Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg max-w-md w-full p-5 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
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
              <div className="p-2.5 rounded bg-red-950/40 border border-red-800 text-red-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1 font-mono text-[11px]">
                  Incident Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., POST /checkout - 504 Gateway Timeout"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0B0F17] border border-[#1E293B] rounded text-slate-200 font-mono text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1 font-mono text-[11px]">
                  Description / Operational Context
                </label>
                <textarea
                  rows={3}
                  placeholder="Observed latency degradation, socket timeouts, or customer impact..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#0B0F17] border border-[#1E293B] rounded text-slate-200 font-mono text-xs focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1 font-mono text-[11px]">
                  Initial Lifecycle Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as IncidentStatus)}
                  className="w-full px-3 py-1.5 bg-[#0B0F17] border border-[#1E293B] rounded text-slate-200 font-mono text-xs focus:outline-hidden focus:border-blue-500"
                >
                  <option value="open">open (Active Failure)</option>
                  <option value="investigating">investigating (Telemetry Triage)</option>
                  <option value="mitigated">mitigated (Workaround Applied)</option>
                  <option value="resolved">resolved (Remediated)</option>
                  <option value="closed">closed (Completed)</option>
                </select>
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
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
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
