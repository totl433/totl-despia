import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type LeaderboardSummary = {
  id: string;
  display_name: string;
  status: string;
  price_type: string;
  memberCount: number;
  activeSubCount: number;
  revenueCents: number;
};

export default function AdminReporting() {
  const [summaries, setSummaries] = useState<LeaderboardSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: leaderboards } = await supabase
        .from('branded_leaderboards')
        .select('id, display_name, status, price_type')
        .order('created_at', { ascending: false });

      if (!leaderboards?.length) { setLoading(false); return; }

      const ids = leaderboards.map((lb: any) => lb.id);

      const [memRes, subsRes, revRes] = await Promise.all([
        supabase.from('branded_leaderboard_memberships').select('leaderboard_id').is('left_at', null).in('leaderboard_id', ids),
        supabase.from('branded_leaderboard_subscriptions').select('leaderboard_id, status').in('leaderboard_id', ids),
        supabase.from('branded_leaderboard_revenue_events').select('leaderboard_id, amount_cents, event_type').in('leaderboard_id', ids).in('event_type', ['purchase', 'renewal']),
      ]);

      const memberCountByLb = new Map<string, number>();
      (memRes.data ?? []).forEach((m: any) => {
        memberCountByLb.set(m.leaderboard_id, (memberCountByLb.get(m.leaderboard_id) ?? 0) + 1);
      });

      const activeSubCountByLb = new Map<string, number>();
      (subsRes.data ?? []).forEach((s: any) => {
        if (s.status === 'active') {
          activeSubCountByLb.set(s.leaderboard_id, (activeSubCountByLb.get(s.leaderboard_id) ?? 0) + 1);
        }
      });

      const revenueByLb = new Map<string, number>();
      (revRes.data ?? []).forEach((e: any) => {
        revenueByLb.set(e.leaderboard_id, (revenueByLb.get(e.leaderboard_id) ?? 0) + (e.amount_cents ?? 0));
      });

      setSummaries(leaderboards.map((lb: any) => ({
        id: lb.id,
        display_name: lb.display_name,
        status: lb.status,
        price_type: lb.price_type,
        memberCount: memberCountByLb.get(lb.id) ?? 0,
        activeSubCount: activeSubCountByLb.get(lb.id) ?? 0,
        revenueCents: revenueByLb.get(lb.id) ?? 0,
      })));
      setLoading(false);
    })();
  }, []);

  const totals = summaries.reduce(
    (acc, s) => ({
      members: acc.members + s.memberCount,
      subs: acc.subs + s.activeSubCount,
      revenue: acc.revenue + s.revenueCents,
    }),
    { members: 0, subs: 0, revenue: 0 }
  );

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
        <div className="mb-6">
          <Link to="/admin/dashboard" className="text-blue-600 hover:text-blue-800 text-sm">
            &larr; Back to Dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Reporting</h1>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Members</p>
            <p className="text-3xl font-bold text-gray-900">{totals.members}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Active Subscriptions</p>
            <p className="text-3xl font-bold text-gray-900">{totals.subs}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900">{(totals.revenue / 100).toFixed(2)}</p>
          </div>
        </div>

        {/* Per-leaderboard breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Leaderboard</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Type</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Members</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Active Subs</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summaries.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <Link to={`/admin/leaderboards/${s.id}`} className="font-medium text-blue-600 hover:text-blue-800">
                      {s.display_name}
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[s.status] ?? ''}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">{s.price_type}</td>
                  <td className="px-6 py-3 text-right">{s.memberCount}</td>
                  <td className="px-6 py-3 text-right">{s.activeSubCount}</td>
                  <td className="px-6 py-3 text-right">{(s.revenueCents / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
