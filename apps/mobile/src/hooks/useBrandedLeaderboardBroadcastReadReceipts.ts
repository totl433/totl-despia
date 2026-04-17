import { useCallback, useEffect, useRef } from 'react';

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
  const lastUpdateRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 1500;

  const markAsRead = useCallback(
    async (opts?: { lastReadAtOverride?: string | null }) => {
      if (!enabled || !leaderboardId || !userId) return;
      const nowMs = Date.now();

      if (nowMs - lastUpdateRef.current < DEBOUNCE_MS) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(
          () => void markAsRead({ lastReadAtOverride: opts?.lastReadAtOverride ?? null }),
          DEBOUNCE_MS - (nowMs - lastUpdateRef.current)
        );
        return;
      }

      lastUpdateRef.current = nowMs;
      try {
        const lastReadAt = (opts?.lastReadAtOverride ?? null) || new Date().toISOString();
        await api.markBrandedLeaderboardBroadcastRead(leaderboardId, { lastReadAt });
      } catch {
        // best effort
      }
    },
    [enabled, leaderboardId, userId]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { markAsRead };
}
