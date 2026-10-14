import React from 'react';

interface StatusBadgeProps {
  status: 'healthy' | 'unhealthy' | 'warning' | 'loading' | 'disconnected';
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className = '',
}) => {
  const configs = {
    healthy: {
      bg: 'bg-emerald-950/60',
      text: 'text-emerald-400',
      border: 'border-emerald-800/60',
      dot: 'bg-emerald-400',
      defaultLabel: 'Operational',
    },
    unhealthy: {
      bg: 'bg-rose-950/60',
      text: 'text-rose-400',
      border: 'border-rose-800/60',
      dot: 'bg-rose-400',
      defaultLabel: 'Unreachable',
    },
    warning: {
      bg: 'bg-amber-950/60',
      text: 'text-amber-400',
      border: 'border-amber-800/60',
      dot: 'bg-amber-400',
      defaultLabel: 'Degraded',
    },
    loading: {
      bg: 'bg-slate-800/80',
      text: 'text-slate-400',
      border: 'border-slate-700',
      dot: 'bg-slate-400 animate-pulse',
      defaultLabel: 'Checking...',
    },
    disconnected: {
      bg: 'bg-slate-900',
      text: 'text-slate-400',
      border: 'border-slate-800',
      dot: 'bg-slate-500',
      defaultLabel: 'Offline',
    },
  };

  const config = configs[status];
  const displayLabel = label || config.defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {displayLabel}
    </span>
  );
};

export default StatusBadge;
