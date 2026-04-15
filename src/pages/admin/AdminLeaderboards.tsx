import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type Leaderboard = {
  id: string;
  name: string;
  display_name: string;
  slug: string;
  status: string;
  price_type: string;
  season_price_cents: number;
  currency: string;
  visibility: string;
  created_at: string;
};

export default function AdminLeaderboards() {
  const navigate = useNavigate();
  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('branded_leaderboards')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setLeaderboards(data ?? []);
      setLoading(false);
    })();
  }, []);

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
            <h1 className="text-2xl font-bold text-gray-900">Branded Leaderboards</h1>
            <p className="text-gray-500 mt-1">Manage influencer and brand leaderboards</p>
          </div>
          <button
            onClick={() => navigate('/admin/leaderboards/new')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Create Leaderboard
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : leaderboards.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 text-lg">No branded leaderboards yet</p>
            <button
              onClick={() => navigate('/admin/leaderboards/new')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create your first
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Visibility</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaderboards.map((lb) => (
                  <tr
                    key={lb.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/leaderboards/${lb.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{lb.display_name}</div>
                      <div className="text-sm text-gray-500">{lb.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[lb.status] ?? ''}`}>
                        {lb.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lb.price_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lb.visibility}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {lb.price_type === 'paid'
                        ? `${(lb.season_price_cents / 100).toFixed(2)} ${lb.currency}`
                        : 'Free'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-right">
                      {new Date(lb.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6">
          <Link to="/admin" className="text-blue-600 hover:text-blue-800 text-sm">
            &larr; Back to Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
