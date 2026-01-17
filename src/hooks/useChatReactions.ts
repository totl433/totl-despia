import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached, CACHE_TTL } from '../lib/cache';

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

function applyInsert(
  prev: ReactionsByMessage,
  row: ReactionRow,
  currentUserId: string
): ReactionsByMessage {
  const next = { ...prev };
  const list = next[row.message_id] ? [...next[row.message_id]] : [];
  const idx = list.findIndex((r) => r.emoji === row.emoji);
  if (idx >= 0) {
    const existing = list[idx];
    list[idx] = {
      ...existing,
      count: existing.count + 1,
      hasUserReacted: existing.hasUserReacted || row.user_id === currentUserId,
    };
  } else {
    list.push({ emoji: row.emoji, count: 1, hasUserReacted: row.user_id === currentUserId });
  }
  next[row.message_id] = list;
  return next;
}

function applyDelete(
  prev: ReactionsByMessage,
  row: ReactionRow,
  currentUserId: string
): ReactionsByMessage {
  const existingList = prev[row.message_id];
  if (!existingList) return prev;

  const next = { ...prev };
  const list = [...existingList];
  const idx = list.findIndex((r) => r.emoji === row.emoji);
  if (idx < 0) return prev;

  const existing = list[idx];
  const newCount = Math.max(0, existing.count - 1);
  if (newCount === 0) {
    list.splice(idx, 1);
  } else {
    // NOTE: we can't know if the current user still has another reaction of the same emoji
    // without a refetch. This is extremely rare; we optimistically clear when the deleting
    // row belonged to the current user.
    list[idx] = {
      ...existing,
      count: newCount,
      hasUserReacted: row.user_id === currentUserId ? false : existing.hasUserReacted,
    };
  }

  if (list.length === 0) {
    delete next[row.message_id];
  } else {
    next[row.message_id] = list;
  }
  return next;
}

