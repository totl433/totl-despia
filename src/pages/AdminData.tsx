import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getDataFetchLogs, clearDataFetchLogs } from '../lib/dataFetchLogger';

export default function AdminDataPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Admin check
  const isAdmin = user?.id === '4542c037-5b38-40d0-b189-847b8f17c222' || user?.id === '36f31625-6d6c-4aa4-815a-1493a812841b';
  
  const [despiaDetected, setDespiaDetected] = useState<boolean | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationResult, setNotificationResult] = useState<string | null>(null);
  const [crashes, setCrashes] = useState<any[]>([]);
  const [dataHealth, setDataHealth] = useState<any>(null);
  const [checkingDataHealth, setCheckingDataHealth] = useState(false);
  const [fetchLogs, setFetchLogs] = useState<any[]>([]);
  const [copiedAllLogs, setCopiedAllLogs] = useState(false);
  const [messageSubscriptionLogs, setMessageSubscriptionLogs] = useState<any[]>([]);

  // Redirect if not admin
  useEffect(() => {
    if (user && !isAdmin) {
      navigate('/profile');
    }
  }, [user, isAdmin, navigate]);

  // Poll for Despia API availability (simplified)
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 40;
    
    const checkDespia = () => {
      const directPlayerId = 
        (globalThis as any)?.onesignalplayerid ||
        (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null);
      
      if (directPlayerId) {
        setDespiaDetected(true);
        setPlayerId(String(directPlayerId));
        return true;
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(checkDespia, 500);
      } else {
        setDespiaDetected(false);
      }
      return false;
    };
    
    checkDespia();
  }, []);

  // Load crashes and fetch logs
  useEffect(() => {
    try {
      const storedCrashes = localStorage.getItem('app_crashes');
      if (storedCrashes) {
        setCrashes(JSON.parse(storedCrashes));
      }
    } catch (e) {
      console.error('[AdminData] Failed to load crashes:', e);
    }

    try {
      const logs = getDataFetchLogs();
      setFetchLogs(logs);
    } catch (e) {
      console.error('[AdminData] Failed to load fetch logs:', e);
    }

    try {
      const subLogs = localStorage.getItem('message_subscription_logs');
      if (subLogs) {
        setMessageSubscriptionLogs(JSON.parse(subLogs));
      }
    } catch (e) {
      console.error('[AdminData] Failed to load subscription logs:', e);
    }
  }, []);

  // Check data health
  const checkDataHealth = async () => {
    setCheckingDataHealth(true);
    try {
      const health: any = {
        timestamp: Date.now(),
        checks: {},
        issues: [],
      };

      // Check meta table
      const { data: meta, error: metaError } = await supabase.from('meta').select('*').limit(1);
      health.checks.meta = {
        exists: !metaError && meta && meta.length > 0,
        error: metaError?.message,
      };
      if (metaError || !meta || meta.length === 0) {
        health.issues.push('meta table missing or empty');
      }

      // Check fixtures
      const { data: fixtures, error: fixturesError } = await supabase.from('fixtures').select('id').limit(1);
      health.checks.fixtures = {
        exists: !fixturesError && fixtures && fixtures.length > 0,
        error: fixturesError?.message,
      };
      if (fixturesError || !fixtures || fixtures.length === 0) {
        health.issues.push('fixtures table missing or empty');
      }

      // Check live_scores
      const { error: liveScoresError } = await supabase.from('live_scores').select('id').limit(1);
      health.checks.live_scores = {
        exists: !liveScoresError,
        error: liveScoresError?.message,
      };

      // Check app_gw_results view
      const { error: gwResultsError } = await supabase.from('app_gw_results').select('*').limit(1);
      health.checks.app_gw_results = {
        exists: !gwResultsError,
        error: gwResultsError?.message,
      };

      // Check push_subscriptions
      const { error: subsError } = await supabase.from('push_subscriptions').select('id').limit(1);
      health.checks.push_subscriptions = {
        exists: !subsError,
        error: subsError?.message,
      };

      // Check league_members
      const { error: membersError } = await supabase.from('league_members').select('id').limit(1);
      health.checks.league_members = {
        exists: !membersError,
        error: membersError?.message,
      };

      setDataHealth(health);
    } catch (error: any) {
      console.error('[AdminData] Error checking data health:', error);
      setDataHealth({
        timestamp: Date.now(),
        error: error.message,
        checks: {},
        issues: ['Failed to check data health'],
      });
    } finally {
      setCheckingDataHealth(false);
    }
  };

  // Copy all logs to clipboard
  const copyAllLogs = async () => {
    try {
      const report = {
        timestamp: new Date().toISOString(),
        user: user?.id || 'unknown',
        despiaDetected,
        playerId: playerId ? playerId.slice(0, 8) + '...' : null,
        
        crashes: crashes.length > 0 ? crashes.slice(-10).reverse().map((c: any) => ({
          timestamp: new Date(c.timestamp).toISOString(),
          errorMessage: c.errorMessage,
          url: c.url,
        })) : [],
        
        dataHealth: dataHealth ? {
          timestamp: new Date(dataHealth.timestamp).toISOString(),
          issues: dataHealth.issues || [],
          checks: dataHealth.checks || {},
        } : null,
        
        dataFetches: fetchLogs.slice(-20).reverse().map((log: any) => ({
          timestamp: new Date(log.timestamp).toISOString(),
          location: log.location,
          query: log.query,
          table: log.table,
          result: log.result,
          rowCount: log.rowCount,
          error: log.error,
        })),
        
        messageSubscriptions: messageSubscriptionLogs.slice(-20).reverse().map((log: any) => ({
          timestamp: new Date(log.timestamp).toISOString(),
          leagueId: log.leagueId,
          status: log.status,
          channel: log.channel,
        })),
        
        deepLink: (() => {
          try {
            const debugInfo = localStorage.getItem('deepLink_debug');
            const result = localStorage.getItem('deepLink_result');
            return {
              debug: debugInfo ? JSON.parse(debugInfo) : null,
              result: result ? JSON.parse(result) : null,
            };
          } catch (e) {
            return null;
          }
        })(),
        
        notifications: (() => {
          try {
            const logs = localStorage.getItem('notification_logs');
            return logs ? JSON.parse(logs).slice(-10).reverse() : [];
          } catch (e) {
            return [];
          }
        })(),
      };

      const reportText = `=== TOTL DEBUG REPORT ===
Date: ${report.timestamp}
User: ${report.user}
Despia: ${report.despiaDetected ? 'Yes' : 'No'}
Player ID: ${report.playerId || 'Not available'}

=== CRASHES ===
${report.crashes.length > 0 ? report.crashes.map((c: any) => `[${c.timestamp}] ${c.errorMessage}\n  URL: ${c.url}`).join('\n\n') : 'No crashes recorded'}

=== DATA HEALTH ===
${report.dataHealth ? `Checked: ${report.dataHealth.timestamp}\nIssues: ${report.dataHealth.issues.length > 0 ? report.dataHealth.issues.join(', ') : 'None'}\n\nChecks:\n${Object.entries(report.dataHealth.checks).map(([key, value]: [string, any]) => `  ${key}: ${value.exists ? '✅' : '❌'} ${value.error || ''}`).join('\n')}` : 'Not checked yet'}

=== DATA FETCHES (Last 20) ===
${report.dataFetches.map((log: any) => `[${log.timestamp}] ${log.location} - ${log.query}\n  Table: ${log.table}\n  Result: ${log.result} ${log.rowCount !== undefined ? `(${log.rowCount} rows)` : ''}${log.error ? `\n  Error: ${log.error}` : ''}`).join('\n\n')}

=== DEEP LINK DEBUG ===
${report.deepLink ? JSON.stringify(report.deepLink, null, 2) : 'No deep link attempts'}

=== NOTIFICATION LOGS ===
${report.notifications.length > 0 ? report.notifications.map((log: any) => `[${new Date(log.timestamp).toISOString()}] ${log.ok ? 'OK' : 'Failed'} - Sent: ${log.sent || 0}`).join('\n') : 'No notification attempts'}

=== MESSAGE SUBSCRIPTION LOGS ===
${report.messageSubscriptions && report.messageSubscriptions.length > 0 ? report.messageSubscriptions.map((log: any) => `[${log.timestamp}] League ${log.leagueId?.slice(0, 8)}... - Status: ${log.status} - Channel: ${log.channel}`).join('\n') : 'No subscription logs'}

=== MESSAGE FETCHES (from Data Fetch Logs) ===
${report.dataFetches.filter((log: any) => log.table === 'league_messages' || log.query?.toLowerCase().includes('message')).map((log: any) => `[${log.timestamp}] ${log.location} - ${log.query}\n  Table: ${log.table}\n  Result: ${log.result} ${log.rowCount !== undefined ? `(${log.rowCount} rows)` : ''}${log.error ? `\n  Error: ${log.error}` : ''}`).join('\n\n') || 'No message-related fetches yet'}`;

      await navigator.clipboard.writeText(reportText);
      setCopiedAllLogs(true);
      setTimeout(() => setCopiedAllLogs(false), 3000);
    } catch (error: any) {
      console.error('[AdminData] Failed to copy logs:', error);
      alert('Failed to copy logs: ' + error.message);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-600 mb-4">Please sign in to view admin data.</div>
          <Link to="/profile" className="text-[#1C8376]">Go to Profile</Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-600 mb-4">Access denied. Admin only.</div>
          <Link to="/profile" className="text-[#1C8376]">Go to Profile</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-800">Admin Data</h1>
            <Link to="/profile" className="text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </div>
          <p className="text-slate-600 text-sm mb-4">
            Admin tools for debugging and managing data.
          </p>
          
          {/* Copy All Logs Button */}
          <button
            onClick={copyAllLogs}
            className={`w-full py-3 font-semibold rounded-xl text-center transition-colors ${
              copiedAllLogs
                ? 'bg-emerald-600 text-white'
                : 'bg-[#1C8376] text-white hover:bg-[#156d62]'
            }`}
          >
            {copiedAllLogs ? '✅ Logs Copied! Paste to share' : '📋 Copy All Logs'}
          </button>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Copies all diagnostic logs in an easy-to-share format
          </p>
        </div>

        {/* Status Display */}
        {playerId && (
          <div className="mb-6 bg-white rounded-xl shadow-md p-4">
            <div className="text-sm">
              <span className="text-slate-600">Player ID: </span>
              <span className="font-mono text-xs text-slate-700">{playerId.slice(0, 8)}…{playerId.slice(-4)}</span>
            </div>
          </div>
        )}

        {/* Crash Logs */}
        <div className="mb-6 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">💥 Crash Logs</h3>
          <div className="space-y-3">
            {crashes.length > 0 ? (
              <>
                <div className="text-sm text-slate-600 mb-2">
                  Total crashes: {crashes.length} (showing last 10)
                </div>
                {crashes.slice(-10).reverse().map((crash: any, idx: number) => (
                  <div key={idx} className="p-3 bg-red-50 rounded-lg border border-red-200 text-xs">
                    <div className="font-semibold text-red-800 mb-1">
                      {new Date(crash.timestamp).toLocaleString()}
                    </div>
                    <div className="text-red-700 mb-2">{crash.errorMessage}</div>
                    <details className="text-red-600">
                      <summary className="cursor-pointer">Stack trace</summary>
                      <pre className="mt-2 whitespace-pre-wrap break-all text-xs bg-red-100 p-2 rounded">
                        {crash.errorStack}
                      </pre>
                    </details>
                    {crash.componentStack && (
                      <details className="text-red-600 mt-2">
                        <summary className="cursor-pointer">Component stack</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-all text-xs bg-red-100 p-2 rounded">
                          {crash.componentStack}
                        </pre>
                      </details>
                    )}
                    <div className="text-red-600 mt-2 text-xs">
                      URL: {crash.url}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    localStorage.removeItem('app_crashes');
                    setCrashes([]);
                  }}
                  className="w-full py-2 bg-red-600 text-white font-medium rounded-lg text-sm"
                >
                  Clear All Crashes
                </button>
              </>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                No crashes recorded. The app is running smoothly! 🎉
              </div>
            )}
          </div>
        </div>

        {/* Data Fetch Logs */}
        <div className="mb-6 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">📊 Data Fetch Logs</h3>
          <div className="space-y-3">
            {fetchLogs.length > 0 ? (
              <>
                <div className="text-sm text-slate-600 mb-2">
                  Total fetches: {fetchLogs.length} (showing last 15)
                </div>
                {fetchLogs.slice(-15).reverse().map((log: any, idx: number) => (
                  <div key={idx} className={`p-3 rounded-lg border text-xs ${
                    log.result === 'error' 
                      ? 'bg-red-50 border-red-200' 
                      : log.result === 'empty'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="font-semibold mb-1">
                      {new Date(log.timestamp).toLocaleString()} - {log.location}
                    </div>
                    <div className="text-slate-700 mb-1">
                      <strong>Query:</strong> {log.query}
                    </div>
                    <div className="text-slate-600 mb-1">
                      <strong>Table:</strong> {log.table}
                      {log.filters && Object.keys(log.filters).length > 0 && (
                        <span className="ml-2">({JSON.stringify(log.filters)})</span>
                      )}
                    </div>
                    <div className={`font-medium ${
                      log.result === 'error' ? 'text-red-600' :
                      log.result === 'empty' ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>
                      Result: {log.result === 'error' ? '❌ Error' : log.result === 'empty' ? '⚠️ Empty' : '✅ Success'}
                      {log.rowCount !== undefined && ` (${log.rowCount} rows)`}
                      {log.error && ` - ${log.error}`}
                    </div>
                    {log.dataPreview && log.result === 'success' && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-slate-500">Data preview</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-all text-xs bg-white p-2 rounded border">
                          {JSON.stringify(log.dataPreview, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => {
                    clearDataFetchLogs();
                    setFetchLogs([]);
                  }}
                  className="w-full py-2 bg-slate-200 text-slate-700 font-medium rounded-lg text-sm"
                >
                  Clear Fetch Logs
                </button>
              </>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                No data fetch logs yet. Data fetches will appear here as you use the app.
              </div>
            )}
          </div>
        </div>

        {/* Message Debug */}
        <div className="mb-6 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">💬 Message Debug</h3>
          <div className="space-y-3">
            <div className="text-sm text-slate-600 mb-2">
              Message fetch logs from Data Fetch Logs (filtered for messages):
            </div>
            {fetchLogs.filter((log: any) => log.table === 'league_messages' || log.query?.toLowerCase().includes('message')).length > 0 ? (
              <div className="space-y-2">
                {fetchLogs.filter((log: any) => log.table === 'league_messages' || log.query?.toLowerCase().includes('message')).slice(-10).reverse().map((log: any, idx: number) => (
                  <div key={idx} className={`p-3 rounded-lg border text-xs ${
                    log.result === 'error' 
                      ? 'bg-red-50 border-red-200' 
                      : log.result === 'empty'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="font-semibold mb-1">
                      {new Date(log.timestamp).toLocaleString()} - {log.query}
                    </div>
                    <div className="text-slate-600 mb-1">
                      League: {log.filters?.leagueId || 'N/A'} | Result: {log.result === 'error' ? '❌ Error' : log.result === 'empty' ? '⚠️ Empty' : '✅ Success'} ({log.rowCount || 0} rows)
                    </div>
                    {log.error && (
                      <div className="text-red-600 text-xs">Error: {log.error}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                No message fetch logs yet. Open a league chat to see message queries.
              </div>
            )}
            
            <div className="text-sm text-slate-600 mb-2 mt-4">
              Real-time subscription status (last 10):
            </div>
            {messageSubscriptionLogs.length > 0 ? (
              <div className="space-y-2">
                {messageSubscriptionLogs.slice(-10).reverse().map((log: any, idx: number) => (
                  <div key={idx} className={`p-3 rounded-lg border text-xs ${
                    log.status === 'SUBSCRIBED' 
                      ? 'bg-emerald-50 border-emerald-200' 
                      : log.status === 'CHANNEL_ERROR' || log.status === 'TIMED_OUT'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}>
                    <div className="font-semibold mb-1">
                      {new Date(log.timestamp).toLocaleString()} - {log.status}
                    </div>
                    <div className="text-slate-600 text-xs">
                      League: {log.leagueId?.slice(0, 8)}... | Channel: {log.channel}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    localStorage.removeItem('message_subscription_logs');
                    setMessageSubscriptionLogs([]);
                  }}
                  className="w-full py-2 bg-slate-200 text-slate-700 font-medium rounded-lg text-sm"
                >
                  Clear Subscription Logs
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                No subscription logs yet. Open a league chat to see subscription status.
              </div>
            )}
          </div>
        </div>

        {/* Data Health Monitoring */}
        <div className="mb-6 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">🏥 Data Health</h3>
          <div className="space-y-3">
            <button
              onClick={checkDataHealth}
              disabled={checkingDataHealth}
              className="w-full py-2 bg-blue-600 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkingDataHealth ? 'Checking...' : 'Check Data Health'}
            </button>
            
            {dataHealth && (
              <div className={`p-4 rounded-lg border ${
                dataHealth.issues && dataHealth.issues.length > 0
                  ? 'bg-red-50 border-red-200'
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div className="text-sm font-semibold mb-2">
                  Last checked: {new Date(dataHealth.timestamp).toLocaleString()}
                </div>
                {dataHealth.error ? (
                  <div className="text-red-700 text-sm">Error: {dataHealth.error}</div>
                ) : (
                  <>
                    {dataHealth.issues && dataHealth.issues.length > 0 ? (
                      <div className="text-red-700 text-sm mb-2">
                        ⚠️ Issues found: {dataHealth.issues.join(', ')}
                      </div>
                    ) : (
                      <div className="text-emerald-700 text-sm mb-2">✅ All checks passed</div>
                    )}
                    <div className="space-y-1 text-xs">
                      {Object.entries(dataHealth.checks || {}).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-mono">{key}:</span>
                          <span className={value.exists ? 'text-emerald-600' : 'text-red-600'}>
                            {value.exists ? '✅' : '❌'} {value.error || ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Send Notification to All Users */}
        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <h4 className="text-md font-semibold text-slate-800 mb-3">Send Notification to All Users</h4>
          
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Title
              </label>
              <input
                type="text"
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
                placeholder="Notification title"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#1C8376] focus:outline-none focus:ring-1 focus:ring-[#1C8376]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Message
              </label>
              <textarea
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                placeholder="Notification message"
                rows={3}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#1C8376] focus:outline-none focus:ring-1 focus:ring-[#1C8376]"
              />
            </div>

            {notificationResult && (
              <div className={`rounded border px-3 py-2 text-sm whitespace-pre-wrap break-words max-h-60 overflow-y-auto ${
                notificationResult.startsWith('✅') 
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800' 
                  : notificationResult.startsWith('⚠️')
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}>
                {notificationResult}
              </div>
            )}

            <button
              onClick={async () => {
                if (!notificationTitle.trim() || !notificationMessage.trim()) {
                  setNotificationResult('❌ Please enter both title and message');
                  return;
                }

                setSendingNotification(true);
                setNotificationResult(null);

                try {
                  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
                  const baseUrl = isDev ? 'https://totl-staging.netlify.app' : '';
                  const url = `${baseUrl}/.netlify/functions/sendPushAllV2`;
                  
                  const response = await fetch(url, {
                    method: 'POST',
                    mode: 'cors',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      title: notificationTitle.trim(),
                      message: notificationMessage.trim(),
                    }),
                  }).catch((fetchError: any) => {
                    throw new Error(`Network error: ${fetchError.message || "Failed to connect to server."}`);
                  });

                  if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Unknown error');
                    setNotificationResult(`❌ Server error (${response.status}): ${errorText || 'Failed to send notification'}`);
                    return;
                  }

                  const responseText = await response.text();
                  if (!responseText || responseText.trim() === '') {
                    setNotificationResult(`❌ Empty response from server`);
                    return;
                  }

                  let result;
                  try {
                    result = JSON.parse(responseText);
                  } catch (parseError: any) {
                    setNotificationResult(`❌ Invalid response from server: ${parseError.message || 'Failed to parse response'}`);
                    return;
                  }

                  if (result.ok) {
                    if (result.warning) {
                      setNotificationResult(`⚠️ ${result.warning} (checked ${result.checked || 0} device(s))`);
                    } else {
                      const sentTo = result.sentTo || 0;
                      const expected = result.expected || sentTo;
                      const userCount = result.userCount || 0;
                      
                      if (result.hasNotificationId && !result.oneSignalErrors) {
                        setNotificationResult(`✅ Notification sent to ${expected} device(s) (${userCount} users)`);
                      } else if (result.oneSignalErrors && result.oneSignalErrors.length > 0) {
                        setNotificationResult(`⚠️ Sent to ${sentTo} device(s) (${userCount} users, expected ${expected}). OneSignal errors: ${result.oneSignalErrors.join(', ')}`);
                      } else {
                        setNotificationResult(`✅ Notification sent to ${sentTo} device(s) (${userCount} users)`);
                      }
                    }
                    
                    setNotificationMessage('');
                  } else {
                    setNotificationResult(`❌ Failed to send: ${result.error || 'Unknown error'}`);
                  }
                } catch (error: any) {
                  console.error('[AdminData] Error sending notification:', error);
                  setNotificationResult(`❌ Error: ${error.message || 'Failed to send notification'}`);
                } finally {
                  setSendingNotification(false);
                }
              }}
              disabled={sendingNotification || !notificationTitle.trim() || !notificationMessage.trim()}
              className="w-full py-2 bg-[#1C8376] text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingNotification ? 'Sending...' : 'Send to All Users'}
            </button>

            <div className="text-xs text-slate-500">
              Sends a push notification to all users with active, subscribed devices.
            </div>
          </div>
        </div>

        {/* Deep Link Debug Info */}
        <div className="mb-6 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">🔗 Deep Link Debug</h3>
          <div className="space-y-3">
            {(() => {
              try {
                const debugInfo = localStorage.getItem('deepLink_debug');
                const result = localStorage.getItem('deepLink_result');
                return (
                  <>
                    {debugInfo && (
                      <div className="p-3 bg-blue-600/10 rounded-lg border border-blue-600/20 text-xs">
                        <div className="font-semibold text-blue-600 mb-2">Last Check:</div>
                        <pre className="text-blue-600 whitespace-pre-wrap break-all">
                          {JSON.stringify(JSON.parse(debugInfo), null, 2)}
                        </pre>
                      </div>
                    )}
                    {result && (
                      <div className={`p-3 rounded-lg border text-xs ${
                        JSON.parse(result).success 
                          ? 'bg-emerald-50 border-emerald-200' 
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <div className={`font-semibold mb-2 ${
                          JSON.parse(result).success ? 'text-emerald-800' : 'text-red-800'
                        }`}>
                          {JSON.parse(result).success ? '✅ Success' : '❌ Failed'}:
                        </div>
                        <pre className={`whitespace-pre-wrap break-all ${
                          JSON.parse(result).success ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                          {JSON.stringify(JSON.parse(result), null, 2)}
                        </pre>
                      </div>
                    )}
                    {!debugInfo && !result && (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                        No deep link attempts recorded yet. Tap a chat notification to see debug info.
                      </div>
                    )}
                    <button
                      onClick={() => {
                        localStorage.removeItem('deepLink_debug');
                        localStorage.removeItem('deepLink_result');
                        window.location.reload();
                      }}
                      className="w-full py-2 bg-slate-200 text-slate-700 font-medium rounded-lg text-sm"
                    >
                      Clear Debug Info
                    </button>
                  </>
                );
              } catch (e) {
                return (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-xs text-red-700">
                    Error reading debug info: {String(e)}
                  </div>
                );
              }
            })()}
          </div>
        </div>

        {/* Notification Diagnostic */}
        <div className="mb-6 bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">🔔 Notification Diagnostic</h3>
          <div className="space-y-3">
            {(() => {
              try {
                const notificationLogs = localStorage.getItem('notification_logs');
                const logs = notificationLogs ? JSON.parse(notificationLogs) : [];
                
                return (
                  <>
                    {logs.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs text-slate-600 mb-2">Recent notification attempts (last 10):</div>
                        {logs.slice(-10).reverse().map((log: any, idx: number) => (
                          <div key={idx} className={`p-3 rounded-lg border text-xs ${
                            log.ok 
                              ? (log.sent > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')
                              : 'bg-red-50 border-red-200'
                          }`}>
                            <div className="font-semibold mb-1">
                              {new Date(log.timestamp).toLocaleTimeString()} - {log.ok ? (log.sent > 0 ? '✅ Sent' : '⚠️ No delivery') : '❌ Failed'}
                            </div>
                            <pre className="whitespace-pre-wrap break-all text-xs">
                              {JSON.stringify(log, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                        No notification attempts logged yet. Send a chat message to see diagnostic info.
                      </div>
                    )}
                    <button
                      onClick={() => {
                        localStorage.removeItem('notification_logs');
                        window.location.reload();
                      }}
                      className="w-full py-2 bg-slate-200 text-slate-700 font-medium rounded-lg text-sm"
                    >
                      Clear Notification Logs
                    </button>
                  </>
                );
              } catch (e) {
                return (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-xs text-red-700">
                    Error reading notification logs: {String(e)}
                  </div>
                );
              }
            })()}
          </div>
        </div>

        {/* Admin Links */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">Admin Pages</h3>
          <div className="space-y-2">
            <Link
              to="/api-admin"
              className="block w-full py-3 bg-[#1C8376] text-white font-semibold rounded-xl text-center"
            >
              API Admin - Premier League
            </Link>
            <Link
              to="/test-fixtures"
              className="block w-full py-3 bg-purple-600 text-white font-semibold rounded-xl text-center"
            >
              Test Fixtures (Non-PL)
            </Link>
            <Link
              to="/admin"
              className="block w-full py-3 bg-slate-600 text-white font-semibold rounded-xl text-center"
            >
              Admin Panel (Web)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
