import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchUserLeagues } from '../services/userLeagues';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { AccountMenu } from '../components/profile/AccountMenu';
import { PageHeader } from '../components/PageHeader';

// Profile page with push notification diagnostics

interface UserStats {
  ocp: number;
  miniLeaguesCount: number;
  weeksStreak: number;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  
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
          .from('app_submissions')
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
  const menuItems = [
    {
      to: '/profile/notifications',
      icon: (
        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      label: 'Notification Centre',
    },
    {
      to: '/profile/email-preferences',
      icon: (
        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      label: 'Email Preferences',
    },
    {
      to: '/how-to-play',
      icon: (
        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: 'Help',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6">
        {/* Page Title */}
        <PageHeader title="Profile" as="h1" className="mb-6" />

        {/* Profile Header with Stats */}
        <ProfileHeader
          name={user.user_metadata?.display_name}
          email={user.email}
          stats={stats}
          loading={loading}
        />

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
          <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <Link
              to="/admin-data"
                  className="block w-full py-3 bg-[#1C8376] hover:bg-[#1C8376]/90 text-white font-semibold rounded-xl transition-colors text-center"
                >
              Admin Data
                </Link>
            </div>
          )}
      </div>
    </div>
  );
}

