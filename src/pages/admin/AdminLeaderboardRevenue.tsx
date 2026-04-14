import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type RevenueEvent = {
  id: string;
  event_type: string;
  amount_cents: number;
  currency: string;
  created_at: string;
  user_id: string;
};

type Payout = {
  id: string;
  period: string;
  gross_revenue_cents: number;
  influencer_share_cents: number;
  status: string;
  paid_at: string | null;
};

export default function AdminLeaderboardRevenue() {
  const { id } = useParams<{ id: string }>();
  const [lbName, setLbName] = useState('');
  const [events, setEvents] = useState<RevenueEvent[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [activeSubs, setActiveSubs] = useState(0);
  const [totalSubs, setTotalSubs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [lbRes, eventsRes, payoutsRes, subsRes] = await Promise.all([
        supabase.from('branded_leaderboards').select('display_name').eq('id', id!).maybeSingle(),
        supabase.from('branded_leaderboard_revenue_events').select('*').eq('leaderboard_id', id!).order('created_at', { ascending: false }).limit(100),
        supabase.from('branded_leaderboard_payouts').select('*').eq('leaderboard_id', id!).order('created_at', { ascending: false }),
        supabase.from('branded_leaderboard_subscriptions').select('id, status').eq('leaderboard_id', id!),
      ]);
      setLbName(lbRes.data?.display_name ?? '');
      setEvents(eventsRes.data ?? []);
      setPayouts(payoutsRes.data ?? []);
      const subs = subsRes.data ?? [];
      setActiveSubs(subs.filter((s: any) => s.status === 'active').length);
      setTotalSubs(subs.length);
      setLoading(false);
    })();
  }, [id]);

  const totalRevenue = events
    .filter((e) => e.event_type === 'purchase' || e.event_type === 'renewal')
    .reduce((sum, e) => sum + e.amount_cents, 0);

  const eventTypeColor: Record<string, string> = {
    purchase: 'bg-green-100 text-green-700',
    renewal: 'bg-blue-100 text-blue-700',
    cancellation: 'bg-orange-100 text-orange-700',
    refund: 'bg-red-100 text-red-700',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to={`/admin/leaderboards/${id}`} className="text-blue-600 hover:text-blue-800 text-sm">
            &larr; Back to {lbName || 'Leaderboard'}
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Revenue — {lbName}</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">{(totalRevenue / 100).toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Active Subs</p>
            <p className="text-2xl font-bold text-gray-900">{activeSubs}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Subs</p>
            <p className="text-2xl font-bold text-gray-900">{totalSubs}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Events</p>
            <p className="text-2xl font-bold text-gray-900">{events.length}</p>
          </div>
        </div>

        {/* Payouts */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payouts</h2>
          {payouts.length === 0 ? (
            <p className="text-gray-500 text-sm">No payouts yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-gray-500 font-medium">Period</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Gross</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Influencer Share</th>
                    <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                    <th className="text-right py-2 text-gray-500 font-medium">Paid At</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="py-2">{p.period}</td>
                      <td className="py-2 text-right">{(p.gross_revenue_cents / 100).toFixed(2)}</td>
                      <td className="py-2 text-right">{(p.influencer_share_cents / 100).toFixed(2)}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.status === 'paid' ? 'bg-green-100 text-green-700' :
                          p.status === 'held' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{p.status}</span>
                      </td>
                      <td className="py-2 text-right text-gray-500">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Revenue events */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Events</h2>
          {events.length === 0 ? (
            <p className="text-gray-500 text-sm">No events yet</p>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${eventTypeColor[e.event_type] ?? 'bg-gray-100 text-gray-700'}`}>
                      {e.event_type}
                    </span>
                    <span className="text-sm text-gray-600">{e.user_id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">
                      {(e.amount_cents / 100).toFixed(2)} {e.currency}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
