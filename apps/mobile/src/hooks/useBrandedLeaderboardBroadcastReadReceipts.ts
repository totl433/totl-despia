import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { api } from '../lib/api';

export function useBrandedLeaderboardBroadcastReadReceipts({
  leaderboardId,
  userId,
  enabled,
}: {
  leaderboardId: string | null;
  userId: string | null;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const lastUpdateRef = useRef<number>(0);
  const lastReadAtRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 1500;

  const markAsRead = useCallback(
    async (opts?: { lastReadAtOverride?: string | null }) => {
      if (!enabled || !leaderboardId || !userId) return;
      const nowMs = Date.now();
      const rawLastReadAt = (opts?.lastReadAtOverride ?? null) || new Date().toISOString();
      const requestedLastReadAt = Number.isNaN(Date.parse(rawLastReadAt))
        ? rawLastReadAt
        : new Date(rawLastReadAt).toISOString();
      const lastReadAt =
        lastReadAtRef.current && requestedLastReadAt.localeCompare(lastReadAtRef.current) < 0
          ? lastReadAtRef.current
          : requestedLastReadAt;

      lastReadAtRef.current = lastReadAt;

      if (nowMs - lastUpdateRef.current < DEBOUNCE_MS) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(
          () => void markAsRead({ lastReadAtOverride: lastReadAt }),
          DEBOUNCE_MS - (nowMs - lastUpdateRef.current)
        );
        return;
      }

      lastUpdateRef.current = nowMs;
      try {
        await api.markBrandedLeaderboardBroadcastRead(leaderboardId, { lastReadAt });
        queryClient.setQueriesData(
          {
            predicate: (query) =>
              Array.isArray(query.queryKey) && query.queryKey[0] === 'chatInboxBrandedBroadcastSummaryV1',
          },
          (prev: any) => {
            if (!prev || typeof prev !== 'object') return prev;
            return {
              ...prev,
              unreadByLeaderboardId: {
                ...(prev.unreadByLeaderboardId ?? {}),
                [leaderboardId]: 0,
              },
            };
          }
        );
        void queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey[0] === 'chatInboxBrandedBroadcastSummaryV1',
        });
      } catch {
        // best effort
      }
    },
    [enabled, leaderboardId, queryClient, userId]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { markAsRead };
}
