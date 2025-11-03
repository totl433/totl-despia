import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';

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

          {/* Push Notifications */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Push Notifications</h3>
            <p className="text-sm text-slate-600 mb-4">
              Register your device to receive chat notifications in mini-leagues.
            </p>
            <button
              onClick={async () => {
                if (!session?.access_token) {
                  setRegisterResult('Error: Not signed in');
                  return;
                }
                setRegistering(true);
                setRegisterResult(null);
                try {
                  // Try to get Player ID
                  let playerId: string | null = null;
                  
                  // Try globalThis.despia
                  const g: any = (globalThis as any);
                  if (g?.despia?.onesignalplayerid) {
                    playerId = g.despia.onesignalplayerid.trim();
                  }
                  
                  // Try window.despia
                  if (!playerId && typeof window !== 'undefined') {
                    const w: any = (window as any);
                    if (w?.despia?.onesignalplayerid) {
                      playerId = w.despia.onesignalplayerid.trim();
                    }
                  }
                  
                  // Try dynamic import
                  if (!playerId) {
                    try {
                      const mod = await import('despia-native');
                      const despia: any = mod?.default || mod;
                      if (despia?.onesignalplayerid) {
                        playerId = despia.onesignalplayerid.trim();
                      }
                    } catch {}
                  }
                  
                  if (!playerId) {
                    setRegisterResult('⚠️ Player ID not found. Make sure you\'re using the native app.');
                    return;
                  }
                  
                  const res = await fetch('/.netlify/functions/registerPlayer', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ playerId, platform: 'ios' }),
                  });
                  
                  const data = await res.json();
                  if (res.ok) {
                    setRegisterResult(`✅ Successfully registered device!`);
                  } else {
                    setRegisterResult(`❌ Error: ${data.error || 'Registration failed'}`);
                  }
                } catch (err: any) {
                  setRegisterResult(`❌ Error: ${err.message || 'Failed to register'}`);
                } finally {
                  setRegistering(false);
                }
              }}
              disabled={registering || !session?.access_token}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
            >
              {registering ? 'Registering...' : '📱 Register Device for Notifications'}
            </button>
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

