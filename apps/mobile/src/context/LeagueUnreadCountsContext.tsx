import * as React from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { VOLLEY_USER_ID } from '../lib/volley';
import { capUnreadCount } from '../lib/unreadBadge';

export type UnreadByLeagueId = Record<string, number>;

type ChatInboxLastMessage = {
  league_id: string;
  content: string | null;
  created_at: string;
  user_id: string;
};

type ChatInboxLastByLeagueId = Record<string, ChatInboxLastMessage>;

function upsertChatInboxLastMessage(
  prev: unknown,
  leagueId: string,
  nextMsg: ChatInboxLastMessage
): ChatInboxLastByLeagueId | unknown {
  if (prev == null) return { [String(leagueId)]: nextMsg };

  // Backward compat: tolerate a persisted Map (older builds) and normalize to a plain object.
  let obj: ChatInboxLastByLeagueId | null = null;
  if (prev instanceof Map) {
    obj = {};
    (prev as Map<string, ChatInboxLastMessage>).forEach((v, k) => {
      obj![String(k)] = v;
    });
  } else if (typeof prev === 'object') {
    obj = prev as ChatInboxLastByLeagueId;
  }
  if (!obj) return prev;

  const current = obj[String(leagueId)] ?? null;
  if (current?.created_at && typeof current.created_at === 'string') {
    // Only replace if the new message is newer (ISO strings are lexicographically sortable).
    if (String(nextMsg.created_at).localeCompare(String(current.created_at)) <= 0) return prev;
  }

  return { ...obj, [String(leagueId)]: nextMsg };
}

type LeagueUnreadCountsValue = {
  meId: string | null;
  unreadByLeagueId: UnreadByLeagueId;
  optimisticallyClear: (leagueId: string) => void;
};

const LeagueUnreadCountsContext = React.createContext<LeagueUnreadCountsValue | null>(null);

function parseIsoMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  // Some backends return fractional seconds > 3 digits (microseconds).
  // JS Date parsing can be inconsistent for that format, so truncate to milliseconds.
  const normalized = iso.replace(/(\.\d{3})\d+(?=[Z+-])/, '$1');
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Single source of truth for league unread chat badges.
 *
 * IMPORTANT: This Provider must only be mounted ONCE.
 * Multiple mounts will create multiple Supabase realtime channels with the same names,
 * which can conflict and lead to missed events / intermittent updates.
 */
