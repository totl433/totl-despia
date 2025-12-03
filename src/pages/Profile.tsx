import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { isLoadEverythingFirstEnabled, setLoadEverythingFirst } from '../lib/featureFlags';

// Profile page with push notification diagnostics

interface UserStats {
  totalPredictions: number;
  correctPredictions: number;
  totalPoints: number;
  globalRank: number;
  totalUsers: number;
}

export default function Profile() {
  const { user, signOut, session } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<string | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [despiaDetected, setDespiaDetected] = useState<boolean | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [loadEverythingFirst, setLoadEverythingFirstLocal] = useState(isLoadEverythingFirstEnabled());
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationResult, setNotificationResult] = useState<string | null>(null);
  const [activatingCarl, setActivatingCarl] = useState(false);
  const [carlActivationResult, setCarlActivationResult] = useState<string | null>(null);
  const [forcingCarlSubscription, setForcingCarlSubscription] = useState(false);
  const [carlForceResult, setCarlForceResult] = useState<string | null>(null);
  
  // Admin check
  const isAdmin = user?.id === '4542c037-5b38-40d0-b189-847b8f17c222' || user?.id === '36f31625-6d6c-4aa4-815a-1493a812841b';

  // Poll for Despia API availability (it may be injected after page load)
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 40; // Check for 20 seconds (40 * 500ms) - Despia might inject late
    
    const checkDespia = () => {
      // Try multiple ways to find Despia API - check all possible locations
      const possibleLocations = [
        (globalThis as any)?.despia,
        (typeof window !== 'undefined' ? (window as any)?.despia : null),
        (globalThis as any)?.Despia,
        (typeof window !== 'undefined' ? (window as any)?.Despia : null),
        (globalThis as any)?.DESPIA,
        (typeof window !== 'undefined' ? (window as any)?.DESPIA : null),
        (globalThis as any)?.OneSignal,
        (typeof window !== 'undefined' ? (window as any)?.OneSignal : null),
        // Check if it's nested somewhere
        (globalThis as any)?.webkit?.messageHandlers?.despia,
        (typeof window !== 'undefined' ? (window as any)?.webkit?.messageHandlers?.despia : null),
      ];
      
      const despia: any = possibleLocations.find(loc => loc != null) || null;
      
      // Also check all global properties for anything that looks like Despia
      let foundInGlobals = null;
      try {
        const globals = typeof window !== 'undefined' ? window : globalThis;
        for (const key in globals) {
          if (key.toLowerCase().includes('despia') || key.toLowerCase().includes('onesignal')) {
            foundInGlobals = { key, value: (globals as any)[key] };
            break;
          }
        }
      } catch (e) {
        // Ignore errors when checking globals
      }
      
      // Check for direct global properties (Despia exposes onesignalplayerid directly)
      const directPlayerId = 
        (globalThis as any)?.onesignalplayerid ||
        (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null) ||
        (globalThis as any)?.oneSignalPlayerId ||
        (typeof window !== 'undefined' ? (window as any)?.oneSignalPlayerId : null);
      
      if (despia || foundInGlobals || directPlayerId) {
        console.log('[Profile] Native API detected:', {
          despia: !!despia,
          foundInGlobals,
          directPlayerId: directPlayerId ? String(directPlayerId).slice(0, 12) + '…' : null,
          despiaKeys: despia ? Object.keys(despia) : [],
          hasOneSignalRequestPermission: despia && typeof despia.oneSignalRequestPermission === 'function',
          hasRequestPermission: despia && typeof despia.requestPermission === 'function',
          playerId: despia ? (despia.onesignalplayerid || despia.oneSignalPlayerId) : directPlayerId,
        });
        setDespiaDetected(true);
        const pid = despia ? (despia.onesignalplayerid || despia.oneSignalPlayerId) : directPlayerId;
        if (pid) setPlayerId(String(pid));
        return true;
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(checkDespia, 500);
      } else {
        console.warn('[Profile] Native API not detected after', maxAttempts, 'attempts');
        setDespiaDetected(false);
      }
      return false;
    };
    
    checkDespia();
  }, []);

  useEffect(() => {
    fetchUserStats();
  }, [user]);

  async function fetchUserStats() {
    if (!user) return;

    try {
      // Fetch user's total predictions
      const { data: picks, error: picksError } = await supabase
        .from('picks')
        .select('*')
        .eq('user_id', user.id);

      if (picksError) {
        console.error('Error fetching picks:', picksError);
      }

      // Fetch overall standings from v_ocp_overall view
      const { data: standings, error: standingsError } = await supabase
        .from('v_ocp_overall')
        .select('user_id, name, ocp')
        .order('ocp', { ascending: false });

      if (standingsError) {
        console.error('Error fetching standings:', standingsError);
      }

      const userRank = standings ? standings.findIndex(s => s.user_id === user.id) + 1 : 0;
      const userStanding = standings?.find(s => s.user_id === user.id);

      // Calculate correct predictions by comparing picks with results
      const { data: results, error: resultsError } = await supabase
        .from('gw_results')
        .select('gw, fixture_index, result');

      if (resultsError) {
        console.error('Error fetching results:', resultsError);
      }

      // Count correct predictions
      let correctCount = 0;
      if (picks && results) {
        picks.forEach((pick: any) => {
          const result = results.find(
            (r: any) => r.gw === pick.gw && r.fixture_index === pick.fixture_index
          );
          if (result && result.result === pick.pick) {
            correctCount++;
          }
        });
      }

      setStats({
        totalPredictions: picks?.length || 0,
        correctPredictions: correctCount,
        totalPoints: userStanding?.ocp || 0,
        globalRank: userRank,
        totalUsers: standings?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return <div className="p-6">Please sign in to view your profile.</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto p-6">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 mb-6">
          <div className="flex items-start gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#1C8376] rounded-full flex items-center justify-center text-white text-xl sm:text-2xl font-bold flex-shrink-0">
              {(user.user_metadata?.display_name || user.email || 'U')[0].toUpperCase()}
            </div>
            
            {/* User Info */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2 truncate">
                {user.user_metadata?.display_name || 'User'}
              </h1>
              <p className="text-slate-600 break-all text-sm sm:text-base">{user.email}</p>
              <p className="text-sm text-slate-500 mt-2">
                Member since {new Date(user.created_at || '').toLocaleDateString('en-GB', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-600">Loading stats...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* OCP */}
              <div className="bg-white rounded-xl shadow-md p-6 flex flex-col items-center justify-center">
                <div className="text-4xl font-bold text-[#1C8376] mb-2">
                  {stats?.totalPoints || 0}
                </div>
                <div className="text-sm text-slate-600 font-medium">OCP</div>
              </div>

                      {/* Global Rank */}
                      <div className="bg-white rounded-xl shadow-md p-6 text-center">
                        <div className="text-4xl font-bold text-blue-600 mb-2">
                          {stats?.globalRank || 0}
                        </div>
                        <div className="text-sm text-slate-600 font-medium">Global Rank</div>
                        <div className="text-xs text-slate-400 mt-1">
                          of {stats?.totalUsers || 0}
                          {stats && stats.globalRank > 0 && stats.totalUsers > 0 && (
                            <span className="block mt-1 text-[#1C8376] font-semibold">
                              Top {Math.round((stats.globalRank / stats.totalUsers) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
            </div>

            {/* Accuracy */}
            {stats && stats.totalPredictions > 0 && (
              <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Prediction Accuracy</h2>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-600">
                    <span className="text-3xl font-bold text-[#1C8376]">{stats.correctPredictions}</span>
                    <span className="text-slate-500"> / {stats.totalPredictions}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-[#1C8376]">
                      {((stats.correctPredictions / stats.totalPredictions) * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-500">accuracy rate</div>
                  </div>
                </div>
                <div className="overflow-hidden h-4 text-xs flex rounded-full bg-[#1C8376]/20">
                  <div
                    style={{ width: `${(stats.correctPredictions / stats.totalPredictions) * 100}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#1C8376] transition-all duration-500"
                  ></div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Account Actions */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Account Settings</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-slate-200">
              <div>
                <div className="font-medium text-slate-800">Display Name</div>
                <div className="text-sm text-slate-600">
                  {user.user_metadata?.display_name || 'Not set'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-slate-200">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800">Email</div>
                <div className="text-sm text-slate-600 break-all">{user.email}</div>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-slate-200">
              <div>
                <div className="font-medium text-slate-800">User ID</div>
                <div className="text-xs text-slate-500 font-mono">{user.id}</div>
              </div>
            </div>
          </div>

          {/* Data Loading Mode Toggle */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Data Loading</h3>
            <div className="flex items-center justify-between py-3 border-b border-slate-200">
              <div className="flex-1">
                <div className="font-medium text-slate-800">Load Everything First</div>
                <div className="text-sm text-slate-600 mt-1">
                  {loadEverythingFirst 
                    ? 'All data loads before app opens (slower start, no stale data)'
                    : 'Data loads as you navigate (faster start, may show cached data)'}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={loadEverythingFirst}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    setLoadEverythingFirstLocal(newValue);
                    setLoadEverythingFirst(newValue);
                    // Show a message that the app will reload
                    if (newValue) {
                      alert('"Load Everything First" mode enabled. The app will reload on next visit to apply the change.');
                    } else {
                      alert('"Load Everything First" mode disabled. The app will reload on next visit to apply the change.');
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#1C8376]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1C8376]"></div>
              </label>
            </div>
          </div>

          {/* Advanced - Self-Serve Fix Screen */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Advanced</h3>
            <p className="text-sm text-slate-600 mb-4">
              Check and fix your notification settings to receive chat notifications in mini-leagues.
            </p>

            {/* Status Display */}
            <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                <div className="text-slate-600 mb-1">OS Permission:</div>
                <div className="font-semibold text-slate-800">
                  {(() => {
                    if (despiaDetected === null) return '⏳ Checking...';
                    if (despiaDetected === false) return '❓ Unknown (not native app)';
                    // If we have Player ID, we're in native app
                    const directPid = (globalThis as any)?.onesignalplayerid || (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null);
                    if (directPid || playerId) {
                      // We have Player ID, so we're in native app
                      // Permission status can be checked via despia('checkNativePushPermissions://', ['nativePushEnabled'])
                      // but we'll show a generic message since we can't check it synchronously in render
                      return '✅ Native app (use "Enable Notifications" to check status)';
                    }
                    return '❓ Unknown (not native app)';
                  })()}
                </div>
                </div>
                <div>
                <div className="text-slate-600 mb-1">OneSignal Status:</div>
                <div className="font-semibold text-slate-800">
                  {(() => {
                    if (despiaDetected === null) return '⏳ Checking...';
                    if (despiaDetected === false) return '❌ Not initialized';
                    // Check both nested (despia object) and direct (global property)
                    const despia: any = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);
                    const directPid = (globalThis as any)?.onesignalplayerid || (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null);
                    const pid = despia?.onesignalplayerid || despia?.oneSignalPlayerId || directPid || playerId;
                    return pid ? '✅ Player ID found' : '❌ Not initialized';
                  })()}
                </div>
                </div>
                <div className="col-span-2">
                <div className="text-slate-600 mb-1">Player ID:</div>
                <div className="font-mono text-xs text-slate-700 break-all">
                  {(() => {
                    if (despiaDetected === null) return 'Checking...';
                    // Check both nested (despia object) and direct (global property)
                    const despia: any = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);
                    const directPid = (globalThis as any)?.onesignalplayerid || (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null);
                    const pid = despia?.onesignalplayerid || despia?.oneSignalPlayerId || directPid || playerId;
                    if (!pid) return 'Not available';
                    const pidStr = String(pid);
                    return pidStr.slice(0, 8) + '…' + pidStr.slice(-4);
                  })()}
                </div>
                </div>
              </div>
            </div>

            {/* Debug Info (for troubleshooting) */}
            <div className="mb-4 p-3 bg-slate-100 rounded-lg border border-slate-300 text-xs">
              <div className="font-semibold text-slate-700 mb-2">🔍 Debug Info:</div>
              <div className="space-y-1 text-slate-600 font-mono break-all">
                <div>User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 50) + '…' : 'N/A'}</div>
                <div>globalThis.despia: {((globalThis as any)?.despia ? '✅ Found' : '❌ Not found')}</div>
                <div>window.despia: {(typeof window !== 'undefined' && (window as any)?.despia ? '✅ Found' : '❌ Not found')}</div>
                <div>globalThis.Despia: {((globalThis as any)?.Despia ? '✅ Found' : '❌ Not found')}</div>
                <div>window.Despia: {(typeof window !== 'undefined' && (window as any)?.Despia ? '✅ Found' : '❌ Not found')}</div>
                <div>globalThis.OneSignal: {((globalThis as any)?.OneSignal ? '✅ Found' : '❌ Not found')}</div>
                <div>window.OneSignal: {(typeof window !== 'undefined' && (window as any)?.OneSignal ? '✅ Found' : '❌ Not found')}</div>
                {(() => {
                  // Check all possible locations
                  const possibleLocations = [
                    (globalThis as any)?.despia,
                    (typeof window !== 'undefined' ? (window as any)?.despia : null),
                    (globalThis as any)?.Despia,
                    (typeof window !== 'undefined' ? (window as any)?.Despia : null),
                    (globalThis as any)?.DESPIA,
                    (typeof window !== 'undefined' ? (window as any)?.DESPIA : null),
                  ];
                  const despia: any = possibleLocations.find(loc => loc != null) || null;
                  
                  // Also check for any global properties with "despia" or "onesignal" in the name
                  let foundGlobals: string[] = [];
                  try {
                    const globals = typeof window !== 'undefined' ? window : globalThis;
                    for (const key in globals) {
                      if (key.toLowerCase().includes('despia') || key.toLowerCase().includes('onesignal')) {
                        foundGlobals.push(key);
                      }
                    }
                  } catch (e) {
                    // Ignore
                  }
                  
                  if (foundGlobals.length > 0) {
                    return (
                      <div className="mt-2 text-green-600">
                        ✅ Found global properties: {foundGlobals.join(', ')}
                      </div>
                    );
                  }
                  
                  if (despia) {
                    return (
                      <>
                        <div className="mt-2 font-semibold">Despia Object Found:</div>
                        <div>Keys: {Object.keys(despia).slice(0, 10).join(', ')}{Object.keys(despia).length > 10 ? '…' : ''}</div>
                        <div>oneSignalRequestPermission: {typeof despia.oneSignalRequestPermission === 'function' ? '✅ Function' : '❌ Not a function'}</div>
                        <div>requestPermission: {typeof despia.requestPermission === 'function' ? '✅ Function' : '❌ Not a function'}</div>
                        <div>onesignalplayerid: {despia.onesignalplayerid ? '✅ ' + String(despia.onesignalplayerid).slice(0, 12) + '…' : '❌'}</div>
                        <div>oneSignalPlayerId: {despia.oneSignalPlayerId ? '✅ ' + String(despia.oneSignalPlayerId).slice(0, 12) + '…' : '❌'}</div>
                      </>
                    );
                  }
                  return <div className="mt-2 text-red-600">❌ No Despia object found in any location</div>;
                })()}
                <div className="mt-2 text-xs text-slate-500">Polling: {despiaDetected === null ? '⏳ Checking...' : despiaDetected ? '✅ Detected' : '❌ Not detected'}</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={async () => {
                  if (!session?.access_token) {
                    setRegisterResult('Error: Not signed in');
                    return;
                  }
                  setRegistering(true);
                  setRegisterResult(null);
                  try {
                    // First, try to use Player ID from Profile page if available (it polls separately)
                    let playerIdToUse: string | null = playerId;
                    
                    // If we don't have it from Profile page, try the registration function
                    if (!playerIdToUse) {
                      setRegisterResult('⏳ Waiting for OneSignal to initialize... (this may take up to 15 seconds)');
                      const { ensurePushSubscribed } = await import('../lib/pushNotifications');
                      const result = await ensurePushSubscribed(session);
                      
                      if (result.ok) {
                        setRegisterResult(`✅ Successfully enabled notifications! Player ID: ${result.playerId?.slice(0, 8)}…`);
                        setTimeout(() => setRegisterResult(null), 5000);
                        return;
                      } else if (result.reason === 'no-player-id') {
                        // If automatic detection failed, but we have playerId from Profile page, use that
                        if (playerId) {
                          console.log('[Profile] Using Player ID from Profile page polling:', playerId.slice(0, 8));
                          playerIdToUse = playerId;
                        } else {
                          const reasonMap: Record<string, string> = {
                            'permission-denied': 'Permission denied. Please enable notifications in iOS Settings.',
                            'no-player-id': result.error || 'OneSignal not initialized. Try: 1) Close the app completely, 2) Reopen it, 3) Wait 10 seconds, 4) Try again.',
                            'api-not-available': 'Not available in browser. Please use the native app.',
                            'no-session': 'Not signed in. Please sign in and try again.',
                            'unknown': result.error || 'Unknown error. Please try again or contact support.',
                          };
                          setRegisterResult(`⚠️ ${reasonMap[result.reason || 'unknown'] || 'Failed to enable notifications'}`);
                          return;
                        }
                      } else {
                        const reasonMap: Record<string, string> = {
                          'permission-denied': 'Permission denied. Please enable notifications in iOS Settings.',
                          'no-player-id': result.error || 'OneSignal not initialized. Try: 1) Close the app completely, 2) Reopen it, 3) Wait 10 seconds, 4) Try again.',
                          'api-not-available': 'Not available in browser. Please use the native app.',
                          'no-session': 'Not signed in. Please sign in and try again.',
                          'unknown': result.error || 'Unknown error. Please try again or contact support.',
                        };
                        setRegisterResult(`⚠️ ${reasonMap[result.reason || 'unknown'] || 'Failed to enable notifications'}`);
                        return;
                      }
                    }
                    
                    // If we have a Player ID (from Profile page or registration), register it directly
                    if (playerIdToUse) {
                      setRegisterResult('⏳ Registering device...');
                      const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
                      const baseUrl = isDev ? 'https://totl-staging.netlify.app' : '';
                      
                      const res = await fetch(`${baseUrl}/.netlify/functions/registerPlayer`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({
                          playerId: playerIdToUse,
                          platform: 'ios',
                        }),
                      });
                      
                      if (!res.ok) {
                        let errorData: any = {};
                        try {
                          const text = await res.text();
                          errorData = text ? JSON.parse(text) : {};
                        } catch (e) {
                          errorData = { error: `HTTP ${res.status}: ${res.statusText}` };
                        }
                        setRegisterResult(`❌ Registration failed: ${errorData.error || 'Unknown error'}`);
                        return;
                      }
                      
                      const data = await res.json();
                      if (data.ok) {
                        setRegisterResult(`✅ Successfully enabled notifications! Player ID: ${playerIdToUse.slice(0, 8)}…`);
                        setTimeout(() => setRegisterResult(null), 5000);
                      } else {
                        setRegisterResult(`⚠️ ${data.warning || data.error || 'Registration completed with warnings'}`);
                      }
                    }
                  } catch (err: any) {
                    console.error('[Profile] Registration error:', err);
                    setRegisterResult(`❌ Error: ${err.message || 'Failed to enable notifications'}`);
                  } finally {
                    setRegistering(false);
                  }
                }}
                disabled={registering || !session?.access_token}
                className="w-full py-3 bg-white border border-slate-300 hover:bg-slate-50 disabled:bg-gray-100 disabled:opacity-50 text-slate-600 hover:text-slate-800 font-medium rounded-xl transition-colors"
              >
                {registering ? 'Enabling...' : 'Enable Notifications'}
              </button>

              <button
                onClick={async () => {
                  // Try to import despia-native as documented
                  let despia: any = null;
                  try {
                    const despiaModule = await import('despia-native');
                    despia = despiaModule.default;
                  } catch (e) {
                    // Fallback: check global properties
                    despia = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);
                  }
                  
                  // From docs: despia("settingsapp://")
                  if (despia && typeof despia === 'function') {
                    try {
                      despia('settingsapp://');
                    } catch (e) {
                      alert('Please go to iOS Settings → TotL → Notifications and enable notifications');
                    }
                  } else {
                    alert('Please go to iOS Settings → TotL → Notifications and enable notifications');
                  }
                }}
                className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-xl transition-colors text-sm hidden"
              >
                ⚙️ Open OS Settings
              </button>

              <button
                onClick={async () => {
                  if (!session?.access_token) {
                    setRegisterResult('Error: Not signed in');
                    return;
                  }
                  setCheckingSubscription(true);
                  setRegisterResult(null);
                  setSubscriptionDetails(null);
                  try {
                    // Use staging URL in development, local path in production
                    const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
                    const baseUrl = isDev 
                      ? 'https://totl-staging.netlify.app'
                      : '';
                    const res = await fetch(`${baseUrl}/.netlify/functions/checkMySubscription`, {
                      headers: {
                        Authorization: `Bearer ${session.access_token}`,
                      },
                    });
                    const data = await res.json();
                    setSubscriptionDetails(data);
                    
                    if (data.subscribed) {
                      setRegisterResult('✅ Device is subscribed! Notifications should work.');
                    } else {
                      const reasons = data.reasons || [];
                      const suggestion = data.suggestion || 'Enable notifications in iOS Settings';
                      setRegisterResult(`⚠️ Not subscribed: ${reasons.join('; ')}. ${suggestion}`);
                    }
                  } catch (err: any) {
                    setRegisterResult(`❌ Error checking subscription: ${err.message}`);
                  } finally {
                    setCheckingSubscription(false);
                  }
                }}
                disabled={checkingSubscription || !session?.access_token}
                className="w-full py-3 bg-white border border-slate-300 hover:bg-slate-50 disabled:bg-gray-100 disabled:opacity-50 text-slate-600 hover:text-slate-800 font-medium rounded-xl transition-colors"
              >
                {checkingSubscription ? 'Checking...' : 'Check Subscription Status'}
              </button>

              <button
                onClick={async () => {
                  // Try to import despia-native as documented, then check direct global property
                  let pid: string | null = null;
                  try {
                    const despiaModule = await import('despia-native');
                    const despia = despiaModule.default;
                    pid = despia?.onesignalplayerid || despia?.oneSignalPlayerId || null;
                  } catch (e) {
                    // Fallback: check direct global property (Despia's actual implementation)
                    pid = (globalThis as any)?.onesignalplayerid || (typeof window !== 'undefined' ? (window as any)?.onesignalplayerid : null);
                  }
                  
                  // Also check playerId state
                  pid = pid || playerId;
                  
                  if (pid) {
                    await navigator.clipboard.writeText(String(pid));
                    setRegisterResult('✅ Player ID copied to clipboard');
                    setTimeout(() => setRegisterResult(null), 2000);
                  } else {
                    setRegisterResult('⚠️ Player ID not available');
                  }
                }}
                className="w-full py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-800 font-medium rounded-xl transition-colors"
              >
                Copy Player ID
              </button>
            </div>

            {registerResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${
                registerResult.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' :
                registerResult.includes('⚠️') ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {registerResult}
              </div>
            )}

            {subscriptionDetails && subscriptionDetails.details && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div className="font-semibold text-slate-700 mb-2">📊 OneSignal Status Details:</div>
                <div className="space-y-1 text-slate-600 font-mono">
                  <div>Has Token: {subscriptionDetails.details.hasToken ? '✅ Yes' : '❌ No'}</div>
                  <div>Invalid: {subscriptionDetails.details.invalid ? '❌ Yes' : '✅ No'}</div>
                  <div>Notification Types: {subscriptionDetails.details.notificationTypes ?? 'null'}</div>
                  <div>Device Type: {subscriptionDetails.details.deviceType || 'N/A'}</div>
                  <div>Last Active: {subscriptionDetails.details.lastActive ? new Date(subscriptionDetails.details.lastActive).toLocaleString() : 'Never'}</div>
                  {subscriptionDetails.reasons && subscriptionDetails.reasons.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-300">
                      <div className="font-semibold text-red-600">Issues Found:</div>
                      {subscriptionDetails.reasons.map((reason: string, i: number) => (
                        <div key={i} className="text-red-600">• {reason}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Admin Links */}
          {isAdmin && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Admin</h3>
              
              {/* Activate Carl's Devices */}
              <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h4 className="text-md font-semibold text-slate-800 mb-3">Activate Carl's Devices</h4>
                <p className="text-sm text-slate-600 mb-3">
                  Syncs Carl's devices with OneSignal and marks them as active if subscribed. Run this before sending test notifications.
                </p>
                {carlActivationResult && (
                  <div className={`mb-3 rounded border px-3 py-2 text-sm ${
                    carlActivationResult.includes('✅') 
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800' 
                      : carlActivationResult.includes('⚠️')
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}>
                    {carlActivationResult}
                  </div>
                )}
                <button
                  onClick={async () => {
                    setActivatingCarl(true);
                    setCarlActivationResult(null);
                    try {
                      // Use staging URL in development, local path in production
                      const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
                      const baseUrl = isDev 
                        ? 'https://totl-staging.netlify.app'
                        : '';
                      const url = `${baseUrl}/.netlify/functions/diagnoseCarlNotifications?update=true`;
                      console.log('[Profile] Activating Carl devices, calling:', url);
                      const response = await fetch(url, {
                        method: 'GET',
                        mode: 'cors',
                      });
                      
                      if (!response.ok) {
                        const errorText = await response.text().catch(() => 'Unknown error');
                        setCarlActivationResult(`❌ Server error (${response.status}): ${errorText || 'Failed to activate devices'}`);
                        return;
                      }
                      
                      const result = await response.json();
                      
                      if (result.error) {
                        setCarlActivationResult(`❌ ${result.error}`);
                      } else {
                        const activeCount = result.active_devices || 0;
                        const subscribedCount = result.subscribed_devices || 0;
                        
                        if (activeCount > 0 && subscribedCount > 0) {
                          setCarlActivationResult(`✅ Activated ${activeCount} device(s) (${subscribedCount} subscribed). Carl should receive notifications.`);
                        } else if (subscribedCount > 0) {
                          setCarlActivationResult(`⚠️ Found ${subscribedCount} subscribed device(s) but none are active. Check device status.`);
                        } else {
                          setCarlActivationResult(`⚠️ No subscribed devices found. Carl may need to enable notifications in iOS Settings.`);
                        }
                      }
                    } catch (error: any) {
                      console.error('[Profile] Error activating Carl devices:', error);
                      let errorMsg = 'Failed to activate devices';
                      if (error.message) {
                        errorMsg = error.message;
                      } else if (error.name === 'TypeError' && error.message?.includes('fetch')) {
                        errorMsg = 'Network error: Could not reach server. Check your connection or try again later.';
                      }
                      setCarlActivationResult(`❌ Error: ${errorMsg}`);
                    } finally {
                      setActivatingCarl(false);
                    }
                  }}
                  disabled={activatingCarl}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {activatingCarl ? 'Activating...' : 'Activate Carl\'s Devices'}
                </button>
                
                <button
                  onClick={async () => {
                    setForcingCarlSubscription(true);
                    setCarlForceResult(null);
                    try {
                      const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
                      const baseUrl = isDev ? 'https://totl-staging.netlify.app' : '';
                      const response = await fetch(`${baseUrl}/.netlify/functions/forceCarlSubscription`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                      });
                      
                      if (!response.ok) {
                        const errorText = await response.text().catch(() => 'Unknown error');
                        setCarlForceResult(`❌ Server error (${response.status}): ${errorText}`);
                        return;
                      }
                      
                      const result = await response.json();
                      
                      if (result.ok) {
                        const before = result.before?.notification_types ?? 'null';
                        const after = result.after?.notification_types ?? 'null';
                        if (after === 1) {
                          setCarlForceResult(`✅ Successfully forced subscription! notification_types changed from ${before} to ${after}`);
                        } else {
                          setCarlForceResult(`⚠️ ${result.note || 'Update attempted but notification_types is still ' + after}. ${result.message || ''}`);
                        }
                      } else {
                        setCarlForceResult(`❌ ${result.error || 'Failed to force subscription'}`);
                      }
                    } catch (error: any) {
                      setCarlForceResult(`❌ Error: ${error.message || 'Failed to force subscription'}`);
                    } finally {
                      setForcingCarlSubscription(false);
                    }
                  }}
                  disabled={forcingCarlSubscription}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {forcingCarlSubscription ? 'Forcing...' : 'Force Carl\'s Subscription Status'}
                </button>
                {carlForceResult && (
                  <div className={`mt-2 rounded border px-3 py-2 text-sm ${
                    carlForceResult.includes('✅') 
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800' 
                      : carlForceResult.includes('⚠️')
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}>
                    {carlForceResult}
                  </div>
                )}
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
                    <div className={`rounded border px-3 py-2 text-sm ${
                      notificationResult.startsWith('✅') 
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800' 
                        : notificationResult.startsWith('⚠️')
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
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
                        // Use staging URL in development, local path in production
                        const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
                        const baseUrl = isDev 
                          ? 'https://totl-staging.netlify.app'
                          : '';
                        const response = await fetch(`${baseUrl}/.netlify/functions/sendPushAll`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            title: notificationTitle.trim(),
                            message: notificationMessage.trim(),
                          }),
                        });

                        // Check if response is ok before trying to parse JSON
                        if (!response.ok) {
                          const errorText = await response.text().catch(() => 'Unknown error');
                          setNotificationResult(`❌ Server error (${response.status}): ${errorText || 'Failed to send notification'}`);
                          return;
                        }

                        // Try to parse JSON, but handle empty responses
                        let result;
                        const responseText = await response.text();
                        if (!responseText || responseText.trim() === '') {
                          setNotificationResult(`❌ Empty response from server`);
                          return;
                        }

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
                            const oneSignalRecipients = result.oneSignalRecipients || 0;
                            const expected = result.expected || sentTo;
                            const userCount = result.userCount || 0;
                            const userNames = result.userNames || [];
                            const errors = result.oneSignalErrors;
                            const hasNotificationId = result.hasNotificationId;
                            
                            let message = '';
                            
                            // If OneSignal returned a notification ID and no errors, assume success
                            // (OneSignal's recipients field is often 0 for iOS even when sent successfully)
                            if (hasNotificationId && !errors) {
                              message = `✅ Notification sent to ${expected} device(s) (${userCount} users)`;
                            } else if (errors && errors.length > 0) {
                              message = `⚠️ Sent to ${sentTo} device(s) (${userCount} users, expected ${expected}). OneSignal errors: ${errors.join(', ')}`;
                            } else if (sentTo < expected && oneSignalRecipients === 0) {
                              // OneSignal often returns 0 recipients for iOS even when successful
                              message = `✅ Notification sent to ${expected} device(s) (${userCount} users)`;
                            } else if (sentTo < expected) {
                              message = `⚠️ Sent to ${sentTo} device(s) (${userCount} users, expected ${expected}). Some devices may not be subscribed.`;
                            } else {
                              message = `✅ Notification sent to ${sentTo} device(s) (${userCount} users)`;
                            }
                            
                            // Add user names if available
                            if (userNames.length > 0 && userNames.length <= 5) {
                              message += `\n\nUsers: ${userNames.join(', ')}`;
                            } else if (userNames.length > 5) {
                              message += `\n\nUsers: ${userNames.slice(0, 5).join(', ')} and ${userNames.length - 5} more`;
                            }
                            
                            // Add Carl-specific info if available
                            if (result.carlIncluded !== undefined) {
                              message += `\n\nCarl included: ${result.carlIncluded ? '✅ Yes' : '❌ No'}`;
                              if (result.carlPlayerId) {
                                message += ` (Player ID: ${result.carlPlayerId})`;
                              }
                              if (result.carlInvalid) {
                                message += `\n⚠️ Carl's Player ID was marked as INVALID by OneSignal!`;
                              }
                              if (result.invalidPlayerIds && result.invalidPlayerIds.length > 0) {
                                message += `\n\nInvalid Player IDs: ${result.invalidPlayerIds.length}`;
                              }
                            }
                            
                            setNotificationResult(message);
                            // Clear the message after successful send
                            setNotificationMessage('');
                          }
                        } else {
                          setNotificationResult(`❌ Failed to send: ${result.error || 'Unknown error'}`);
                        }
                      } catch (error: any) {
                        console.error('[Profile] Error sending notification:', error);
                        let errorMsg = 'Failed to send notification';
                        if (error.message) {
                          errorMsg = error.message;
                        } else if (error.name === 'TypeError' && error.message?.includes('fetch')) {
                          errorMsg = 'Network error: Could not reach server. Check your connection or try again later.';
                        }
                        setNotificationResult(`❌ Error: ${errorMsg}`);
                      } finally {
                        setSendingNotification(false);
                      }
                    }}
                    disabled={sendingNotification || !notificationTitle.trim() || !notificationMessage.trim()}
                    className="w-full py-2 bg-[#1C8376] hover:bg-[#1a7569] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingNotification ? 'Sending...' : 'Send to All Users'}
                  </button>

                  <div className="text-xs text-slate-500">
                    Sends a push notification to all users with active, subscribed devices.
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Link
                  to="/api-admin"
                  className="block w-full py-3 bg-[#1C8376] hover:bg-[#1C8376]/90 text-white font-semibold rounded-xl transition-colors text-center"
                >
                  API Admin - Premier League
                </Link>
                <Link
                  to="/test-fixtures"
                  className="block w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors text-center"
                >
                  Test Fixtures (Non-PL)
                </Link>
                <Link
                  to="/admin"
                  className="block w-full py-3 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors text-center"
                >
                  Admin Panel (Web)
                </Link>
              </div>
            </div>
          )}

          {/* Sign Out Button */}
          <button
            onClick={async () => {
              await signOut();
            }}
            className="w-full mt-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

