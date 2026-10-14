import React, { type ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  statusBadge?: ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  statusBadge,
  className = '',
}) => {
  return (
    <div
      className={`bg-[#111827] border border-[#1F2937] rounded-lg p-5 shadow-sm transition-all hover:border-[#374151] ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span>{title}</span>
        </div>
        {statusBadge && <div>{statusBadge}</div>}
      </div>
      <div className="text-xl font-semibold text-slate-100 tracking-tight mb-1">
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-slate-400 font-mono truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
};

export default MetricCard;
