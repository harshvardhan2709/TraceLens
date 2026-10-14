import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Activity, Terminal } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

interface RootLayoutProps {
  isBackendHealthy?: boolean | null;
  isLoading?: boolean;
}

export const RootLayout: React.FC<RootLayoutProps> = ({
  isBackendHealthy = null,
  isLoading = false,
}) => {
  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-200 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-[#1F2937] bg-[#0E131F]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-md bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400 group-hover:border-indigo-500 transition-colors">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-base text-slate-100 tracking-tight">TraceLens</span>
                <span className="ml-1 text-xs font-mono font-medium px-1.5 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-800/40">AI</span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/"
                className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-200 bg-[#161F30] border border-[#23314B]"
              >
                Dashboard
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">Backend API:</span>
              {isLoading ? (
                <StatusBadge status="loading" label="Checking" />
              ) : isBackendHealthy === true ? (
                <StatusBadge status="healthy" label="Online" />
              ) : isBackendHealthy === false ? (
                <StatusBadge status="unhealthy" label="Unreachable" />
              ) : (
                <StatusBadge status="disconnected" label="Connecting..." />
              )}
            </div>

            <div className="h-4 w-px bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-[#111827] px-2.5 py-1 rounded border border-[#1F2937]">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>v0.1.0</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1F2937] py-4 bg-[#0B0F17] text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>TraceLens AI — API Failure Investigation & Regression Testing Platform</div>
          <div className="font-mono text-slate-400">FastAPI + MongoDB + Vite React</div>
        </div>
      </footer>
    </div>
  );
};

export default RootLayout;
