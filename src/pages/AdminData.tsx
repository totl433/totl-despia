import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getDataFetchLogs, clearDataFetchLogs } from '../lib/dataFetchLogger';
import { isNativeApp } from '../lib/platform';

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
  const [copiedSubscriptionLogs, setCopiedSubscriptionLogs] = useState(false);

  type TrackingHit = {
    ts: number;
    kind: 'fetch' | 'xhr';
    url: string;
    method?: string;
    status?: number;
  };

  type TrackingDiagSnapshot = {
    timestampIso: string;
    platform: {
      isNativeApp: boolean;
      despiaDetected: boolean | null;
      hasWindowDespia: boolean;
      hasWindowOnesignalplayerid: boolean;
      userAgent: string;
      trackingDisabled: boolean | null;
    };
    ga: {
      scriptSrcMatches: string[];
      inlineGtagHints: number;
      hasGtag: boolean;
      hasDataLayer: boolean;
      dataLayerLength: number | null;
      cookieNames: string[];
      gaCookieNamesFound: string[];
    };
    termly: {
      scriptSrcMatches: string[];
      cookieNamesFound: string[];
    };
  };

  const TRACKING_URL_PATTERNS = [
    'googletagmanager.com',
    'google-analytics.com',
    'termly.io',
    'app.termly.io',
  ] as const;

  const GA_COOKIE_PREFIXES = ['_ga', '_gid', '_gat'] as const;
  const TERMLY_COOKIE_HINTS = ['termly', 'cmp', 'consent'] as const;

  const [trackingDiagExpanded, setTrackingDiagExpanded] = useState(true);
  const [trackingDiag, setTrackingDiag] = useState<TrackingDiagSnapshot | null>(null);
  const [trackingCaptureEnabled, setTrackingCaptureEnabled] = useState(false);
  const [trackingHits, setTrackingHits] = useState<TrackingHit[]>([]);
  const [trackingCopied, setTrackingCopied] = useState(false);
  const [trackingCookieCleared, setTrackingCookieCleared] = useState(false);
  const originalFetchRef = useRef<typeof window.fetch | null>(null);
  const originalXhrOpenRef = useRef<XMLHttpRequest['open'] | null>(null);
  const originalXhrSendRef = useRef<XMLHttpRequest['send'] | null>(null);

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

  const collectTrackingDiag = (): TrackingDiagSnapshot => {
    const nowIso = new Date().toISOString();
    const ua = typeof window !== 'undefined' ? (window.navigator?.userAgent || '') : '';
    const w: any = typeof window !== 'undefined' ? (window as any) : {};
    const hasWindowDespia = !!w?.despia;
    const hasWindowOnesignalplayerid = !!w?.onesignalplayerid;
    const trackingDisabledRaw = w?.despia?.trackingDisabled ?? w?.trackingDisabled ?? null;
    const trackingDisabled =
      typeof trackingDisabledRaw === 'boolean' ? trackingDisabledRaw : trackingDisabledRaw === null ? null : null;

    const scripts = typeof document !== 'undefined' ? Array.from(document.scripts || []) : [];
    const scriptSrcMatches = scripts
      .map((s) => (s && (s as HTMLScriptElement).src ? (s as HTMLScriptElement).src : ''))
      .filter((src) => !!src)
      .filter((src) => TRACKING_URL_PATTERNS.some((p) => src.includes(p)));

    const gaScriptSrcMatches = scriptSrcMatches.filter(
      (src) => src.includes('googletagmanager.com') || src.includes('google-analytics.com')
    );
    const termlyScriptSrcMatches = scriptSrcMatches.filter((src) => src.includes('termly'));

    const inlineGtagHints = scripts.reduce((acc, s) => {
      const text = (s as HTMLScriptElement).text || '';
      if (!text) return acc;
      return text.includes('gtag(') || text.includes('google-analytics.com') ? acc + 1 : acc;
    }, 0);

    const cookieRaw = typeof document !== 'undefined' ? document.cookie || '' : '';
    const cookieNames = cookieRaw
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split('=')[0]?.trim())
      .filter(Boolean);

    const gaCookieNamesFound = cookieNames.filter((name) => GA_COOKIE_PREFIXES.some((p) => name.startsWith(p)));
    const termlyCookieNamesFound = cookieNames.filter((name) =>
      TERMLY_COOKIE_HINTS.some((h) => name.toLowerCase().includes(h))
    );

    const dataLayer = w?.dataLayer;
    const hasDataLayer = Array.isArray(dataLayer);

    return {
      timestampIso: nowIso,
      platform: {
        isNativeApp: isNativeApp(),
        despiaDetected: despiaDetected,
        hasWindowDespia,
        hasWindowOnesignalplayerid,
        userAgent: ua,
        trackingDisabled,
      },
      ga: {
        scriptSrcMatches: gaScriptSrcMatches,
        inlineGtagHints,
        hasGtag: typeof w?.gtag === 'function' || typeof w?.gtag === 'object',
        hasDataLayer,
        dataLayerLength: hasDataLayer ? dataLayer.length : null,
        cookieNames,
        gaCookieNamesFound,
      },
      termly: {
        scriptSrcMatches: termlyScriptSrcMatches,
        cookieNamesFound: termlyCookieNamesFound,
      },
    };
  };

  // Keep tracking snapshot fresh while on this page.
  useEffect(() => {
    setTrackingDiag(collectTrackingDiag());
    const id = setInterval(() => setTrackingDiag(collectTrackingDiag()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [despiaDetected]);

  const getTrackingVerdict = (diag: TrackingDiagSnapshot | null): { ok: boolean; reasons: string[] } => {
    if (!diag) return { ok: false, reasons: ['Diagnostics not ready yet'] };

    const reasons: string[] = [];
    const isInNative = diag.platform.isNativeApp || diag.platform.despiaDetected === true;

    if (!isInNative) {
      reasons.push('Not detected as native app (Despia) — verdict is only meaningful inside Despia.');
    }

    if (diag.ga.scriptSrcMatches.length > 0) {
      reasons.push(`GA scripts present in DOM (${diag.ga.scriptSrcMatches.length})`);
    }
    if (diag.ga.inlineGtagHints > 0) {
      reasons.push(`Inline gtag() hints detected (${diag.ga.inlineGtagHints})`);
    }
    if (diag.ga.hasGtag || diag.ga.hasDataLayer) {
      reasons.push('GA globals present (window.gtag and/or window.dataLayer)');
    }
    if (diag.ga.gaCookieNamesFound.length > 0) {
      reasons.push(`GA cookie names present: ${diag.ga.gaCookieNamesFound.join(', ')}`);
    }
    if (diag.termly.scriptSrcMatches.length > 0) {
      reasons.push(`Termly scripts present in DOM (${diag.termly.scriptSrcMatches.length})`);
    }
    if (trackingHits.some((h) => h.url.includes('googletagmanager.com') || h.url.includes('google-analytics.com'))) {
      reasons.push('Network activity to Google Tag/Analytics detected during capture');
    }
    if (trackingHits.some((h) => h.url.includes('termly'))) {
      reasons.push('Network activity to Termly detected during capture');
    }

    const ok = isInNative && reasons.length === 0;
    return { ok, reasons };
  };

  const clearGaCookiesNow = () => {
    try {
      if (typeof document === 'undefined') return;
      const raw = document.cookie || '';
      const names = raw
        .split(';')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => p.split('=')[0]?.trim())
        .filter(Boolean);
      const gaNames = names.filter((n) => n.startsWith('_ga'));
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      const domainCandidates = Array.from(
        new Set(
          [
            '', // no domain attribute
            host ? `domain=${host}` : '',
            host ? `domain=.${host}` : '',
          ].filter(Boolean)
        )
      );
      const pathCandidates = ['', 'path=/'];
      const expires = 'Thu, 01 Jan 1970 00:00:00 GMT';

      gaNames.forEach((name) => {
        for (const domainAttr of domainCandidates) {
          for (const pathAttr of pathCandidates) {
            const attrs = [
              `${name}=`,
              `expires=${expires}`,
              'max-age=0',
              pathAttr,
              domainAttr,
              'SameSite=Lax',
            ].filter(Boolean);
            try {
              document.cookie = attrs.join('; ');
            } catch {
              // ignore
            }
          }
        }
      });

      setTrackingCookieCleared(true);
      setTimeout(() => setTrackingCookieCleared(false), 2000);
      setTrackingDiag(collectTrackingDiag());
    } catch (e) {
      console.warn('[AdminData] Failed to clear GA cookies:', e);
    }
  };

  const startTrackingCapture = () => {
    if (typeof window === 'undefined') return;
    if (trackingCaptureEnabled) return;

    // Patch fetch
    if (!originalFetchRef.current) {
      originalFetchRef.current = window.fetch.bind(window);
    }
    const originalFetch = originalFetchRef.current;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      let url = '';
      const firstArg = args[0] as any;
      if (typeof firstArg === 'string') url = firstArg;
      else if (firstArg && typeof firstArg === 'object' && 'url' in firstArg) url = String(firstArg.url);

      const init = (args.length > 1 ? (args[1] as any) : undefined) || {};
      const method = (init?.method || (firstArg?.method ?? 'GET')) as string;
      const shouldLog = url && TRACKING_URL_PATTERNS.some((p) => url.includes(p));

      try {
        const res = await originalFetch(...args);
        if (shouldLog) {
          setTrackingHits((prev) => [
            ...prev,
            { ts: Date.now(), kind: 'fetch', url, method, status: (res as any)?.status },
          ]);
        }
        return res;
      } catch (e) {
        if (shouldLog) {
          setTrackingHits((prev) => [...prev, { ts: Date.now(), kind: 'fetch', url, method, status: undefined }]);
        }
        throw e;
      }
    };

    // Patch XHR
    if (!originalXhrOpenRef.current) originalXhrOpenRef.current = XMLHttpRequest.prototype.open;
    if (!originalXhrSendRef.current) originalXhrSendRef.current = XMLHttpRequest.prototype.send;

    const originalOpen = originalXhrOpenRef.current;
    const originalSend = originalXhrSendRef.current;

    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: any[]) {
      (this as any).__totl_tracking_method = method;
      (this as any).__totl_tracking_url = url?.toString?.() ?? String(url);
      return (originalOpen as any).call(this, method, url, ...rest);
    } as any;

    XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: any) {
      const xhr = this as any;
      const url = String(xhr.__totl_tracking_url || '');
      const method = String(xhr.__totl_tracking_method || 'GET');
      const shouldLog = url && TRACKING_URL_PATTERNS.some((p) => url.includes(p));

      if (shouldLog) {
        const onDone = () => {
          setTrackingHits((prev) => [
            ...prev,
            { ts: Date.now(), kind: 'xhr', url, method, status: typeof xhr.status === 'number' ? xhr.status : undefined },
          ]);
          xhr.removeEventListener?.('loadend', onDone);
        };
        xhr.addEventListener?.('loadend', onDone);
      }

      return (originalSend as any).call(this, body);
    } as any;

    setTrackingCaptureEnabled(true);
  };

  const stopTrackingCapture = () => {
    if (typeof window === 'undefined') return;
    if (!trackingCaptureEnabled) return;

    if (originalFetchRef.current) {
      window.fetch = originalFetchRef.current;
    }
    if (originalXhrOpenRef.current) {
      XMLHttpRequest.prototype.open = originalXhrOpenRef.current;
    }
    if (originalXhrSendRef.current) {
      XMLHttpRequest.prototype.send = originalXhrSendRef.current;
    }

    setTrackingCaptureEnabled(false);
  };

  useEffect(() => {
    // Cleanup patches if user navigates away.
    return () => {
      try {
        if (originalFetchRef.current) window.fetch = originalFetchRef.current;
        if (originalXhrOpenRef.current) XMLHttpRequest.prototype.open = originalXhrOpenRef.current;
        if (originalXhrSendRef.current) XMLHttpRequest.prototype.send = originalXhrSendRef.current;
      } catch {
        // ignore
      }
    };
  }, []);

  const copyTrackingReport = async () => {
    try {
      const diag = trackingDiag || collectTrackingDiag();
      const verdict = getTrackingVerdict(diag);
      const hits = trackingHits.slice(-200);

      const text = `=== TOTL APP STORE COMPLIANCE REPORT ===
Generated: ${new Date().toISOString()}

--- PLATFORM ---
isNativeApp(): ${String(diag.platform.isNativeApp)}
despiaDetected(poll): ${String(diag.platform.despiaDetected)}
window.despia present: ${String(diag.platform.hasWindowDespia)}
window.onesignalplayerid present: ${String(diag.platform.hasWindowOnesignalplayerid)}
despia.trackingDisabled: ${diag.platform.trackingDisabled === null ? 'N/A' : String(diag.platform.trackingDisabled)}
User-Agent: ${diag.platform.userAgent}

--- GA DETECTION ---
GA script src matches (${diag.ga.scriptSrcMatches.length}):
${diag.ga.scriptSrcMatches.length ? diag.ga.scriptSrcMatches.map((s) => `- ${s}`).join('\n') : '(none)'}
Inline gtag hints: ${diag.ga.inlineGtagHints}
window.gtag present: ${String(diag.ga.hasGtag)}
window.dataLayer present: ${String(diag.ga.hasDataLayer)}${diag.ga.dataLayerLength !== null ? ` (len=${diag.ga.dataLayerLength})` : ''}
Cookie names (${diag.ga.cookieNames.length}): ${diag.ga.cookieNames.join(', ') || '(none)'}
GA cookie names found: ${diag.ga.gaCookieNamesFound.join(', ') || '(none)'}

--- TERMLY DETECTION ---
Termly script src matches (${diag.termly.scriptSrcMatches.length}):
${diag.termly.scriptSrcMatches.length ? diag.termly.scriptSrcMatches.map((s) => `- ${s}`).join('\n') : '(none)'}
Termly-ish cookie names found: ${diag.termly.cookieNamesFound.join(', ') || '(none)'}

--- NETWORK CAPTURE (${trackingCaptureEnabled ? 'RUNNING' : 'STOPPED'}) ---
Hits captured: ${hits.length} (showing up to last 200)
${hits.length ? hits.map((h) => `- [${new Date(h.ts).toISOString()}] ${h.kind.toUpperCase()} ${h.method || ''} ${h.status ?? ''} ${h.url}`).join('\n') : '(none)'}

--- VERDICT ---
${verdict.ok ? 'PASS' : 'FAIL'}
${verdict.reasons.length ? verdict.reasons.map((r) => `- ${r}`).join('\n') : '(no issues detected)'}
`;

      await navigator.clipboard.writeText(text);
      setTrackingCopied(true);
      setTimeout(() => setTrackingCopied(false), 2500);
    } catch (e: any) {
      console.error('[AdminData] Failed to copy tracking report:', e);
      alert(`Failed to copy tracking report: ${e?.message || String(e)}`);
    }
  };

  // Load crashes and fetch logs
  useEffect(() => {
    const loadLogs = () => {
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
    };

    // Load initially
    loadLogs();

    // Auto-refresh every 2 seconds to show live subscription status
    const interval = setInterval(loadLogs, 2000);

    return () => clearInterval(interval);
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

  // Copy subscription logs to clipboard
  const copySubscriptionLogs = async () => {
    try {
      if (messageSubscriptionLogs.length === 0) {
        alert('No subscription logs to copy');
        return;
      }

      const reportText = `=== SUBSCRIPTION STATUS LOGS ===
Date: ${new Date().toISOString()}
Total Logs: ${messageSubscriptionLogs.length}

${messageSubscriptionLogs.slice().reverse().map((log: any, idx: number) => {
        const date = new Date(log.timestamp).toISOString();
        return `[${idx + 1}] ${date}
  Status: ${log.status}
  League ID: ${log.leagueId || 'N/A'}
  Channel: ${log.channel || 'N/A'}
`;
      }).join('\n')}`;

      await navigator.clipboard.writeText(reportText);
      setCopiedSubscriptionLogs(true);
      setTimeout(() => setCopiedSubscriptionLogs(false), 3000);
    } catch (error: any) {
      console.error('[AdminData] Failed to copy subscription logs:', error);
      alert('Failed to copy subscription logs: ' + error.message);
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
            const historyStr = localStorage.getItem('deepLink_history');
            const history = historyStr ? JSON.parse(historyStr) : [];
            return {
              debug: debugInfo ? JSON.parse(debugInfo) : null,
              result: result ? JSON.parse(result) : null,
              history: history.length > 0 ? history : null,
              summary: history.length > 0 ? {
                total: history.length,
                successful: history.filter((h: any) => h.success).length,
                failed: history.filter((h: any) => !h.success).length,
              } : null,
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
${report.deepLink ? (() => {
  const dl = report.deepLink;
  let output = '';
  if (dl.summary) {
    output += `Summary: ${dl.summary.total} attempts (${dl.summary.successful} successful, ${dl.summary.failed} failed)\n\n`;
  }
  if (dl.debug) {
    output += `Last Check:\n${JSON.stringify(dl.debug, null, 2)}\n\n`;
  }
  if (dl.result) {
    output += `Last Result:\n${JSON.stringify(dl.result, null, 2)}\n\n`;
  }
  if (dl.history && dl.history.length > 0) {
    output += `History (last ${Math.min(dl.history.length, 20)}):\n`;
    dl.history.slice(-20).reverse().forEach((entry: any, idx: number) => {
      output += `[${idx + 1}] ${entry.success ? '✅' : '❌'} ${new Date(entry.timestamp).toISOString()}\n`;
      output += `${JSON.stringify(entry, null, 2)}\n\n`;
    });
  }
  return output.trim();
})() : 'No deep link attempts'}

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

        {/* App Store Compliance / Tracking Diagnostics */}
        <div className="mb-6 bg-white rounded-xl shadow-md p-6">
          <button
            onClick={() => setTrackingDiagExpanded((v) => !v)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="text-lg font-semibold text-slate-800">
              🛡️ Compliance / Tracking Diagnostics (Apple Review)
            </h3>
            <span className="text-slate-500 text-sm">{trackingDiagExpanded ? 'Hide' : 'Show'}</span>
          </button>

          {trackingDiagExpanded && (
            <div className="mt-4 space-y-3">
              {(() => {
                const diag = trackingDiag || collectTrackingDiag();
                const verdict = getTrackingVerdict(diag);
                return (
                  <>
                    <div
                      className={`p-4 rounded-lg border ${
                        verdict.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Verdict: {verdict.ok ? '✅ PASS (no tracking detected in Despia)' : '⚠️ FAIL / Needs attention'}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            Updated: {new Date(diag.timestampIso).toLocaleTimeString()}
                          </div>
                          {verdict.reasons.length > 0 && (
                            <ul className="mt-2 list-disc pl-5 text-sm text-slate-800 space-y-1">
                              {verdict.reasons.map((r, idx) => (
                                <li key={idx}>{r}</li>
                              ))}
                            </ul>
                          )}
                          {verdict.ok && (
                            <div className="mt-2 text-sm text-emerald-800">
                              This should satisfy Apple’s “no tracking cookies without ATT” requirement (for iOS app).
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 min-w-[160px]">
                          <button
                            onClick={() => setTrackingDiag(collectTrackingDiag())}
                            className="w-full py-2 bg-slate-200 text-slate-800 font-medium rounded-lg text-sm"
                          >
                            Refresh
                          </button>
                          <button
                            onClick={clearGaCookiesNow}
                            className={`w-full py-2 font-medium rounded-lg text-sm ${
                              trackingCookieCleared
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-700 text-white hover:bg-slate-800'
                            }`}
                          >
                            {trackingCookieCleared ? '✅ Cleared' : '🧹 Clear GA cookies'}
                          </button>
                          <button
                            onClick={copyTrackingReport}
                            className={`w-full py-2 font-medium rounded-lg text-sm ${
                              trackingCopied ? 'bg-emerald-600 text-white' : 'bg-[#1C8376] text-white hover:bg-[#156d62]'
                            }`}
                          >
                            {trackingCopied ? '✅ Copied' : '📋 Copy compliance report'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <details className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                        Platform signals
                      </summary>
                      <div className="mt-2 text-xs text-slate-700 space-y-1">
                        <div>
                          <span className="font-mono">isNativeApp()</span>: {String(diag.platform.isNativeApp)} (code check)
                        </div>
                        <div>
                          <span className="font-mono">despiaDetected</span>: {String(diag.platform.despiaDetected)} (poll)
                        </div>
                        <div>
                          <span className="font-mono">window.despia</span>: {String(diag.platform.hasWindowDespia)}
                        </div>
                        <div>
                          <span className="font-mono">window.onesignalplayerid</span>: {String(diag.platform.hasWindowOnesignalplayerid)}
                        </div>
                        <div>
                          <span className="font-mono">despia.trackingDisabled</span>:{' '}
                          {diag.platform.trackingDisabled === null ? 'N/A' : String(diag.platform.trackingDisabled)}
                        </div>
                        <div className="mt-2">
                          <div className="font-semibold">User-Agent</div>
                          <pre className="mt-1 whitespace-pre-wrap break-all bg-white rounded border p-2">
                            {diag.platform.userAgent || '(empty)'}
                          </pre>
                        </div>
                      </div>
                    </details>

                    <details className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                        GA / cookies / scripts snapshot
                      </summary>
                      <div className="mt-2 text-xs text-slate-700 space-y-2">
                        <div>
                          <span className="font-mono">window.gtag</span>: {String(diag.ga.hasGtag)} |{' '}
                          <span className="font-mono">window.dataLayer</span>: {String(diag.ga.hasDataLayer)}
                          {diag.ga.dataLayerLength !== null ? ` (len=${diag.ga.dataLayerLength})` : ''}
                        </div>
                        <div>
                          <div className="font-semibold">GA script src matches ({diag.ga.scriptSrcMatches.length})</div>
                          <pre className="mt-1 whitespace-pre-wrap break-all bg-white rounded border p-2">
                            {diag.ga.scriptSrcMatches.length ? diag.ga.scriptSrcMatches.join('\n') : '(none)'}
                          </pre>
                        </div>
                        <div>
                          <div className="font-semibold">GA cookie names found</div>
                          <div className="font-mono">
                            {diag.ga.gaCookieNamesFound.length ? diag.ga.gaCookieNamesFound.join(', ') : '(none)'}
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold">All cookie names ({diag.ga.cookieNames.length})</div>
                          <pre className="mt-1 whitespace-pre-wrap break-all bg-white rounded border p-2">
                            {diag.ga.cookieNames.length ? diag.ga.cookieNames.join(', ') : '(none)'}
                          </pre>
                        </div>
                      </div>
                    </details>

                    <details className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                        Termly snapshot
                      </summary>
                      <div className="mt-2 text-xs text-slate-700 space-y-2">
                        <div>
                          <div className="font-semibold">Termly script src matches ({diag.termly.scriptSrcMatches.length})</div>
                          <pre className="mt-1 whitespace-pre-wrap break-all bg-white rounded border p-2">
                            {diag.termly.scriptSrcMatches.length ? diag.termly.scriptSrcMatches.join('\n') : '(none)'}
                          </pre>
                        </div>
                        <div>
                          <div className="font-semibold">Termly-ish cookie names found</div>
                          <div className="font-mono">
                            {diag.termly.cookieNamesFound.length ? diag.termly.cookieNamesFound.join(', ') : '(none)'}
                          </div>
                        </div>
                      </div>
                    </details>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">Network capture (Google/Termly)</div>
                          <div className="text-xs text-slate-600">
                            Captures fetch/XHR URLs matching: {TRACKING_URL_PATTERNS.join(', ')}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!trackingCaptureEnabled ? (
                            <button
                              onClick={startTrackingCapture}
                              className="py-2 px-3 bg-blue-600 text-white font-medium rounded-lg text-sm"
                            >
                              Start
                            </button>
                          ) : (
                            <button
                              onClick={stopTrackingCapture}
                              className="py-2 px-3 bg-amber-600 text-white font-medium rounded-lg text-sm"
                            >
                              Stop
                            </button>
                          )}
                          <button
                            onClick={() => setTrackingHits([])}
                            className="py-2 px-3 bg-slate-200 text-slate-800 font-medium rounded-lg text-sm"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 text-xs">
                        <div className="text-slate-600 mb-2">
                          Hits captured: <span className="font-semibold text-slate-800">{trackingHits.length}</span>
                        </div>
                        {trackingHits.length > 0 ? (
                          <pre className="whitespace-pre-wrap break-all bg-white rounded border p-2 max-h-48 overflow-auto">
                            {trackingHits
                              .slice(-50)
                              .map((h) => `[${new Date(h.ts).toISOString()}] ${h.kind.toUpperCase()} ${h.method || ''} ${h.status ?? ''} ${h.url}`)
                              .join('\n')}
                          </pre>
                        ) : (
                          <div className="p-2 bg-white rounded border text-slate-600">No hits captured yet.</div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
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
              Real-time subscription status (last 20):
            </div>
            {messageSubscriptionLogs.length > 0 ? (
              <div className="space-y-2">
                {/* Summary Stats */}
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs">
                  <div className="font-semibold text-blue-800 mb-2">📊 Subscription Stats:</div>
                  <div className="space-y-1 text-blue-700">
                    <div>Total events: {messageSubscriptionLogs.length}</div>
                    <div>
                      SUBSCRIBED: {messageSubscriptionLogs.filter((l: any) => l.status === 'SUBSCRIBED').length} | 
                      CLOSED: {messageSubscriptionLogs.filter((l: any) => l.status === 'CLOSED').length} |
                      Errors: {messageSubscriptionLogs.filter((l: any) => l.status === 'CHANNEL_ERROR' || l.status === 'TIMED_OUT').length}
                    </div>
                    {messageSubscriptionLogs.length >= 2 && (() => {
                      const recent = messageSubscriptionLogs.slice(-10).reverse();
                      const cycles = [];
                      for (let i = 0; i < recent.length - 1; i++) {
                        if (recent[i].status === 'CLOSED' && recent[i + 1]?.status === 'SUBSCRIBED') {
                          const timeDiff = recent[i].timestamp - recent[i + 1].timestamp;
                          cycles.push(timeDiff);
                        }
                      }
                      if (cycles.length > 0) {
                        const avgCycle = Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length / 1000);
                        const minCycle = Math.round(Math.min(...cycles) / 1000);
                        const maxCycle = Math.round(Math.max(...cycles) / 1000);
                        return (
                          <div className="mt-1">
                            {cycles.length > 1 ? (
                              <>Avg cycle time: ~{avgCycle}s (min: {minCycle}s, max: {maxCycle}s)</>
                            ) : (
                              <>Last cycle: ~{avgCycle}s</>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                
                {messageSubscriptionLogs.slice(-20).reverse().map((log: any, idx: number) => {
                  let bgColor = 'bg-slate-50';
                  let borderColor = 'border-slate-200';
                  
                  if (log.status === 'SUBSCRIBED' || log.status === 'COMPONENT_MOUNT' || log.status === 'EFFECT_MOUNT' || log.status === 'LEAGUE_PAGE_MOUNT') {
                    bgColor = 'bg-emerald-50';
                    borderColor = 'border-emerald-200';
                  } else if (log.status === 'CHANNEL_ERROR' || log.status === 'TIMED_OUT') {
                    bgColor = 'bg-red-50';
                    borderColor = 'border-red-200';
                  } else if (log.status === 'CLOSED' || log.status === 'COMPONENT_UNMOUNT' || log.status === 'EFFECT_UNMOUNT' || log.status === 'LEAGUE_PAGE_UNMOUNT') {
                    bgColor = 'bg-amber-50';
                    borderColor = 'border-amber-200';
                  } else if (log.status === 'DEEP_LINK_EFFECT_RUN' || log.status === 'DEEP_LINK_EARLY_RETURN') {
                    bgColor = 'bg-blue-50';
                    borderColor = 'border-blue-200';
                  } else if (log.status === 'NAVIGATE_CALLED') {
                    bgColor = 'bg-purple-50';
                    borderColor = 'border-purple-200';
                  }
                  
                  return (
                    <div key={idx} className={`p-3 rounded-lg border text-xs ${bgColor} ${borderColor}`}>
                      <div className="font-semibold mb-1">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} - {log.status}
                      </div>
                      {log.leagueId && (
                        <div className="text-slate-600 text-xs mb-1">
                          League: {log.leagueId?.slice(0, 8)}... | Channel: {log.channel}
                        </div>
                      )}
                      {log.changedFields && log.changedFields.length > 0 && (
                        <div className="text-blue-700 text-xs mt-1 font-semibold">
                          Changed: {Array.isArray(log.changedFields) ? log.changedFields.join(', ') : log.changedFields}
                        </div>
                      )}
                      {log.location && (
                        <div className="text-slate-500 text-xs mt-1">
                          Path: {log.location.pathname} | Search: {log.location.search || '(empty)'}
                        </div>
                      )}
                      {log.from && log.to && (
                        <div className="text-purple-700 text-xs mt-1">
                          Navigate: {log.from} → {log.to}
                        </div>
                      )}
                      {log.dependencies && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-slate-500 text-xs">Dependencies</summary>
                          <pre className="mt-1 whitespace-pre-wrap break-all text-xs bg-white p-2 rounded border">
                            {JSON.stringify(log.dependencies, null, 2)}
                          </pre>
                        </details>
                      )}
                      {log.trigger && (
                        <div className="text-purple-700 text-xs mt-1 font-semibold">
                          Trigger: navigateChanged={String(log.trigger.navigateChanged)}, pathnameChanged={String(log.trigger.pathnameChanged)}
                          {log.trigger.prevPathname && log.trigger.currentPathname && (
                            <div className="text-purple-600 text-xs mt-0.5">
                              Pathname: "{log.trigger.prevPathname}" → "{log.trigger.currentPathname}"
                            </div>
                          )}
                        </div>
                      )}
                      {log.reason && (
                        <div className="text-orange-600 text-xs mt-1">
                          Reason: {log.reason}
                        </div>
                      )}
                      {idx < messageSubscriptionLogs.slice(-20).length - 1 && (() => {
                        const nextLog = messageSubscriptionLogs.slice(-20).reverse()[idx + 1];
                        const timeDiff = Math.round((log.timestamp - nextLog.timestamp) / 1000);
                        return (
                          <div className="text-slate-400 text-xs mt-1">
                            ⏱️ {timeDiff}s after previous event
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
                <div className="flex gap-2">
                  <button
                    onClick={copySubscriptionLogs}
                    className={`flex-1 py-2 font-medium rounded-lg text-sm ${
                      copiedSubscriptionLogs
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#1C8376] text-white hover:bg-[#156d62]'
                    }`}
                  >
                    {copiedSubscriptionLogs ? '✅ Copied!' : '📋 Copy All Subscription Logs'}
                  </button>
                  <button
                    onClick={() => {
                      localStorage.removeItem('message_subscription_logs');
                      setMessageSubscriptionLogs([]);
                      window.location.reload();
                    }}
                    className="flex-1 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg text-sm"
                  >
                    Clear Subscription Logs
                  </button>
                </div>
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
                const historyStr = localStorage.getItem('deepLink_history');
                const history = historyStr ? JSON.parse(historyStr) : [];
                
                // Count failed attempts
                const failedCount = history.filter((h: any) => !h.success).length;
                const successCount = history.filter((h: any) => h.success).length;
                
                return (
                  <>
                    {/* Summary Stats */}
                    {history.length > 0 && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs">
                        <div className="font-semibold text-blue-800 mb-2">📊 Summary:</div>
                        <div className="text-blue-700 space-y-1">
                          <div>Total attempts: {history.length}</div>
                          <div>✅ Successful: {successCount} | ❌ Failed: {failedCount}</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Last Check (for backward compatibility) */}
                    {debugInfo && (
                      <div className="p-3 bg-blue-600/10 rounded-lg border border-blue-600/20 text-xs">
                        <div className="font-semibold text-blue-600 mb-2">Last Check:</div>
                        <pre className="text-blue-600 whitespace-pre-wrap break-all">
                          {JSON.stringify(JSON.parse(debugInfo), null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {/* Last Result (for backward compatibility) */}
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
                    
                    {/* History of Attempts */}
                    {history.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm text-slate-600 mb-2 font-semibold">
                          History (last {Math.min(history.length, 20)} attempts):
                        </div>
                        {history.slice(-20).reverse().map((entry: any, idx: number) => (
                          <div key={idx} className={`p-3 rounded-lg border text-xs ${
                            entry.success 
                              ? 'bg-emerald-50 border-emerald-200' 
                              : 'bg-red-50 border-red-200'
                          }`}>
                            <div className={`font-semibold mb-1 ${
                              entry.success ? 'text-emerald-800' : 'text-red-800'
                            }`}>
                              {entry.success ? '✅' : '❌ Failed'}: {new Date(entry.timestamp).toLocaleString()}
                            </div>
                            <pre className={`whitespace-pre-wrap break-all text-xs ${
                              entry.success ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                              {JSON.stringify(entry, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {!debugInfo && !result && history.length === 0 && (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                        No deep link attempts recorded yet. Tap a chat notification to see debug info.
                      </div>
                    )}
                    
                    <button
                      onClick={() => {
                        localStorage.removeItem('deepLink_debug');
                        localStorage.removeItem('deepLink_result');
                        localStorage.removeItem('deepLink_history');
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
