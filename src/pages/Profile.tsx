import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';

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
  const [despiaDetected, setDespiaDetected] = useState<boolean | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

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

          {/* Push Notifications - Self-Serve Fix Screen */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Push Notifications</h3>
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
                    const { ensurePushSubscribed } = await import('../lib/pushNotifications');
                    const result = await ensurePushSubscribed(session);
                    
                    if (result.ok) {
                      setRegisterResult(`✅ Successfully enabled notifications! Player ID: ${result.playerId?.slice(0, 8)}…`);
                      setTimeout(() => setRegisterResult(null), 5000);
                    } else {
                      const reasonMap: Record<string, string> = {
                        'permission-denied': 'Permission denied. Please enable notifications in iOS Settings.',
                        'no-player-id': 'OneSignal not initialized. Please wait a few seconds and try again.',
                        'api-not-available': 'Not available in browser. Please use the native app.',
                        'no-session': 'Not signed in. Please sign in and try again.',
                        'unknown': 'Unknown error. Please try again or contact support.',
                      };
                      setRegisterResult(`⚠️ ${reasonMap[result.reason || 'unknown'] || 'Failed to enable notifications'}`);
                    }
                  } catch (err: any) {
                    setRegisterResult(`❌ Error: ${err.message || 'Failed to enable notifications'}`);
                  } finally {
                    setRegistering(false);
                  }
                }}
                disabled={registering || !session?.access_token}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
              >
                {registering ? 'Enabling...' : '🔔 Enable Notifications'}
              </button>

              <button
                onClick={() => {
                  // Deep link to iOS Settings (if available)
                  const despia: any = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);
                  if (despia && typeof despia.openSettings === 'function') {
                    despia.openSettings();
                  } else {
                    alert('Please go to iOS Settings → TotL → Notifications and enable notifications');
                  }
                }}
                className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-xl transition-colors text-sm"
              >
                ⚙️ Open OS Settings
              </button>

              <button
                onClick={async () => {
                  const despia: any = (globalThis as any)?.despia || (typeof window !== 'undefined' ? (window as any)?.despia : null);
                  const pid = despia?.onesignalplayerid || despia?.oneSignalPlayerId;
                  if (pid) {
                    await navigator.clipboard.writeText(pid);
                    setRegisterResult('✅ Player ID copied to clipboard');
                    setTimeout(() => setRegisterResult(null), 2000);
                  } else {
                    setRegisterResult('⚠️ Player ID not available');
                  }
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors text-sm"
              >
                📋 Copy Player ID
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
          </div>

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

