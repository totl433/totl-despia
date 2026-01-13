import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
 children: ReactNode;
 fallback?: ReactNode;
}

interface State {
 hasError: boolean;
 error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
 constructor(props: Props) {
 super(props);
 this.state = { hasError: false, error: null };
 }

 static getDerivedStateFromError(error: Error): State {
 return { hasError: true, error };
 }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    // Store crash in localStorage for AdminData page
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
      
      // Keep only last 50 crashes
      const recentCrashes = crashes.slice(-50);
      localStorage.setItem('app_crashes', JSON.stringify(recentCrashes));
    } catch (e) {
      console.error('[ErrorBoundary] Failed to store crash in localStorage:', e);
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ErrorBoundary:componentDidCatch',message:'Error boundary caught error',data:{errorMessage:error?.message,errorStack:error?.stack,componentStack:errorInfo?.componentStack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
    // #endregion
  }

 render() {
 if (this.state.hasError) {
 if (this.props.fallback) {
 return this.props.fallback;
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
 </details>)}
 </div>
 </div>);
 }

 return this.props.children;
 }
}

