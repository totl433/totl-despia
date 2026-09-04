import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { isChunkLoadError, reloadForStaleChunk } from '../lib/lazyWithReload';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reloading: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, reloading: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // After deploys, Safari often keeps an old shell and fails to load new hashed chunks.
    if (isChunkLoadError(error) && reloadForStaleChunk()) {
      this.setState({ reloading: true });
      return;
    }

    try {
      const crashLog = {
        timestamp: Date.now(),
        errorMessage: error?.message || 'Unknown error',
        errorStack: error?.stack || 'No stack trace',
        componentStack: errorInfo?.componentStack || 'No component stack',
        url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      };

      const existingCrashes = localStorage.getItem('app_crashes');
      const crashes = existingCrashes ? JSON.parse(existingCrashes) : [];
      crashes.push(crashLog);

      const recentCrashes = crashes.slice(-50);
      localStorage.setItem('app_crashes', JSON.stringify(recentCrashes));
    } catch (e) {
      console.error('[ErrorBoundary] Failed to store crash in localStorage:', e);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (this.state.reloading || (this.state.error && isChunkLoadError(this.state.error))) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
              <h1 className="text-xl font-semibold text-slate-900 mb-2">Updating…</h1>
              <p className="text-slate-600 mb-4">
                Loading the latest version. This only takes a moment.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg"
              >
                Reload now
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-slate-600 mb-4">
              The app encountered an error. Please try refreshing.
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg"
            >
              Reload App
            </button>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-sm text-slate-500 cursor-pointer">Error details</summary>
                <pre className="mt-2 text-xs bg-slate-100 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
