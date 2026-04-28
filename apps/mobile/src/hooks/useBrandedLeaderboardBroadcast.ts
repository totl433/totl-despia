import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../lib/api';
import {
  countUnreadBroadcastMessages,
  type BrandedLeaderboardBroadcastUiMessage,
} from '../lib/brandedLeaderboardBroadcastUnread';
import { supabase } from '../lib/supabase';

type BroadcastQueryData = {
  messages: BrandedLeaderboardBroadcastUiMessage[];
  lastReadAt: string | null;
};

function sortAsc(list: BrandedLeaderboardBroadcastUiMessage[]) {
  return [...list].sort((a, b) => {
    const cmp = a.created_at.localeCompare(b.created_at);
    if (cmp !== 0) return cmp;
    return a.id.localeCompare(b.id);
  });
}

function dedupeById(list: BrandedLeaderboardBroadcastUiMessage[]) {
  const seen = new Set<string>();
  const out: BrandedLeaderboardBroadcastUiMessage[] = [];
  for (const message of list) {
    const id = String(message.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(message);
  }
  return out;
}

function makeClientMsgId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useBrandedLeaderboardBroadcast({
  leaderboardId,
  enabled,
  userId,
  senderName,
  senderAvatarUrl,
}: {
  leaderboardId: string | null;
  enabled: boolean;
  userId: string | null;
  senderName?: string | null;
  senderAvatarUrl?: string | null;
}) {
  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => ['branded-leaderboard-broadcast', leaderboardId], [leaderboardId]);

  const query = useQuery<BroadcastQueryData>({
    queryKey,
    enabled: enabled && !!leaderboardId,
    queryFn: async () => {
      const data = await api.getBrandedLeaderboardBroadcastMessages(leaderboardId as string);
      return {
        messages: sortAsc(dedupeById(data.messages)),
        lastReadAt: data.lastReadAt,
      };
    },
    staleTime: 5_000,
  });

  React.useEffect(() => {
    if (!enabled || !leaderboardId) return;
    let active = true;
    const channel = supabase
      .channel(`branded-broadcast:${leaderboardId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'branded_leaderboard_broadcast_messages',
          filter: `leaderboard_id=eq.${leaderboardId}`,
        },
        async () => {
          if (!active) return;
          await queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [enabled, leaderboardId, queryClient, queryKey]);

  const sendMessage = React.useCallback(
    async (content: string) => {
      if (!leaderboardId || !userId) return;
      const text = content.trim();
      if (!text) return;

      const optimisticId = `optimistic-${makeClientMsgId()}`;
      const optimistic: BrandedLeaderboardBroadcastUiMessage = {
        id: optimisticId,
        leaderboard_id: leaderboardId,
        user_id: userId,
        content: text,
        message_type: 'host',
        seed_key: null,
        created_at: new Date().toISOString(),
        user_name: senderName ?? 'You',
        user_avatar_url: senderAvatarUrl ?? null,
        reactions: [],
        status: 'sending',
      };

      queryClient.setQueryData(queryKey, (prev: BroadcastQueryData | undefined) => ({
        messages: sortAsc(dedupeById([...(prev?.messages ?? []), optimistic])),
        lastReadAt: prev?.lastReadAt ?? null,
      }));

      try {
        const { message } = await api.sendBrandedLeaderboardBroadcastMessage(leaderboardId, { content: text });
        queryClient.setQueryData(queryKey, (prev: BroadcastQueryData | undefined) => {
          const withoutOptimistic = (prev?.messages ?? []).filter((item) => item.id !== optimisticId);
          return {
            messages: sortAsc(dedupeById([...withoutOptimistic, message])),
            lastReadAt: prev?.lastReadAt ?? null,
          };
        });
      } catch (error) {
        queryClient.setQueryData(queryKey, (prev: BroadcastQueryData | undefined) => ({
          messages: (prev?.messages ?? []).map((item) =>
            item.id === optimisticId ? { ...item, status: 'error' as const } : item
          ),
          lastReadAt: prev?.lastReadAt ?? null,
        }));
        throw error;
      }
    },
    [leaderboardId, queryClient, queryKey, senderAvatarUrl, senderName, userId]
  );

  const setLastReadAt = React.useCallback(
    (lastReadAt: string | null) => {
      queryClient.setQueryData(queryKey, (prev: BroadcastQueryData | undefined) => ({
        messages: prev?.messages ?? [],
        lastReadAt,
      }));
    },
    [queryClient, queryKey]
  );

  const unreadCount = React.useMemo(() => {
    return countUnreadBroadcastMessages({
      messages: query.data?.messages ?? [],
      lastReadAt: query.data?.lastReadAt ?? null,
      userId,
    });
  }, [query.data?.lastReadAt, query.data?.messages, userId]);

  return {
    messages: query.data?.messages ?? [],
    lastReadAt: query.data?.lastReadAt ?? null,
    unreadCount,
    isLoading: query.isLoading,
    error: query.error ? String((query.error as any)?.message ?? query.error) : null,
    refetch: query.refetch,
    sendMessage,
    setLastReadAt,
  };
}
