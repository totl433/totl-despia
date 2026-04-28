import * as React from 'react';

import { api } from '../lib/api';
import {
  applyDelete,
  applyInsert,
  buildReactionsFromMessages,
  type BroadcastReactionRow,
  type BroadcastReactionsByMessage,
} from '../lib/brandedLeaderboardBroadcastReactions';
import { supabase } from '../lib/supabase';
import type { BrandedLeaderboardBroadcastUiMessage } from '../lib/brandedLeaderboardBroadcastUnread';

export function useBrandedLeaderboardBroadcastReactions({
  leaderboardId,
  messages,
  userId,
  enabled,
}: {
  leaderboardId: string | null;
  messages: BrandedLeaderboardBroadcastUiMessage[];
  userId: string | null;
  enabled: boolean;
}): {
  reactions: BroadcastReactionsByMessage;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  isReactionPending: (messageId: string, emoji: string) => boolean;
} {
  const stableMessageIds = React.useMemo(
    () =>
      Array.from(
        new Set(
          messages
            .map((message) => String(message.id))
            .filter((id) => Boolean(id) && !id.startsWith('optimistic-'))
        )
      ).sort(),
    [messages]
  );
  const idsKey = stableMessageIds.join(',');
  const initialReactions = React.useMemo(() => buildReactionsFromMessages(messages), [messages]);
  const [reactions, setReactions] = React.useState<BroadcastReactionsByMessage>(initialReactions);
  const userIdRef = React.useRef<string | null>(userId);
  const reactionsRef = React.useRef<BroadcastReactionsByMessage>(initialReactions);
  const pendingKeysRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  React.useEffect(() => {
    reactionsRef.current = reactions;
  }, [reactions]);

  React.useEffect(() => {
    setReactions((prev) => {
      const next: BroadcastReactionsByMessage = {};
      for (const messageId of stableMessageIds) {
        const current = prev[messageId];
        const seeded = initialReactions[messageId];
        if (current && current.length > 0) next[messageId] = current;
        else if (seeded && seeded.length > 0) next[messageId] = seeded;
      }
      return next;
    });
  }, [idsKey, initialReactions, stableMessageIds]);

  React.useEffect(() => {
    if (!enabled || !leaderboardId || !userId) return;
    if (stableMessageIds.length === 0) return;

    const channel = supabase
      .channel(`branded-broadcast-reactions:${leaderboardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'branded_leaderboard_broadcast_reactions',
          filter: `leaderboard_id=eq.${leaderboardId}`,
        },
        (payload: any) => {
          const currentUserId = userIdRef.current;
          if (!currentUserId) return;
          const eventType = payload.eventType as string | undefined;
          const row = (eventType === 'DELETE' ? payload.old : payload.new) as
            | BroadcastReactionRow
            | undefined;
          if (!row?.message_id || !row.emoji || !row.user_id) return;
          if (!stableMessageIds.includes(String(row.message_id))) return;
          if (row.user_id === currentUserId) return;

          setReactions((prev) => {
            if (eventType === 'DELETE') {
              return applyDelete(prev, row, currentUserId);
            }
            if (eventType === 'INSERT') {
              return applyInsert(prev, row, currentUserId);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, leaderboardId, stableMessageIds, userId]);

  const toggleReaction = React.useCallback(
    async (messageId: string, emoji: string) => {
      const currentUserId = userIdRef.current;
      if (!leaderboardId || !currentUserId) return;
      const pendingKey = `${messageId}:${emoji}`;
      if (pendingKeysRef.current.has(pendingKey)) return;
      pendingKeysRef.current.add(pendingKey);

      const previous = reactionsRef.current[messageId] ?? [];
      const alreadyReacted = previous.some(
        (reaction) => reaction.emoji === emoji && reaction.hasUserReacted
      );
      const optimisticRow: BroadcastReactionRow = {
        message_id: messageId,
        emoji,
        user_id: currentUserId,
      };

      setReactions((prev) =>
        alreadyReacted
          ? applyDelete(prev, optimisticRow, currentUserId)
          : applyInsert(prev, optimisticRow, currentUserId)
      );

      try {
        const result = await api.toggleBrandedLeaderboardBroadcastReaction(leaderboardId, messageId, {
          emoji,
        });
        console.info('[BroadcastReactions] toggle result', {
          leaderboardId,
          messageId,
          emoji,
          reactions: result.reactions,
        });
        setReactions((prev) => {
          const next = { ...prev };
          if (result.reactions.length === 0) delete next[result.messageId];
          else next[result.messageId] = result.reactions;
          return next;
        });
      } catch (error) {
        console.error('[BroadcastReactions] toggle failed', {
          leaderboardId,
          messageId,
          emoji,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : String(error),
        });
        setReactions((prev) => {
          const next = { ...prev };
          if (previous.length === 0) delete next[messageId];
          else next[messageId] = previous;
          return next;
        });
        throw error;
      } finally {
        pendingKeysRef.current.delete(pendingKey);
      }
    },
    [leaderboardId]
  );

  const isReactionPending = React.useCallback((messageId: string, emoji: string) => {
    return pendingKeysRef.current.has(`${messageId}:${emoji}`);
  }, []);

  return { reactions, toggleReaction, isReactionPending };
}
