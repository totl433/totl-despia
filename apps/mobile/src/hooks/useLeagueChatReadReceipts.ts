import { useCallback, useEffect, useRef } from 'react';

import { supabase } from '../lib/supabase';

export function useLeagueChatReadReceipts({
  leagueId,
  userId,
  enabled,
}: {
  leagueId: string | null;
  userId: string | null;
  enabled: boolean;
}) {
  const lastUpdateRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 1500;

  const markAsRead = useCallback(async (opts?: { lastReadAtOverride?: string | null }) => {
    if (!enabled || !leagueId || !userId) return;
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
      // Prefer server message timestamps when available (avoids client clock drift).
      const lastReadAt = (opts?.lastReadAtOverride ?? null) || new Date().toISOString();
      await supabase.from('league_message_reads').upsert(
        { league_id: leagueId, user_id: userId, last_read_at: lastReadAt },
        { onConflict: 'league_id,user_id' }
      );
    } catch {
      // best effort
    }
  }, [enabled, leagueId, userId]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { markAsRead };
}

