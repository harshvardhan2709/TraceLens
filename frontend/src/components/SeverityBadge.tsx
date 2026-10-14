import React from 'react';
import type { LogSeverity } from '../types/incident';

interface SeverityBadgeProps {
  severity: LogSeverity | string;
  size?: 'sm' | 'md';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'md' }) => {
  const sev = (severity || 'INFO').toUpperCase();
  const baseClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded'
    : 'px-2 py-0.5 text-[11px] font-mono font-semibold rounded';

  switch (sev) {
    case 'CRITICAL':
      return (
        <span className={`${baseClasses} bg-red-950/70 text-red-300 border border-red-800/80`}>
          CRITICAL
        </span>
      );
    case 'ERROR':
      return (
        <span className={`${baseClasses} bg-red-950/50 text-red-300 border border-red-800/60`}>
          ERROR
        </span>
      );
    case 'WARNING':
    case 'WARN':
      return (
        <span className={`${baseClasses} bg-amber-950/50 text-amber-300 border border-amber-800/60`}>
          WARN
        </span>
      );
    case 'INFO':
      return (
        <span className={`${baseClasses} bg-blue-950/50 text-blue-300 border border-blue-800/60`}>
          INFO
        </span>
      );
    case 'DEBUG':
    default:
      return (
        <span className={`${baseClasses} bg-slate-800/70 text-slate-400 border border-slate-700`}>
          DEBUG
        </span>
      );
  }
};

export default SeverityBadge;
