import React from 'react';
import type { IncidentStatus } from '../types/incident';

interface IncidentStatusBadgeProps {
  status: IncidentStatus | string;
}

export const IncidentStatusBadge: React.FC<IncidentStatusBadgeProps> = ({ status }) => {
  const s = (status || 'open').toLowerCase();

  switch (s) {
    case 'open':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-red-950/40 text-red-300 border border-red-800/60 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          open
        </span>
      );
    case 'investigating':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-950/40 text-amber-300 border border-amber-800/60 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          investigating
        </span>
      );
    case 'mitigated':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-950/40 text-blue-300 border border-blue-800/60 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          mitigated
        </span>
      );
    case 'resolved':
    case 'closed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/60 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {s}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          {s}
        </span>
      );
  }
};

export default IncidentStatusBadge;
