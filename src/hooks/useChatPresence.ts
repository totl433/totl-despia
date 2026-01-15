import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

type UseChatPresenceArgs = {
  leagueId: string | null | undefined;
  userId: string | null | undefined;
  enabled: boolean;
  /** How often we refresh last_seen while active. Default: 10s. */
  heartbeatMs?: number;
};

/**
 * Tracks chat presence for a (leagueId, userId) pair so we can suppress chat push
 * notifications while the user is actively viewing the chat tab.
 *
 * Presence is best-effort:
 * - upsert last_seen immediately + on a heartbeat
 * - delete presence on unmount/disable and when the document becomes hidden
 */
export function useChatPresence({
  leagueId,
  userId,
  enabled,
  heartbeatMs = 10_000,
}: UseChatPresenceArgs) {
  useEffect(() => {
    if (!enabled || !leagueId || !userId) return;

    let isActive = true;
    const currentLeagueId = leagueId;
    const currentUserId = userId;

    const updatePresence = async () => {
      if (!isActive) return;
      try {
        const { error } = await supabase
          .from('chat_presence')
          .upsert(
            {
              league_id: currentLeagueId,
              user_id: currentUserId,
              last_seen: new Date().toISOString(),
            },
            { onConflict: 'league_id,user_id' }
          );

        if (error) {
          console.warn('[useChatPresence] Failed to update presence:', error);
        }
      } catch (err) {
        console.warn('[useChatPresence] Error updating presence:', err);
      }
    };

    const clearPresence = async () => {
      try {
        await supabase
          .from('chat_presence')
          .delete()
          .eq('league_id', currentLeagueId)
          .eq('user_id', currentUserId);
      } catch (err) {
        console.warn('[useChatPresence] Error clearing presence:', err);
      }
    };

    // Update immediately on enable.
    updatePresence();

    // Heartbeat while active.
    const interval = setInterval(() => {
      if (isActive) updatePresence();
    }, heartbeatMs);

    // Clear when app/backgrounds; restore when foreground.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearPresence();
      } else if (document.visibilityState === 'visible' && isActive) {
        updatePresence();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearPresence();
    };
  }, [enabled, leagueId, userId, heartbeatMs]);
}