export function LeagueUnreadCountsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const { data: me } = useQuery<{ id: string } | null>({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user?.id ? { id: data.session.user.id } : null;
    },
    staleTime: 60_000,
  });
  const meId = me?.id ?? null;

  // Subscribe to realtime INSERTs as soon as we know membership league IDs (fast).
  const { data: membershipLeagueIds = [] } = useQuery<string[]>({
    enabled: !!meId,
    queryKey: ['myLeagueIds', meId],
    queryFn: async () => {
      const userId = String(meId);
      const { data, error } = await supabase.from('league_members').select('league_id').eq('user_id', userId);
      if (error) throw error;
      const ids = (data ?? [])
        .map((r: any) => String(r?.league_id ?? ''))
        .filter(Boolean);
      return Array.from(new Set(ids)).sort();
    },
    staleTime: 60_000,
  });

  const unreadQueryKey = React.useMemo(() => ['leagueUnreadCountsV3', meId] as const, [meId]);

  const { data: unreadByLeagueId = {} } = useQuery<UnreadByLeagueId>({
    enabled: !!meId,
    queryKey: unreadQueryKey,
    queryFn: async () => {
      const userId = String(meId);

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

      if (leaguesWithReads.length) {
        let earliestMs = Number.POSITIVE_INFINITY;
        leaguesWithReads.forEach((id) => {
          const ms = lastReadMsByLeague.get(id);
          if (typeof ms === 'number' && Number.isFinite(ms)) earliestMs = Math.min(earliestMs, ms);
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
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  const leagueIdsForRealtimeKey = React.useMemo(() => membershipLeagueIds.join(','), [membershipLeagueIds]);
  const membershipLeagueIdsKey = leagueIdsForRealtimeKey;

  // Safety net: when app becomes active, refetch unread counts.
  React.useEffect(() => {
    if (!meId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void queryClient.refetchQueries({ queryKey: unreadQueryKey });
    });
    return () => sub.remove();
  }, [meId, queryClient, unreadQueryKey]);

  // Realtime: new messages + read receipt updates (single mount only).
  React.useEffect(() => {
    if (!meId) return;

    let active = true;
    const leagueIdsForRealtime = leagueIdsForRealtimeKey ? leagueIdsForRealtimeKey.split(',') : [];

    const channels = leagueIdsForRealtime.map((leagueId) => {
      return supabase
        .channel(`league-unread:${meId}:${leagueId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'league_messages', filter: `league_id=eq.${leagueId}` },
          (payload: any) => {
            if (!active) return;
            const msg = payload?.new ?? null;
            if (!msg) return;

            const senderId = String(msg.user_id ?? '');
            const isVolley = senderId === String(VOLLEY_USER_ID);
            const isSelf = senderId === String(meId);

            // Always update inbox preview/timestamp (even for self-sent messages).
            const createdAt = msg?.created_at ? String(msg.created_at) : new Date().toISOString();
            const nextLast: ChatInboxLastMessage = {
              league_id: String(leagueId),
              content: typeof msg.content === 'string' ? String(msg.content) : null,
              created_at: createdAt,
              user_id: senderId,
            };

            // 1) Update any existing inbox caches.
            queryClient.setQueriesData(
              { predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'chatInboxLastMessagesV2' },
              (prev) => upsertChatInboxLastMessage(prev, leagueId, nextLast)
            );

            // 2) Ensure the canonical inbox cache exists even if the inbox screen never mounted.
            if (membershipLeagueIdsKey) {
              queryClient.setQueryData(['chatInboxLastMessagesV2', membershipLeagueIdsKey], (prev) =>
                upsertChatInboxLastMessage(prev, leagueId, nextLast)
              );
            }

            // Only unread for non-self / non-Volley.
            if (!isSelf && !isVolley) {
              queryClient.setQueryData<UnreadByLeagueId>(unreadQueryKey, (prev) => {
                const next = { ...(prev ?? {}) };
                const curr = Number(next[leagueId] ?? 0);
                next[leagueId] = capUnreadCount(curr + 1);
                return next;
              });
              void queryClient.refetchQueries({ queryKey: unreadQueryKey });
            }
          }
        )
        .subscribe();
    });

    const readsChannel = supabase
      .channel(`league-unread-reads:${meId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'league_message_reads', filter: `user_id=eq.${meId}` },
        (payload: any) => {
          if (!active) return;
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
      channels.forEach((c) => supabase.removeChannel(c));
      supabase.removeChannel(readsChannel);
    };
  }, [leagueIdsForRealtimeKey, meId, membershipLeagueIdsKey, queryClient, unreadQueryKey]);

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

  const value = React.useMemo<LeagueUnreadCountsValue>(
    () => ({ meId, unreadByLeagueId, optimisticallyClear }),
    [meId, optimisticallyClear, unreadByLeagueId]
  );

  return <LeagueUnreadCountsContext.Provider value={value}>{children}</LeagueUnreadCountsContext.Provider>;
}

export function useLeagueUnreadCountsContext(): LeagueUnreadCountsValue {
  const ctx = React.useContext(LeagueUnreadCountsContext);
  // Be resilient: during auth/bootstrap or in Storybook, some screens/components may render
  // outside the provider. In that case, return safe defaults rather than crashing.
  if (!ctx) {
    return {
      meId: null,
      unreadByLeagueId: {},
      optimisticallyClear: () => {},
    };
  }
  return ctx;
}

