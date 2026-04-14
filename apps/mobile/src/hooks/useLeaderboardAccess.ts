import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { BrandedLeaderboardDetail } from '@totl/domain';
import { getBrandedLeaderboardAccessState, type MobileBrandedLeaderboardAccessState } from '../lib/brandedLeaderboardAccess';

export type AccessState = MobileBrandedLeaderboardAccessState;

export function useLeaderboardAccess(idOrSlug: string) {
  const [detail, setDetail] = useState<BrandedLeaderboardDetail | null>(null);
  const [accessState, setAccessState] = useState<AccessState>('loading');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!idOrSlug) {
      setLoading(false);
      setAccessState('error');
      setError('No leaderboard specified');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBrandedLeaderboard(idOrSlug);
      setDetail(data);
      const nextAccessState = getBrandedLeaderboardAccessState(data);
      console.info('[BrandedLeaderboardAccess]', {
        leaderboardId: data.leaderboard.id,
        priceType: data.leaderboard.price_type,
        membership: Boolean(data.membership),
        subscriptionStatus: data.subscription?.status ?? null,
        hasAccess: data.hasAccess,
        hasActivePurchase: data.hasActivePurchase,
        requiresPurchase: data.requiresPurchase,
        accessReason: data.accessReason,
        nextAccessState,
      });
      setAccessState(nextAccessState);
    } catch (err: any) {
      console.error('[useLeaderboardAccess]', err);
      setError(err?.message ?? 'Failed to load leaderboard');
      setAccessState('error');
    } finally {
      setLoading(false);
    }
  }, [idOrSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return { detail, accessState, loading, error, refresh };
}
