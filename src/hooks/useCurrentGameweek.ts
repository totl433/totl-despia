import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSeasonStack } from './useSeasonStack';
import { getCached, setCached, CACHE_TTL } from '../lib/cache';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/**
 * Current published gameweek for this user.
 * Legacy: app_meta.current_gw
 * Season-stack testers: Pile B (season Ctx.currentGw)
 */
export function useCurrentGameweek() {
  const { user } = useAuth();
  const season = useSeasonStack();

  const [currentGw, setCurrentGw] = useState<number | null>(() => {
    const cached = getCached<{ current_gw: number }>(`app_meta:current_gw`);
    return cached?.current_gw ?? null;
  });

  const [loading, setLoading] = useState(() => {
    const cached = getCached<{ current_gw: number }>(`app_meta:current_gw`);
    return cached === null;
  });

  const [error, setError] = useState<string | null>(null);
  const currentGwRef = useRef<number | null>(currentGw);
  currentGwRef.current = currentGw;

  // Season-stack path: take currentGw from resolver
  useEffect(() => {
    if (season.loading) return;
    if (season.useSeasonStack) {
      const next = season.currentGw;
      if (currentGwRef.current !== next) {
        setCurrentGw(next);
        setCached(`app_meta:current_gw`, { current_gw: next }, CACHE_TTL.HOME);
      }
      setLoading(false);
      setError(null);
    }
  }, [season.loading, season.useSeasonStack, season.currentGw, season.seasonId]);

  // Legacy path: app_meta subscription (skipped for stack users)
  useEffect(() => {
    if (season.loading) return;
    if (season.useSeasonStack) return;

    let alive = true;
    let channel: RealtimeChannel | null = null;

    const fetchCurrentGw = async () => {
      if (!alive) return;
      const hasCached = currentGwRef.current !== null;
      if (!hasCached) setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('app_meta')
          .select('current_gw')
          .eq('id', 1)
          .maybeSingle();
        if (!alive) return;
        if (fetchError) {
          setError(fetchError.message);
          setLoading(false);
          return;
        }
        const newCurrentGw = data?.current_gw ?? 1;
        if (currentGwRef.current !== newCurrentGw) {
          setCurrentGw(newCurrentGw);
        }
        setCached(`app_meta:current_gw`, { current_gw: newCurrentGw }, CACHE_TTL.HOME);
        setLoading(false);
      } catch (err: any) {
        if (alive) {
          setError(err.message || 'Failed to fetch current gameweek');
          setLoading(false);
        }
      }
    };

    void fetchCurrentGw();

    channel = supabase
      .channel('current-gameweek-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_meta',
          filter: 'id=eq.1',
        },
        (payload) => {
          const newCurrentGw = (payload.new as any)?.current_gw;
          if (typeof newCurrentGw === 'number' && newCurrentGw !== currentGwRef.current) {
            setCurrentGw(newCurrentGw);
            setCached(`app_meta:current_gw`, { current_gw: newCurrentGw }, CACHE_TTL.HOME);
            window.dispatchEvent(
              new CustomEvent('currentGwChanged', {
                detail: { oldGw: currentGwRef.current, newGw: newCurrentGw },
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [season.loading, season.useSeasonStack, user?.id]);

  return { currentGw, loading: loading || season.loading, error };
}
