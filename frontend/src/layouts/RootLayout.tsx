import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Terminal, Shield, BookOpen } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

interface RootLayoutProps {
  isBackendHealthy?: boolean | null;
  isLoading?: boolean;
}

export const RootLayout: React.FC<RootLayoutProps> = ({
  isBackendHealthy = null,
  isLoading = false,
}) => {
  const location = useLocation();

  const isNavActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-200 flex flex-col font-sans selection:bg-blue-900 selection:text-white">
      {/* Developer Console Top Navigation Bar */}
      <header className="border-b border-[#1E293B] bg-[#0E131F] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Product Brand & Primary Navigation */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded bg-[#162032] border border-[#2B3B53] flex items-center justify-center text-blue-400 group-hover:border-blue-500 transition-colors">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-sm tracking-tight text-slate-100">TraceLens</span>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-[#1E293B] text-slate-400 border border-[#334155]">
                  CORE
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-1">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  isNavActive('/')
                    ? 'text-slate-100 bg-[#1E293B] border border-[#334155]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#162032]'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/incidents"
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  isNavActive('/incidents')
                    ? 'text-slate-100 bg-[#1E293B] border border-[#334155]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#162032]'
                }`}
              >
                Incidents
              </Link>
            </nav>
          </div>

          {/* Right Status & System Connectivity Indicators */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">Backend:</span>
              {isLoading ? (
                <StatusBadge status="loading" label="Checking" />
              ) : isBackendHealthy === true ? (
                <StatusBadge status="healthy" label="Online" />
              ) : isBackendHealthy === false ? (
                <StatusBadge status="unhealthy" label="Unreachable" />
              ) : (
                <StatusBadge status="disconnected" label="Connecting" />
              )}
            </div>

            <div className="h-3.5 w-px bg-[#1E293B] hidden sm:block" />

            <a
              href="http://127.0.0.1:8000/api/docs"
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono text-slate-400 hover:text-slate-200 bg-[#111827] border border-[#1E293B] hover:border-slate-700 transition-colors"
              title="Open OpenAPI Swagger Documentation"
            >
              <BookOpen className="w-3 h-3 text-slate-500" />
              <span>Swagger API</span>
            </a>

            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-[#111827] px-2 py-1 rounded border border-[#1E293B]">
              <Terminal className="w-3 h-3 text-slate-500" />
              <span>v0.1.0</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Surface */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      {/* Engineering Footer */}
      <footer className="border-t border-[#1E293B] py-3 bg-[#0B0F17] text-[11px] text-slate-400 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>TraceLens AI</span>
            <span>•</span>
            <span className="text-slate-400">Deterministic Failure Correlation & AI Diagnostic Investigation</span>
          </div>
          <div className="text-slate-400">
            FastAPI + MongoDB 7.0 + Vite React
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RootLayout;
