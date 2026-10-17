import * as React from 'react';

import { supabase } from '../lib/supabase';
import type { ReactionSummary, ReactionsByMessage } from './useLeagueChatReactions';

export type ReactionsByCard = ReactionsByMessage;

type ReactionRow = { card_id: string; emoji: string; user_id: string };

/** Fire, cool, melt — Match Center card picker only. */
export const MATCH_CENTER_CARD_REACTS = ['🔥', '😎', '🫠'] as const;

function buildSummaries(rows: ReactionRow[], currentUserId: string): ReactionsByCard {
  const byCard: Record<string, Record<string, { count: number; hasUserReacted: boolean }>> = {};
  for (const row of rows) {
    if (!byCard[row.card_id]) byCard[row.card_id] = {};
    if (!byCard[row.card_id][row.emoji]) byCard[row.card_id][row.emoji] = { count: 0, hasUserReacted: false };
    byCard[row.card_id][row.emoji].count += 1;
    if (row.user_id === currentUserId) byCard[row.card_id][row.emoji].hasUserReacted = true;
  }
  const formatted: ReactionsByCard = {};
  for (const cardId of Object.keys(byCard)) {
    formatted[cardId] = Object.entries(byCard[cardId]).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      hasUserReacted: data.hasUserReacted,
    }));
  }
  return formatted;
}

/** Optimistic single-reaction update (at most one emoji per user). */
export function applySingleCardReaction(
  current: ReactionSummary[] | undefined,
  emoji: string
): ReactionSummary[] {
  const list = (current ?? []).map((row) => ({ ...row }));
  const mineIndex = list.findIndex((row) => row.hasUserReacted);
  if (mineIndex >= 0) {
    const mine = list[mineIndex];
    if (mine.emoji === emoji) {
      const nextCount = mine.count - 1;
      if (nextCount <= 0) list.splice(mineIndex, 1);
      else list[mineIndex] = { ...mine, count: nextCount, hasUserReacted: false };
      return list;
    }
    const nextCount = mine.count - 1;
    if (nextCount <= 0) list.splice(mineIndex, 1);
    else list[mineIndex] = { ...mine, count: nextCount, hasUserReacted: false };
  }
  const existing = list.findIndex((row) => row.emoji === emoji);
  if (existing >= 0) {
    list[existing] = { ...list[existing], count: list[existing].count + 1, hasUserReacted: true };
    return list;
  }
  list.push({ emoji, count: 1, hasUserReacted: true });
  return list;
}

export function useMatchCenterCardReactions({
  cardIds,
  userId,
  enabled,
}: {
  cardIds: string[];
  userId: string | null;
  enabled: boolean;
}): { reactions: ReactionsByCard; toggleReaction: (cardId: string, emoji: string) => Promise<void> } {
  const [reactions, setReactions] = React.useState<ReactionsByCard>({});
  const userIdRef = React.useRef<string | null>(userId);
  React.useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const stableCardIds = React.useMemo(() => Array.from(new Set(cardIds)).filter(Boolean).sort(), [cardIds]);
  const idsKey = stableCardIds.join(',');

  React.useEffect(() => {
    if (!enabled || !userId || stableCardIds.length === 0) {
      setReactions({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('match_center_card_reactions')
        .select('card_id, emoji, user_id')
        .in('card_id', stableCardIds);
      if (cancelled) return;
      if (error) {
        console.error('[useMatchCenterCardReactions] load:', error.message);
        return;
      }
      setReactions(buildSummaries((data ?? []) as ReactionRow[], userId));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idsKey, userId]);

  React.useEffect(() => {
    if (!enabled || !userId || stableCardIds.length === 0) return;

    const channel = supabase
      .channel(`mc-card-reactions:${idsKey.slice(0, 80)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_center_card_reactions' }, (payload: any) => {
        const currentUserId = userIdRef.current;
        if (!currentUserId) return;
        const eventType = payload.eventType as string | undefined;
        const row = (eventType === 'DELETE' ? payload.old : payload.new) as ReactionRow | undefined;
        if (!row?.card_id || !row.emoji || !row.user_id) return;
        if (!stableCardIds.includes(row.card_id)) return;
        // Own taps are already applied optimistically — skip to avoid double counts.
        if (row.user_id === currentUserId) return;

        setReactions((prev) => {
          const next = { ...prev };
          const list = next[row.card_id] ? [...next[row.card_id]] : [];

          if (eventType === 'DELETE') {
            const idx = list.findIndex((r) => r.emoji === row.emoji);
            if (idx < 0) return prev;
            const existing = list[idx];
            const newCount = Math.max(0, existing.count - 1);
            if (newCount === 0) list.splice(idx, 1);
            else list[idx] = { ...existing, count: newCount };
          } else if (eventType === 'INSERT') {
            const idx = list.findIndex((r) => r.emoji === row.emoji);
            if (idx >= 0) {
              const existing = list[idx];
              list[idx] = { ...existing, count: existing.count + 1 };
            } else {
              list.push({ emoji: row.emoji, count: 1, hasUserReacted: false });
            }
          } else if (eventType === 'UPDATE') {
            const oldRow = payload.old as ReactionRow | undefined;
            if (oldRow?.emoji && oldRow.emoji !== row.emoji) {
              const oldIdx = list.findIndex((r) => r.emoji === oldRow.emoji);
              if (oldIdx >= 0) {
                const existing = list[oldIdx];
                const newCount = Math.max(0, existing.count - 1);
                if (newCount === 0) list.splice(oldIdx, 1);
                else list[oldIdx] = { ...existing, count: newCount };
              }
            }
            const idx = list.findIndex((r) => r.emoji === row.emoji);
            if (idx >= 0) {
              const existing = list[idx];
              list[idx] = { ...existing, count: existing.count + 1 };
            } else {
              list.push({ emoji: row.emoji, count: 1, hasUserReacted: false });
            }
          }

          if (list.length === 0) delete next[row.card_id];
          else next[row.card_id] = list;
          return next;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, idsKey, stableCardIds, userId]);

  const toggleReaction = React.useCallback(async (cardId: string, emoji: string) => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) return;
    if (!(MATCH_CENTER_CARD_REACTS as readonly string[]).includes(emoji)) return;

    const list = reactions[cardId] ?? [];
    const mine = list.find((row) => row.hasUserReacted);
    const removing = mine?.emoji === emoji;

    setReactions((prev) => {
      const next = { ...prev };
      const updated = applySingleCardReaction(prev[cardId], emoji);
      if (updated.length === 0) delete next[cardId];
      else next[cardId] = updated;
      return next;
    });

    if (removing) {
      const { error } = await supabase
        .from('match_center_card_reactions')
        .delete()
        .eq('card_id', cardId)
        .eq('user_id', currentUserId);
      if (error) console.error('[useMatchCenterCardReactions] delete:', error.message);
      return;
    }

    const { error } = await supabase.from('match_center_card_reactions').upsert(
      { card_id: cardId, user_id: currentUserId, emoji },
      { onConflict: 'card_id,user_id' }
    );
    if (error) console.error('[useMatchCenterCardReactions] upsert:', error.message);
  }, [reactions]);

  return { reactions, toggleReaction };
}
