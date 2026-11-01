import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import type { ReactionSummary, ReactionsByMessage } from './useLeagueChatReactions';

type ReactionRow = { card_id: string; emoji: string; user_id: string; created_at?: string };

/** Per-card reaction chips, in the order each emoji first arrived. */
export function summariseCardReactions(rows: ReactionRow[], userId: string | null): ReactionsByMessage {
  const ordered = [...rows].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
  const out: ReactionsByMessage = {};
  for (const row of ordered) {
    const list = (out[row.card_id] ??= []);
    let chip = list.find((entry) => entry.emoji === row.emoji);
    if (!chip) {
      chip = { emoji: row.emoji, count: 0, hasUserReacted: false };
      list.push(chip);
    }
    chip.count += 1;
    if (userId && row.user_id === userId) chip.hasUserReacted = true;
  }
  return out;
}

/** Any emoji, several per person: tapping one you've used takes it back, anything else adds it. */
export function applyCardReactionToggle(current: ReactionSummary[] | undefined, emoji: string): ReactionSummary[] {
  const list = (current ?? []).map((chip) => ({ ...chip }));
  const at = list.findIndex((chip) => chip.emoji === emoji);
  if (at < 0) return [...list, { emoji, count: 1, hasUserReacted: true }];
  const chip = list[at] as ReactionSummary;
  if (chip.hasUserReacted) {
    if (chip.count <= 1) list.splice(at, 1);
    else list[at] = { ...chip, count: chip.count - 1, hasUserReacted: false };
  } else {
    list[at] = { ...chip, count: chip.count + 1, hasUserReacted: true };
  }
  return list;
}

/**
 * Slack-style reactions on public Game Centre cards (game_centre_reactions), keyed by the
 * card's permanent id. Builds on posts use this; older builds keep match_center_card_reactions.
 */
export function useGameCentreReactions({
  cardIds,
  userId,
  enabled,
}: {
  cardIds: string[];
  userId: string | null;
  enabled: boolean;
}): { reactions: ReactionsByMessage; toggleReaction: (cardId: string, emoji: string) => Promise<void> } {
  const queryClient = useQueryClient();
  const ids = React.useMemo(() => [...new Set(cardIds.filter(Boolean))].sort(), [cardIds]);
  const queryKey = React.useMemo(() => ['game-centre-reactions', ids.join(','), userId] as const, [ids, userId]);
  const on = enabled && !!userId && ids.length > 0;

  const query = useQuery({
    enabled: on,
    queryKey,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('game_centre_reactions')
        .select('card_id, emoji, user_id, created_at')
        .in('card_id', ids)
        .limit(5000);
      if (error) throw error;
      return summariseCardReactions((data ?? []) as ReactionRow[], userId);
    },
  });

  React.useEffect(() => {
    if (!on) return;
    const channel = supabase
      .channel(`game-centre-reactions:${ids.length}:${ids[0] ?? ''}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_centre_reactions' }, (payload: any) => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as ReactionRow | undefined;
        // Own taps are already shown; refetch only for other people's.
        if (row?.user_id && row.user_id === userId) return;
        if (row?.card_id && !ids.includes(row.card_id)) return;
        void queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ids, on, queryClient, queryKey, userId]);

  const toggleReaction = React.useCallback(
    async (cardId: string, emoji: string) => {
      if (!userId || !emoji) return;
      const current = queryClient.getQueryData<ReactionsByMessage>(queryKey) ?? {};
      const removing = !!current[cardId]?.find((chip) => chip.emoji === emoji && chip.hasUserReacted);
      queryClient.setQueryData<ReactionsByMessage>(queryKey, (prev) => {
        const next = { ...(prev ?? {}) };
        const updated = applyCardReactionToggle(next[cardId], emoji);
        if (updated.length === 0) delete next[cardId];
        else next[cardId] = updated;
        return next;
      });
      const table = (supabase as any).from('game_centre_reactions');
      const { error } = removing
        ? await table.delete().eq('card_id', cardId).eq('user_id', userId).eq('emoji', emoji)
        : await table.upsert({ card_id: cardId, user_id: userId, emoji }, { onConflict: 'card_id,user_id,emoji', ignoreDuplicates: true });
      if (error) {
        console.error('[useGameCentreReactions] toggle:', error.message);
        void queryClient.invalidateQueries({ queryKey });
      }
    },
    [queryClient, queryKey, userId]
  );

  return { reactions: query.data ?? {}, toggleReaction };
}
