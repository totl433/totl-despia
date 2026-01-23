import { useEffect } from 'react';
import { AppState } from 'react-native';

import { supabase } from '../lib/supabase';

export function useLeagueChatPresence({
  leagueId,
  userId,
  enabled,
  heartbeatMs = 10_000,
}: {
  leagueId: string | null;
  userId: string | null;
  enabled: boolean;
  heartbeatMs?: number;
}) {
  useEffect(() => {
    if (!enabled || !leagueId || !userId) return;
    let active = true;
    const currentLeagueId = leagueId;
    const currentUserId = userId;

    const upsert = async () => {
      if (!active) return;
      try {
        await supabase
          .from('chat_presence')
          .upsert({ league_id: currentLeagueId, user_id: currentUserId, last_seen: new Date().toISOString() }, { onConflict: 'league_id,user_id' });
      } catch {
        // best effort
      }
    };

    const clear = async () => {
      try {
        await supabase.from('chat_presence').delete().eq('league_id', currentLeagueId).eq('user_id', currentUserId);
      } catch {
        // best effort
      }
    };

    upsert();
    const interval = setInterval(() => void upsert(), heartbeatMs);

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        void clear();
      } else {
        void upsert();
      }
    });

    return () => {
      active = false;
      clearInterval(interval);
      sub.remove();
      void clear();
    };
  }, [enabled, heartbeatMs, leagueId, userId]);
}

