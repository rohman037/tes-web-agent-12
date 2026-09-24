import React from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface FallbackProps {
  error: Error;
  resetError: () => void;
}

export const ErrorFallback: React.FC<FallbackProps> = ({ error, resetError }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl text-center space-y-5">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">Terjadi Kendala pada Tampilan</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Sistem telah mencatat kejadian ini secara otomatis untuk investigasi keandalan. Anda dapat memuat ulang aplikasi untuk melanjutkan.
          </p>
        </div>

        {error?.message && (
          <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs font-mono text-slate-400 text-left overflow-x-auto max-h-24">
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={resetError}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            Coba Lagi
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition-all active:scale-95"
          >
            <Home className="w-4 h-4" />
            Beranda
          </a>
        </div>
      </div>
    </div>
  );
};

export const SentryErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Sentry.ErrorBoundary fallback={({ error, resetError }) => <ErrorFallback error={error as Error} resetError={resetError} />}>
      {children}
    </Sentry.ErrorBoundary>
  );
};

export default SentryErrorBoundary;
