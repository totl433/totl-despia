import * as React from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { VOLLEY_USER_ID } from '../lib/volley';
import { capUnreadCount } from '../lib/unreadBadge';

export type UnreadByLeagueId = Record<string, number>;

/**
 * Single source of truth for league unread chat badges.
 *
 * - Server truth: `league_message_reads.last_read_at` + `league_messages.created_at`
 * - Computes unread counts client-side (matches Despia/web) for correctness
 * - Realtime: updates when new messages arrive OR when this user's read receipts change
 * - Optimistic clear: UI clears immediately when navigating into a league
 */
export function useLeagueUnreadCounts(): {
  meId: string | null;
  unreadByLeagueId: UnreadByLeagueId;
  optimisticallyClear: (leagueId: string) => void;
} {
  const queryClient = useQueryClient();

  function parseIsoMs(iso: string | null | undefined): number | null {
    if (!iso) return null;
    // Some backends return fractional seconds > 3 digits (microseconds).
    // JS Date parsing can be inconsistent for that format, so truncate to milliseconds.
    // Examples:
    // - 2026-01-30T23:48:46.384397+00:00 -> 2026-01-30T23:48:46.384+00:00
    // - 2026-01-30T19:10:39.60297+00:00  -> 2026-01-30T19:10:39.602+00:00
    const normalized = iso.replace(/(\.\d{3})\d+(?=[Z+-])/, '$1');
    const ms = Date.parse(normalized);
    return Number.isFinite(ms) ? ms : null;
  }

  const { data: me } = useQuery<{ id: string } | null>({
    queryKey: ['me'],
    queryFn: async () => {
      // IMPORTANT: Prefer `getSession()` (local, reliable) over `getUser()` (network-backed).
      // If `getUser()` fails/returns null, unread badges never load.
      const { data } = await supabase.auth.getSession();
      return data.session?.user?.id ? { id: data.session.user.id } : null;
    },
    staleTime: 60_000,
  });
  const meId = me?.id ?? null;

  // Bump the key version to avoid stale persisted values when unread logic changes.
  const unreadQueryKey = React.useMemo(() => ['leagueUnreadCountsV3', meId] as const, [meId]);

  const { data: unreadByLeagueId = {} } = useQuery<UnreadByLeagueId>({
    enabled: !!meId,
    queryKey: unreadQueryKey,
    queryFn: async () => {
      const userId = String(meId);

      // Compute unread counts client-side (mirrors web `fetchUnreadCountsFromDb`).
      // - Fetch league ids (memberships)
      // - Fetch last_read_at for those leagues
      // - For leagues with reads: fetch messages since earliest read and count per-league
      // - For leagues with NO reads: do per-league count query (usually small N) to avoid pulling all history
      const { data: memberRows, error: memberErr } = await supabase
        .from('league_members')
        .select('league_id')
        .eq('user_id', userId);
      if (memberErr) throw memberErr;

      const leagueIds = (memberRows ?? [])
        .map((r: any) => String(r.league_id))
        .filter(Boolean);
      if (!leagueIds.length) return {};

      const { data: readsData, error: readsErr } = await supabase
        .from('league_message_reads')
        .select('league_id,last_read_at')
        .eq('user_id', userId)
        .in('league_id', leagueIds);
      if (readsErr) throw readsErr;

      // IMPORTANT: compare timestamps as numbers, not strings.
      // Supabase can return ISO strings with different timezone suffixes (e.g. 'Z' vs '+00:00'),
      // and lexicographic comparisons can produce incorrect results.
      const defaultMs = 0; // epoch
      const lastReadMsByLeague = new Map<string, number>();
      (readsData ?? []).forEach((r: any) => {
        if (!r?.league_id) return;
        const iso = typeof r.last_read_at === 'string' ? r.last_read_at : null;
        const ms = parseIsoMs(iso);
        lastReadMsByLeague.set(String(r.league_id), ms ?? defaultMs);
      });

      const leaguesWithReads: string[] = [];
      const leaguesWithoutReads: string[] = [];
      leagueIds.forEach((id) => {
        if (lastReadMsByLeague.has(id)) leaguesWithReads.push(id);
        else leaguesWithoutReads.push(id);
      });

      const unread: UnreadByLeagueId = {};
      leagueIds.forEach((id) => {
        unread[id] = 0;
      });

      // a) Bulk-ish path for leagues with reads.
      if (leaguesWithReads.length) {
        let earliestMs = Number.POSITIVE_INFINITY;
        leaguesWithReads.forEach((id) => {
          const ms = lastReadMsByLeague.get(id);
          if (typeof ms === 'number' && Number.isFinite(ms)) {
            earliestMs = Math.min(earliestMs, ms);
          }
        });
        if (!Number.isFinite(earliestMs)) earliestMs = defaultMs;
        const earliestIso = new Date(earliestMs).toISOString();

        const { data: msgs, error: msgsErr } = await supabase
          .from('league_messages')
          .select('league_id,created_at,user_id')
          .in('league_id', leaguesWithReads)
          .gt('created_at', earliestIso)
          .neq('user_id', userId)
          .neq('user_id', String(VOLLEY_USER_ID))
          .limit(10_000);
        if (msgsErr) throw msgsErr;

        (msgs ?? []).forEach((m: any) => {
          const lid = String(m.league_id ?? '');
          if (!lid) return;
          const createdIso = typeof m.created_at === 'string' ? m.created_at : null;
          const createdMs = parseIsoMs(createdIso);
          if (createdMs === null) return;
          const lastReadMs = lastReadMsByLeague.get(lid) ?? defaultMs;
          if (createdMs > lastReadMs) unread[lid] = (unread[lid] ?? 0) + 1;
        });
      }

      // b) Per-league count for leagues without reads (avoid fetching all history).
      if (leaguesWithoutReads.length) {
        const counts = await Promise.all(
          leaguesWithoutReads.map(async (leagueId) => {
            const { count, error } = await supabase
              .from('league_messages')
              .select('id', { count: 'exact', head: true })
              .eq('league_id', leagueId)
              .neq('user_id', userId)
              .neq('user_id', String(VOLLEY_USER_ID));
            if (error) throw error;
            return [leagueId, typeof count === 'number' ? count : 0] as const;
          })
        );
        counts.forEach(([leagueId, c]) => {
          unread[leagueId] = c;
        });
      }

      Object.keys(unread).forEach((k) => {
        unread[k] = capUnreadCount(Number(unread[k] ?? 0));
      });

      return unread;
    },
    // Keep it responsive to realtime events, and robust to app background/reconnect.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  // Safety net: when the app becomes active, immediately refetch unread counts.
  // This fixes cases where realtime events were missed while backgrounded.
  React.useEffect(() => {
    if (!meId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void queryClient.refetchQueries({ queryKey: unreadQueryKey });
      }
    });
    return () => sub.remove();
  }, [meId, queryClient, unreadQueryKey]);

  // Realtime updates: new messages + this user's read receipts updates.
  React.useEffect(() => {
    if (!meId) return;

    let active = true;
    const channel = supabase
      .channel(`league-unread:${meId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'league_messages' },
        (payload: any) => {
          if (!active) return;
          const msg = payload?.new ?? null;
          if (!msg) return;
          if (String(msg.user_id ?? '') === String(meId)) return; // never unread for own messages
          if (String(msg.user_id ?? '') === String(VOLLEY_USER_ID)) return; // never unread for Volley
          // Instant UX: optimistically increment badge count for that league, then refetch for correctness.
          const leagueId = String(msg.league_id ?? '');
          if (leagueId) {
            queryClient.setQueryData<UnreadByLeagueId>(unreadQueryKey, (prev) => {
              const next = { ...(prev ?? {}) };
              const curr = Number(next[leagueId] ?? 0);
              next[leagueId] = capUnreadCount(curr + 1);
              return next;
            });
          }

          // Refetch server-truth counts immediately (not just mark stale).
          void queryClient.refetchQueries({ queryKey: unreadQueryKey });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'league_message_reads', filter: `user_id=eq.${meId}` },
        (payload: any) => {
          if (!active) return;
          // Instant UX: when we record a read receipt for a league, optimistically clear that league's badge.
          const leagueId = String(payload?.new?.league_id ?? payload?.old?.league_id ?? '');
          if (leagueId) {
            queryClient.setQueryData<UnreadByLeagueId>(unreadQueryKey, (prev) => {
              const next = { ...(prev ?? {}) };
              next[leagueId] = 0;
              return next;
            });
          }
          void queryClient.refetchQueries({ queryKey: unreadQueryKey });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [meId, queryClient, unreadQueryKey]);

  const optimisticallyClear = React.useCallback(
    (leagueId: string) => {
      if (!meId) return;
      queryClient.setQueryData<UnreadByLeagueId>(unreadQueryKey, (prev) => {
        const next = { ...(prev ?? {}) };
        next[String(leagueId)] = 0;
        return next;
      });
    },
    [meId, queryClient, unreadQueryKey]
  );

  return { meId, unreadByLeagueId, optimisticallyClear };
}