export function useChatReactions({
  leagueId,
  messageIds,
  userId,
  onError,
}: {
  leagueId: string | null | undefined;
  messageIds: string[];
  userId: string | null | undefined;
  onError?: (message: string) => void;
}): { reactions: ReactionsByMessage; onReactionClick: (messageId: string, emoji: string) => Promise<void> } {
  const cacheKey = useMemo(() => {
    if (!leagueId || !userId) return null;
    return `chat:reactions:${leagueId}:${userId}`;
  }, [leagueId, userId]);

  const [reactions, setReactions] = useState<ReactionsByMessage>(() => {
    if (!cacheKey) return {};
    const cached = getCached<ReactionsByMessage>(cacheKey);
    return cached ?? {};
  });
  const userIdRef = useRef<string | null | undefined>(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const stableMessageIds = useMemo(() => Array.from(new Set(messageIds)).sort(), [messageIds]);
  const messageIdsKey = stableMessageIds.join(',');
  const stableMessageIdSet = useMemo(() => new Set(stableMessageIds), [messageIdsKey]);

  // Cache-first: as soon as messageIds change, trim cached reactions to the current message set
  // so the UI has emojis immediately while we refetch.
  useEffect(() => {
    if (!cacheKey || stableMessageIds.length === 0) return;
    const cached = getCached<ReactionsByMessage>(cacheKey);
    if (!cached) return;
    const trimmed: ReactionsByMessage = {};
    Object.entries(cached).forEach(([messageId, list]) => {
      if (stableMessageIdSet.has(messageId)) trimmed[messageId] = list;
    });
    setReactions((prev) => (Object.keys(prev).length ? prev : trimmed));
  }, [cacheKey, stableMessageIdSet, messageIdsKey, stableMessageIds.length]);

  // Initial load / refresh when message IDs change.
  useEffect(() => {
    if (!userId || stableMessageIds.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('league_message_reactions')
          .select('message_id, emoji, user_id')
          .in('message_id', stableMessageIds);

        if (cancelled) return;

        if (error) {
          onError?.(`Failed to load reactions: ${error.message}`);
          return;
        }
        const next = buildSummaries((data || []) as ReactionRow[], userId);
        setReactions(next);
        if (cacheKey) {
          // Keep cache bounded to the current message set so it doesn't grow forever.
          const trimmed: ReactionsByMessage = {};
          Object.entries(next).forEach(([messageId, list]) => {
            if (stableMessageIdSet.has(messageId)) trimmed[messageId] = list;
          });
          setCached(cacheKey, trimmed, CACHE_TTL.HOME);
        }
      } catch (err: any) {
        if (cancelled) return;
        onError?.(`Error loading reactions: ${err?.message || String(err)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageIdsKey, userId]);

  // Realtime incremental updates.
  useEffect(() => {
    if (!leagueId || !userId) return;
    if (stableMessageIds.length === 0) return;

    const channel = supabase
      .channel(`message-reactions:${leagueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'league_message_reactions' },
        (payload: any) => {
          const currentUserId = userIdRef.current;
          if (!currentUserId) return;

          // payload.new / payload.old shapes depend on event type
          const eventType = payload.eventType as string | undefined;
          const newRow = payload.new as ReactionRow | undefined;
          const oldRow = payload.old as ReactionRow | undefined;

          const row = (eventType === 'DELETE' ? oldRow : newRow) as ReactionRow | undefined;
          if (!row?.message_id || !row.emoji || !row.user_id) return;

          // Ignore events not in our current message set.
          if (!stableMessageIds.includes(row.message_id)) return;

          setReactions((prev) => {
            if (eventType === 'DELETE') return applyDelete(prev, row, currentUserId);
            if (eventType === 'INSERT') return applyInsert(prev, row, currentUserId);
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, stableMessageIds, userId]);

  const onReactionClick = useCallback(
    async (messageId: string, emoji: string) => {
      const currentUserId = userIdRef.current;
      if (!currentUserId) return;

      const messageReactions = reactions[messageId] || [];
      const existingReaction = messageReactions.find((r) => r.emoji === emoji && r.hasUserReacted);

      // Optimistic update.
      setReactions((prev) => {
        const next = { ...prev };
        const current = next[messageId] ? [...next[messageId]] : [];
        const idx = current.findIndex((r) => r.emoji === emoji);

        if (existingReaction) {
          if (idx >= 0) {
            const r = current[idx];
            const newCount = Math.max(0, r.count - 1);
            if (newCount === 0) {
              current.splice(idx, 1);
            } else {
              current[idx] = { ...r, count: newCount, hasUserReacted: false };
            }
          }
        } else {
          if (idx >= 0) {
            const r = current[idx];
            current[idx] = { ...r, count: r.count + 1, hasUserReacted: true };
          } else {
            current.push({ emoji, count: 1, hasUserReacted: true });
          }
        }

        if (current.length === 0) {
          delete next[messageId];
        } else {
          next[messageId] = current;
        }
        return next;
      });

      // Persist.
      if (existingReaction) {
        const { error } = await supabase
          .from('league_message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', currentUserId)
          .eq('emoji', emoji);

        if (error) {
          // Revert.
          setReactions((prev) => applyInsert(prev, { message_id: messageId, emoji, user_id: currentUserId }, currentUserId));
        }
      } else {
        const { error } = await supabase
          .from('league_message_reactions')
          .upsert({ message_id: messageId, user_id: currentUserId, emoji });

        if (error) {
          // Revert.
          setReactions((prev) => applyDelete(prev, { message_id: messageId, emoji, user_id: currentUserId }, currentUserId));
        }
      }
    },
    [reactions]
  );

  // Persist cached reactions (best-effort) so the emoji bubbles render instantly on next open.
  useEffect(() => {
    if (!cacheKey) return;
    const trimmed: ReactionsByMessage = {};
    Object.entries(reactions).forEach(([messageId, list]) => {
      if (stableMessageIdSet.has(messageId)) trimmed[messageId] = list;
    });
    setCached(cacheKey, trimmed, CACHE_TTL.HOME);
  }, [cacheKey, reactions, stableMessageIdSet]);

  return { reactions, onReactionClick };
}

