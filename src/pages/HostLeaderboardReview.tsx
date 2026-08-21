import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/PageLoader';

type HostReviewLeaderboard = {
  id: string;
  display_name: string;
  slug: string;
  description: string | null;
  header_image_url: string | null;
  status: 'draft' | 'active' | 'paused' | 'archived';
  price_type: 'free' | 'paid';
  visibility: 'public' | 'private' | 'unlisted';
  season_price_cents: number;
  currency: string;
};

type HostReviewHost = {
  id: string;
  user_id: string;
  display_order: number;
  name: string | null;
  avatar_url: string | null;
};

type HostReviewJoinCode = {
  id: string;
  code: string;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
};

type HostReviewResponse = {
  leaderboard: HostReviewLeaderboard;
  hosts: HostReviewHost[];
  defaultJoinCode: HostReviewJoinCode | null;
};

function formatPrice(cents: number, currency: string) {
  if (!Number.isFinite(cents) || cents <= 0) return 'Free';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return 'No expiry';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No expiry';
  return date.toLocaleString();
}

export default function HostLeaderboardReview() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const [data, setData] = useState<HostReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setError('No leaderboard was specified.');
        setLoading(false);
        return;
      }
      if (!session?.access_token) {
        setError('You must be signed in to view this page.');
        setLoading(false);
        return;
      }

      const envBff = typeof import.meta.env.VITE_BFF_URL === 'string' ? import.meta.env.VITE_BFF_URL.trim() : '';
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const productionBase = 'https://totl-despia-production.up.railway.app';
      const primaryBase = envBff || (isDevelopment ? 'http://localhost:8787' : productionBase);
      const primaryUrl = `${primaryBase.replace(/\/$/, '')}/v1/host/branded-leaderboards/${encodeURIComponent(id)}/review`;
      const fallbackUrl = `${productionBase}/v1/host/branded-leaderboards/${encodeURIComponent(id)}/review`;

      setLoading(true);
      setError(null);

      const headers = {
        Authorization: `Bearer ${session.access_token}`,
      };

      let response: Response;
      try {
        response = await fetch(primaryUrl, { headers });
      } catch (fetchError) {
        if (!isDevelopment || primaryBase === productionBase) throw fetchError;
        response = await fetch(fallbackUrl, { headers });
      }

      const bodyText = await response.text();
      const body = bodyText ? JSON.parse(bodyText) : null;

      if (cancelled) return;

      if (!response.ok) {
        setError(
          typeof body?.message === 'string'
            ? body.message
            : 'Could not load this host review page.'
        );
        setLoading(false);
        return;
      }

      setData(body as HostReviewResponse);
      setLoading(false);
    }

    void load().catch((fetchError) => {
      if (cancelled) return;
      setError(fetchError instanceof Error ? fetchError.message : 'Could not load this host review page.');
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [id, session?.access_token]);

  if (loading) {
    return <PageLoader message="Loading campaign review..." />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            <h1 className="text-xl font-semibold text-red-900">Could not open this page</h1>
            <p className="mt-2 text-sm">{error ?? 'This host review page is unavailable.'}</p>
            <Link to="/profile" className="mt-4 inline-flex text-sm font-medium text-red-800 underline">
              Back to profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { leaderboard, hosts, defaultJoinCode } = data;
  const statusColor: Record<HostReviewLeaderboard['status'], string> = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    archived: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/profile" className="text-blue-600 hover:text-blue-800 text-sm">
            &larr; Back to profile
          </Link>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 mb-6">
          This is a view-only host review page. Admin controls remain restricted.
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          {leaderboard.header_image_url ? (
            <div className="mb-4 rounded-lg overflow-hidden" style={{ aspectRatio: '3 / 1' }}>
              <img src={leaderboard.header_image_url} alt="" className="w-full h-full object-cover" />
            </div>
          ) : null}

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{leaderboard.display_name}</h1>
              <p className="text-gray-500 mt-1">/{leaderboard.slug}</p>
              {leaderboard.description ? (
                <p className="text-gray-600 mt-3 max-w-2xl">{leaderboard.description}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[leaderboard.status]}`}>
                {leaderboard.status}
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {leaderboard.price_type}
              </span>
              <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                {leaderboard.visibility}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900">Campaign Summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">Pricing</dt>
                <dd className="font-medium text-gray-900">
                  {leaderboard.price_type === 'free'
                    ? 'Free'
                    : formatPrice(leaderboard.season_price_cents, leaderboard.currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">Visibility</dt>
                <dd className="font-medium text-gray-900 capitalize">{leaderboard.visibility}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium text-gray-900 capitalize">{leaderboard.status}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900">Default Join Code</h2>
            {defaultJoinCode ? (
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <div className="text-gray-500">Code</div>
                  <div className="mt-1 text-2xl font-semibold tracking-[0.2em] text-gray-900">{defaultJoinCode.code}</div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Active</span>
                  <span className={`font-medium ${defaultJoinCode.active ? 'text-green-700' : 'text-red-700'}`}>
                    {defaultJoinCode.active ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Uses</span>
                  <span className="font-medium text-gray-900">
                    {defaultJoinCode.use_count}
                    {defaultJoinCode.max_uses ? ` / ${defaultJoinCode.max_uses}` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">Expires</span>
                  <span className="font-medium text-gray-900 text-right">{formatDate(defaultJoinCode.expires_at)}</span>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">No default join code has been created yet.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900">Hosts</h2>
          {hosts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {hosts.map((host) => (
                <div key={host.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-3">
                  {host.avatar_url ? (
                    <img src={host.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-200" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{host.name ?? 'Unnamed host'}</div>
                    <div className="text-xs text-gray-500">Display order: {host.display_order + 1}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No hosts have been assigned yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
