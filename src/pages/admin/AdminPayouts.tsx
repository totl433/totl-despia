import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type Payout = {
  id: string;
  period: string;
  gross_revenue_cents: number;
  net_revenue_cents: number;
  totl_share_cents: number;
  influencer_share_cents: number;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  branded_leaderboards: { display_name: string } | null;
};

export default function AdminPayouts() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadPayouts() {
    const { data } = await supabase
      .from('branded_leaderboard_payouts')
      .select('*, branded_leaderboards(display_name)')
      .order('created_at', { ascending: false })
      .limit(200);
    setPayouts((data ?? []) as Payout[]);
    setLoading(false);
  }

  useEffect(() => { loadPayouts(); }, []);

  async function markPaid(id: string) {
    await supabase.from('branded_leaderboard_payouts').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    }).eq('id', id);
    loadPayouts();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    held: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/admin/dashboard" className="text-blue-600 hover:text-blue-800 text-sm">
            &larr; Back to Dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Payouts</h1>

        {payouts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">No payouts yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Leaderboard</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Period</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Gross</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Influencer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{p.branded_leaderboards?.display_name ?? '—'}</td>
                    <td className="px-4 py-3">{p.period}</td>
                    <td className="px-4 py-3 text-right">{(p.gross_revenue_cents / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{(p.influencer_share_cents / 100).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[p.status] ?? ''}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.status === 'pending' && (
                        <button
                          onClick={() => markPaid(p.id)}
                          className="text-green-600 hover:text-green-800 text-xs font-medium"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
