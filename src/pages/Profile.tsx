import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchUserLeagues } from '../services/userLeagues';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { AccountMenu } from '../components/profile/AccountMenu';
import { PageHeader } from '../components/PageHeader';
import ThemeToggle from '../components/ThemeToggle';
import { isWebBrowser } from '../lib/platform';

interface UserStats {
  ocp: number;
  miniLeaguesCount: number;
  weeksStreak: number;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteFinalModal, setShowDeleteFinalModal] = useState(false);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [deleteTypeToConfirm, setDeleteTypeToConfirm] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // Admin check
  const isAdmin = user?.id === '4542c037-5b38-40d0-b189-847b8f17c222' || user?.id === '36f31625-6d6c-4aa4-815a-1493a812841b';

  useEffect(() => {
    fetchUserStats();
  }, [user]);

  async function fetchUserStats() {
    if (!user) return;

    try {
      // Fetch OCP from v_ocp_overall view
      const { data: standings, error: standingsError } = await supabase
        .from('v_ocp_overall')
        .select('user_id, ocp')
        .eq('user_id', user.id)
        .maybeSingle();

      if (standingsError) {
        console.error('Error fetching standings:', standingsError);
      }

      const ocp = standings?.ocp || 0;

      // Fetch mini leagues count
      const leagues = await fetchUserLeagues(user.id);
      const miniLeaguesCount = leagues.length;

      // Calculate weeks streak
      // Get latest completed GW
      const { data: latestGwData } = await supabase
        .from('app_gw_results')
        .select('gw')
        .order('gw', { ascending: false })
        .limit(1)
        .maybeSingle();

      const latestGw = latestGwData?.gw || 0;

      // Get user's GW points and submissions
      const [gwPointsResult, submissionsResult] = await Promise.all([
        supabase
          .from('app_v_gw_points')
          .select('gw, points')
          .eq('user_id', user.id)
          .order('gw', { ascending: false }),
        supabase
          .from('gw_submissions')
          .select('gw')
          .eq('user_id', user.id)
          .order('gw', { ascending: false })
      ]);

      const gwPoints = gwPointsResult.data || [];
      const submissions = submissionsResult.data || [];
      
      // Create sets for quick lookup
      const gwPointsSet = new Set(gwPoints.map((p: any) => p.gw));
      const submissionsSet = new Set(submissions.map((s: any) => s.gw));

      // Calculate streak: count consecutive gameweeks backwards from latestGw
      let weeksStreak = 0;
      for (let gw = latestGw; gw >= 1; gw--) {
        const hasPoints = gwPointsSet.has(gw);
        const hasSubmission = submissionsSet.has(gw);
        
        if (hasPoints || hasSubmission) {
          weeksStreak++;
        } else {
          // Break streak if we hit a GW with no points and no submission
          break;
        }
      }

      setStats({
        ocp,
        miniLeaguesCount,
        weeksStreak,
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

  // Menu items with icons (Stats removed - now has its own section)
  // Hide Notification Centre on web browsers (only show in native app)
  const menuItems = [
    // Only show Notification Centre in native app (not on web)
    ...(isWebBrowser() ? [] : [{
      to: '/profile/notifications',
      icon: (
        <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      label: 'Notification Centre',
    }]),
    {
      to: '/profile/email-preferences',
      icon: (
        <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      label: 'Email Preferences',
    },
    {
      to: '/how-to-play',
      icon: (
        <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'How To Play',
    },
    {
      to: 'mailto:hello@playtotl.com',
      icon: (
        <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      label: 'Contact Us',
    },
    {
      to: '/privacy-policy',
      icon: (
        <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      label: 'Privacy Policy',
    },
    {
      to: '/terms-and-conditions',
      icon: (
        <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      label: 'Terms and Conditions',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-x-hidden">
      {/* Extra bottom padding so destructive actions aren't covered by BottomNav on mobile */}
      <div className="max-w-4xl lg:max-w-[1024px] mx-auto px-4 lg:px-6 py-6 sm:p-6 pb-28 lg:pb-6">
        {/* Page Title */}
        <PageHeader title="Profile" as="h1" className="mb-6" />

        {/* Profile Header with Stats */}
        <ProfileHeader
          name={user.user_metadata?.display_name}
          email={user.email}
          stats={stats}
          loading={loading}
        />

        {/* Theme Toggle - mobile/app only (desktop is always light) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 mt-6 mb-6 lg:hidden">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Appearance</h2>
          <ThemeToggle />
        </div>

        {/* Account Menu */}
        <AccountMenu
          email={user.email || ''}
          menuItems={menuItems}
          onLogout={async () => {
            await signOut();
          }}
        />

        {/* Admin Link - Separate section */}
          {isAdmin && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 mt-6">
                <Link
              to="/admin-data"
                  className="block w-full py-3 bg-[#1C8376] text-white font-semibold rounded-xl text-center"
                >
              Admin Data
                </Link>
            </div>
          )}

        {/* Delete Account (Apple requirement) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 mt-6 border border-rose-200 dark:border-rose-900/50">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Delete account</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            This will permanently delete your account and sign you out. This action cannot be undone.
          </p>
          <button
            onClick={() => {
              setDeleteError(null);
              setDeleteConfirmChecked(false);
              setDeleteTypeToConfirm('');
              setShowDeleteModal(true);
            }}
            className="mt-4 w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl"
          >
            Delete my account
          </button>
          {deleteError && (
            <div className="mt-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40 rounded-lg p-3">
              {deleteError}
            </div>
          )}
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                  STEP 1 OF 2
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Are you sure?</h3>
              </div>
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40 rounded-full px-3 py-1">
                Required
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              Deleting your account will permanently remove your data and you will lose access to your mini leagues and history.
            </p>

            <label
              className={`mt-4 block rounded-xl border bg-slate-50 dark:bg-slate-900/30 cursor-pointer ${
                deleteConfirmChecked
                  ? 'border-emerald-200 dark:border-emerald-900/40'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {/* Native checkboxes are hidden by global CSS in this app; render a custom checkbox UI. */}
              <input
                type="checkbox"
                checked={deleteConfirmChecked}
                onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                className="sr-only"
              />
              <div className="flex items-start gap-4 p-4">
                <div
                  className={`mt-0.5 h-7 w-7 rounded-md border flex items-center justify-center ${
                    deleteConfirmChecked
                      ? 'bg-rose-600 border-rose-600'
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                  }`}
                  aria-hidden="true"
                >
                  {deleteConfirmChecked && (
                    <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 010 1.414l-7.1 7.1a1 1 0 01-1.414 0l-3.494-3.494a1 1 0 011.414-1.414l2.787 2.787 6.393-6.393a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    I understand this cannot be undone.
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    Tap anywhere in this box to confirm.
                  </div>
                </div>
              </div>
            </label>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  if (deletingAccount) return;
                  setShowDeleteModal(false);
                }}
                className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={!deleteConfirmChecked || deletingAccount}
                onClick={async () => {
                  if (!deleteConfirmChecked || deletingAccount) return;
                  setDeleteTypeToConfirm('');
                  setShowDeleteModal(false);
                  setShowDeleteFinalModal(true);
                }}
                className={`flex-1 py-3 rounded-xl font-semibold text-white ${
                  !deleteConfirmChecked || deletingAccount ? 'bg-rose-300 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final Delete Account Modal (type-to-confirm) */}
      {showDeleteFinalModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-6 border border-rose-200 dark:border-rose-900/50">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Final confirmation</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              Type <span className="font-mono font-semibold">DELETE</span> to permanently delete your account.
            </p>

            <input
              value={deleteTypeToConfirm}
              onChange={(e) => setDeleteTypeToConfirm(e.target.value)}
              placeholder="Type DELETE"
              className="mt-4 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/30 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  if (deletingAccount) return;
                  setShowDeleteFinalModal(false);
                }}
                className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={deletingAccount || deleteTypeToConfirm.trim().toUpperCase() !== 'DELETE'}
                onClick={async () => {
                  if (deletingAccount) return;
                  if (deleteTypeToConfirm.trim().toUpperCase() !== 'DELETE') return;
                  setDeletingAccount(true);
                  setDeleteError(null);
                  try {
                    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
                    if (sessionError) throw sessionError;
                    const accessToken = sessionData?.session?.access_token;
                    if (!accessToken) throw new Error('No active session. Please sign in again and retry.');

                    const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
                    const baseUrl = isDev ? 'https://totl-staging.netlify.app' : '';

                    const res = await fetch(`${baseUrl}/.netlify/functions/deleteAccount`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                      },
                      body: JSON.stringify({ confirm: true }),
                    });

                    const text = await res.text();
                    let json: any = null;
                    try {
                      json = text ? JSON.parse(text) : null;
                    } catch {
                      json = null;
                    }

                    if (!res.ok || !json?.ok) {
                      const msg = json?.error || json?.details || text || `Failed to delete account (HTTP ${res.status})`;
                      throw new Error(msg);
                    }

                    await signOut();
                    navigate('/auth?deleted=1', { replace: true });
                  } catch (e: any) {
                    setDeleteError(e?.message || 'Failed to delete account');
                    setShowDeleteFinalModal(false);
                  } finally {
                    setDeletingAccount(false);
                  }
                }}
                className={`flex-1 py-3 rounded-xl font-semibold text-white ${
                  deletingAccount || deleteTypeToConfirm.trim().toUpperCase() !== 'DELETE'
                    ? 'bg-rose-300 cursor-not-allowed'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {deletingAccount ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

