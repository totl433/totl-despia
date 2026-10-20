import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { mergeGameCentrePosts, type GameCentrePost } from '../features/matchCenter/posts';
import { supabase } from '../lib/supabase';

const POST_COLUMNS = 'id, gw, api_match_id, fixture_index, kind, status, details, occurred_minute, published_at, updated_at, revision';

/**
 * The gameweek's stored Game Centre posts (one row per match event), loaded once and
 * then kept live through Realtime. A correction updates its post in place.
 */
export function useGameCentrePosts(gw: number | null, enabled: boolean) {
  const queryClient = useQueryClient();
  const on = enabled && typeof gw === 'number';
  const queryKey = React.useMemo(() => ['game-centre-posts', gw] as const, [gw]);

  const query = useQuery({
    enabled: on,
    queryKey,
    staleTime: 60_000,
    // Realtime carries changes; this is the fallback if a channel drops.
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('game_centre_posts')
        .select(POST_COLUMNS)
        .eq('gw', gw)
        .order('published_at', { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as GameCentrePost[];
    },
    structuralSharing: (previous, next) =>
      Array.isArray(previous) ? mergeGameCentrePosts(previous as GameCentrePost[], next as GameCentrePost[]) : next,
  });

  React.useEffect(() => {
    if (!on) return;
    const channel = supabase
      .channel(`game-centre-posts:${gw}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_centre_posts', filter: `gw=eq.${gw}` },
        (payload: any) => {
          const post = payload.new as GameCentrePost | undefined;
          if (!post?.id) return;
          queryClient.setQueryData<GameCentrePost[]>(queryKey, (current) => mergeGameCentrePosts(current ?? [], [post]));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gw, on, queryClient, queryKey]);

  return { posts: query.data ?? null, loaded: query.isFetched, error: query.error };
}
