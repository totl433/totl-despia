import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';

export type ReactionSummary = { emoji: string; count: number; hasUserReacted: boolean };
export type ReactionsByMessage = Record<string, ReactionSummary[]>;

type ReactionRow = { message_id: string; emoji: string; user_id: string };

function buildSummaries(rows: ReactionRow[], currentUserId: string): ReactionsByMessage {
  const byMessage: Record<string, Record<string, { count: number; hasUserReacted: boolean }>> = {};
  for (const r of rows) {
    if (!byMessage[r.message_id]) byMessage[r.message_id] = {};
    if (!byMessage[r.message_id][r.emoji]) byMessage[r.message_id][r.emoji] = { count: 0, hasUserReacted: false };
    byMessage[r.message_id][r.emoji].count++;
    if (r.user_id === currentUserId) byMessage[r.message_id][r.emoji].hasUserReacted = true;
  }

  const formatted: ReactionsByMessage = {};
  for (const messageId of Object.keys(byMessage)) {
    formatted[messageId] = Object.entries(byMessage[messageId]).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      hasUserReacted: data.hasUserReacted,
    }));
  }
  return formatted;
}

export function useLeagueChatReactions({
  leagueId,
  messageIds,
  userId,
  enabled,
}: {
  leagueId: string | null;
  messageIds: string[];
  userId: string | null;
  enabled: boolean;
}): { reactions: ReactionsByMessage; toggleReaction: (messageId: string, emoji: string) => Promise<void> } {
  const [reactions, setReactions] = React.useState<ReactionsByMessage>({});
  const userIdRef = React.useRef<string | null>(userId);
  React.useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const stableMessageIds = React.useMemo(() => Array.from(new Set(messageIds)).filter(Boolean).sort(), [messageIds]);
  const idsKey = stableMessageIds.join(',');
  const qc = useQueryClient();
  void qc; // keep for future cache linkage

  React.useEffect(() => {
    if (!enabled || !userId || stableMessageIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('league_message_reactions').select('message_id, emoji, user_id').in('message_id', stableMessageIds);
      if (cancelled) return;
      if (error) return;
      setReactions(buildSummaries((data ?? []) as ReactionRow[], userId));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idsKey, userId]);

  React.useEffect(() => {
    if (!enabled || !leagueId || !userId) return;
    if (stableMessageIds.length === 0) return;

    const channel = supabase
      .channel(`message-reactions:${leagueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_message_reactions' }, (payload: any) => {
        const currentUserId = userIdRef.current;
        if (!currentUserId) return;
        const eventType = payload.eventType as string | undefined;
        const row = (eventType === 'DELETE' ? payload.old : payload.new) as ReactionRow | undefined;
        if (!row?.message_id || !row.emoji || !row.user_id) return;
        if (!stableMessageIds.includes(row.message_id)) return;

        setReactions((prev) => {
          const next = { ...prev };
          const list = next[row.message_id] ? [...next[row.message_id]] : [];
          const idx = list.findIndex((r) => r.emoji === row.emoji);

          if (eventType === 'DELETE') {
            if (idx < 0) return prev;
            const existing = list[idx];
            const newCount = Math.max(0, existing.count - 1);
            if (newCount === 0) list.splice(idx, 1);
            else list[idx] = { ...existing, count: newCount, hasUserReacted: row.user_id === currentUserId ? false : existing.hasUserReacted };
          } else if (eventType === 'INSERT') {
            if (idx >= 0) {
              const existing = list[idx];
              list[idx] = { ...existing, count: existing.count + 1, hasUserReacted: existing.hasUserReacted || row.user_id === currentUserId };
            } else {
              list.push({ emoji: row.emoji, count: 1, hasUserReacted: row.user_id === currentUserId });
            }
          }

          if (list.length === 0) delete next[row.message_id];
          else next[row.message_id] = list;
          return next;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, leagueId, stableMessageIds, userId]);

  const toggleReaction = React.useCallback(
    async (messageId: string, emoji: string) => {
      const currentUserId = userIdRef.current;
      if (!currentUserId) return;
      const list = reactions[messageId] ?? [];
      const has = list.some((r) => r.emoji === emoji && r.hasUserReacted);

      // Optimistic update
      setReactions((prev) => {
        const next = { ...prev };
        const cur = next[messageId] ? [...next[messageId]] : [];
        const idx = cur.findIndex((r) => r.emoji === emoji);
        if (has) {
          if (idx >= 0) {
            const r = cur[idx];
            const newCount = Math.max(0, r.count - 1);
            if (newCount === 0) cur.splice(idx, 1);
            else cur[idx] = { ...r, count: newCount, hasUserReacted: false };
          }
        } else {
          if (idx >= 0) {
            const r = cur[idx];
            cur[idx] = { ...r, count: r.count + 1, hasUserReacted: true };
          } else {
            cur.push({ emoji, count: 1, hasUserReacted: true });
          }
        }
        if (cur.length === 0) delete next[messageId];
        else next[messageId] = cur;
        return next;
      });

      if (has) {
        await supabase.from('league_message_reactions').delete().eq('message_id', messageId).eq('user_id', currentUserId).eq('emoji', emoji);
      } else {
        await supabase.from('league_message_reactions').insert({ message_id: messageId, user_id: currentUserId, emoji });
      }
    },
    [reactions]
  );

  return { reactions, toggleReaction };
}

