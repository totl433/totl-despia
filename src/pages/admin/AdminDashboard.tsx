import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type Stats = {
  totalLeaderboards: number;
  activeLeaderboards: number;
  totalMembers: number;
  activeSubs: number;
  totalRevenueCents: number;
  pendingPayouts: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentLeaderboards, setRecentLeaderboards] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [lbRes, activeRes, memRes, subsRes, revenueRes, payoutsRes, recentRes] = await Promise.all([
        supabase.from('branded_leaderboards').select('id', { count: 'exact', head: true }),
        supabase.from('branded_leaderboards').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('branded_leaderboard_memberships').select('id', { count: 'exact', head: true }).is('left_at', null),
        supabase.from('branded_leaderboard_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('branded_leaderboard_revenue_events').select('amount_cents').in('event_type', ['purchase', 'renewal']),
        supabase.from('branded_leaderboard_payouts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('branded_leaderboards').select('id, display_name, status, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      const totalRevenue = (revenueRes.data ?? []).reduce((sum: number, e: any) => sum + (e.amount_cents ?? 0), 0);

      setStats({
        totalLeaderboards: lbRes.count ?? 0,
        activeLeaderboards: activeRes.count ?? 0,
        totalMembers: memRes.count ?? 0,
        activeSubs: subsRes.count ?? 0,
        totalRevenueCents: totalRevenue,
        pendingPayouts: payoutsRes.count ?? 0,
      });
      setRecentLeaderboards(recentRes.data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    archived: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-500 mt-1">Branded Leaderboards overview</p>
          </div>
          <Link
            to="/admin/leaderboards"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Manage Leaderboards
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard label="Total LBs" value={stats?.totalLeaderboards ?? 0} />
          <StatCard label="Active LBs" value={stats?.activeLeaderboards ?? 0} />
          <StatCard label="Members" value={stats?.totalMembers ?? 0} />
          <StatCard label="Active Subs" value={stats?.activeSubs ?? 0} />
          <StatCard
            label="Revenue"
            value={`${((stats?.totalRevenueCents ?? 0) / 100).toFixed(2)}`}
          />
          <StatCard label="Pending Payouts" value={stats?.pendingPayouts ?? 0} />
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link
            to="/admin/leaderboards"
            className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 mb-1">Leaderboards</h3>
            <p className="text-sm text-gray-500">Create, edit, and manage branded leaderboards</p>
          </Link>
          <Link
            to="/admin/payouts"
            className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 mb-1">Payouts</h3>
            <p className="text-sm text-gray-500">Manage influencer revenue share payouts</p>
          </Link>
          <Link
            to="/admin/reporting"
            className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 transition-colors"
          >
            <h3 className="font-semibold text-gray-900 mb-1">Reporting</h3>
            <p className="text-sm text-gray-500">Cross-leaderboard analytics and reporting</p>
          </Link>
        </div>

        {/* Recent leaderboards */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Leaderboards</h2>
          {recentLeaderboards.length === 0 ? (
            <p className="text-gray-500 text-sm">No leaderboards yet</p>
          ) : (
            <div className="space-y-2">
              {recentLeaderboards.map((lb: any) => (
                <Link
                  key={lb.id}
                  to={`/admin/leaderboards/${lb.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium text-gray-900">{lb.display_name}</span>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[lb.status] ?? ''}`}>
                      {lb.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(lb.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <Link to="/admin" className="text-blue-600 hover:text-blue-800 text-sm">
            &larr; Back to Admin
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
