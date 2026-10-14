import React from 'react';
import { ExternalLink } from 'lucide-react';

interface EvidenceReferenceProps {
  id: string;
  onClick?: (id: string) => void;
  className?: string;
}

export const EvidenceReference: React.FC<EvidenceReferenceProps> = ({ id, onClick, className = '' }) => {
  const shortId = id.length > 8 ? id.slice(0, 8) : id;

  return (
    <button
      type="button"
      onClick={() => onClick && onClick(id)}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-[#1E293B] hover:bg-[#283548] text-slate-300 hover:text-blue-300 border border-[#334155] hover:border-blue-500/60 transition-colors ${className}`}
      title={`Inspect log event ${id}`}
    >
      <span>evt-{shortId}</span>
      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
    </button>
  );
};

export default EvidenceReference;
