import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  resolveSeasonCtx,
  type SeasonCtx,
  getSeasonTables,
  isNewSeasonFresh,
} from '../lib/seasonStack';
import { setActiveSeasonCtx } from '../lib/activeSeasonCtx';

const defaultCtx = (): SeasonCtx => ({
  useSeasonStack: false,
  seasonId: null,
  seasonLabel: null,
  currentGw: 1,
  viewingGw: null,
});

/**
 * Hydrates season dual-stack context for the signed-in user.
 * Legacy users: use_season_stack false → app_meta world.
 * Testers: Pile B season tables for fixtures/picks/etc.
 */
export function useSeasonStack() {
  const { user } = useAuth();
  const [ctx, setCtx] = useState<SeasonCtx>(defaultCtx);
  const [loading, setLoading] = useState(!!user?.id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setCtx(defaultCtx());
      setActiveSeasonCtx(null);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const resolved = await resolveSeasonCtx(supabase as any, user.id);
        if (!alive) return;
        setCtx(resolved);
        setActiveSeasonCtx(resolved, user.id);
        setError(null);
        if (resolved.useSeasonStack) {
          console.log(
            `[useSeasonStack] Pile B active · ${resolved.seasonLabel ?? resolved.seasonId} · current GW ${resolved.currentGw}`
          );
        }
      } catch (e: unknown) {
        if (!alive) return;
        console.error('[useSeasonStack]', e);
        setError(e instanceof Error ? e.message : 'season resolve failed');
        setCtx(defaultCtx());
        setActiveSeasonCtx(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  return {
    ...ctx,
    tables: getSeasonTables(ctx),
    isNewSeasonFresh: isNewSeasonFresh(ctx),
    loading,
    error,
  };
}
