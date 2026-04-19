import React from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SvgXml } from 'react-native-svg';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import CenteredSpinner from '../components/CenteredSpinner';
import PageHeader from '../components/PageHeader';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';
import { sortLeaguesByUnread } from '../lib/sortLeaguesByUnread';
import { resolveLeagueAvatarUri } from '../lib/leagueAvatars';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../lib/layout';
import { buildChatInboxRows, type ChatInboxThreadRow } from '../lib/chatInboxThreads';
import { VOLLEY_USER_ID } from '../lib/volley';
import { BRANDED_BROADCAST_VOLLEY_USER_ID } from '../lib/brandedLeaderboardBroadcastUnread';

type LeaguesResponse = Awaited<ReturnType<typeof api.listLeagues>>;
type LeagueSummary = LeaguesResponse['leagues'][number];

type LastMessage = {
  id?: string;
  league_id: string;
  content: string | null;
  created_at: string;
  user_id: string;
};

type LastByLeagueId = Record<string, LastMessage>;
type NameByUserId = Record<string, string>;

const BRANDED_LB_BADGE_SVG = `<svg width="22" height="22" viewBox="7 7 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M18 29C11.9284 29 7 24.0716 7 18C7 11.9284 11.9284 7 18 7C24.0716 7 29 11.9284 29 18C29 24.0716 24.0716 29 18 29ZM18 27.1667C23.0686 27.1667 27.1667 23.0686 27.1667 18C27.1667 12.9314 23.0686 8.83333 18 8.83333C12.9314 8.83333 8.83333 12.9314 8.83333 18C8.83333 23.0686 12.9314 27.1667 18 27.1667ZM14.8941 23.5647C14.2686 24.0392 13.6 23.5431 13.848 22.8098L15.0667 19.1539L11.9392 16.9216C11.3569 16.4902 11.551 15.6598 12.3382 15.6706L16.1775 15.7029L17.3529 12.0255C17.5794 11.3137 18.399 11.3137 18.6255 12.0255L19.801 15.7029L23.6402 15.6706C24.4382 15.6598 24.6108 16.501 24.0392 16.9216L20.9118 19.1539L22.1412 22.8098C22.3784 23.5431 21.7206 24.0392 21.0843 23.5647L17.9892 21.2892L14.8941 23.5647Z" fill="currentColor"/>
</svg>`;

export default function ChatInboxScreen({
  threadRouteName = 'ChatThread',
  title = 'Chat',
  subtitle = 'All your chats and broadcasts',
  showBackButton = false,
}: {
  threadRouteName?: 'ChatThread' | 'Chat2Thread';
  title?: string;
  subtitle?: string;
  showBackButton?: boolean;
} = {}) {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const listRef = React.useRef<FlatList<any> | null>(null);
  useScrollToTop(listRef as any);
  const { unreadByLeagueId, meId } = useLeagueUnreadCounts();

  const leaguesQ = useQuery<LeaguesResponse>({
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });

  const leagueList: LeagueSummary[] = React.useMemo(() => {
    const list = leaguesQ.data?.leagues ?? [];
    return sortLeaguesByUnread(list, unreadByLeagueId);
  }, [leaguesQ.data?.leagues, unreadByLeagueId]);

  const leagueIds = React.useMemo(() => leagueList.map((l) => String(l.id)), [leagueList]);
  const leagueIdsForQuery = React.useMemo(() => Array.from(new Set(leagueIds)).sort(), [leagueIds]);
  const leagueIdsKey = React.useMemo(() => leagueIdsForQuery.join(','), [leagueIdsForQuery]);
  const brandedLeaderboardsQ = useQuery({
    queryKey: ['branded-leaderboards-mine'],
    queryFn: () => api.getMyBrandedLeaderboards(),
    staleTime: 30_000,
  });
  const brandedLeaderboards = brandedLeaderboardsQ.data?.leaderboards ?? [];
  const leaderboardIdsForQuery = React.useMemo(
    () => Array.from(new Set(brandedLeaderboards.map((item) => String(item.leaderboard.id)))).sort(),
    [brandedLeaderboards]
  );
  const leaderboardIdsKey = React.useMemo(() => leaderboardIdsForQuery.join(','), [leaderboardIdsForQuery]);
  const brandedHostsQ = useQuery({
    enabled: !!meId && leaderboardIdsForQuery.length > 0,
    queryKey: ['chatInboxBrandedHostIdsV1', meId ?? 'anon', leaderboardIdsKey],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('branded_leaderboard_hosts')
        .select('leaderboard_id')
        .eq('user_id', meId)
        .in('leaderboard_id', leaderboardIdsForQuery);
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((row: any) => String(row?.leaderboard_id ?? '')).filter(Boolean))).sort();
    },
    staleTime: 30_000,
  });

  const lastMessagesQ = useQuery({
    enabled: leagueIdsForQuery.length > 0,
    // V2: do not cache non-serializable Maps (persisted query cache).
    queryKey: ['chatInboxLastMessagesV2', leagueIdsKey],
    queryFn: async () => {
      // Fetch a recent window across all leagues then reduce to per-league latest.
      // (Max 20 leagues/user, so this stays cheap.)
      const { data, error } = await (supabase as any)
        .from('league_messages')
        .select('id, league_id, content, created_at, user_id')
        .in('league_id', leagueIdsForQuery)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(500);
      if (error) throw error;

      const out: LastByLeagueId = {};
      (data ?? []).forEach((m: any) => {
        const id = String(m.league_id);
        if (out[id]) return;
        if (!m?.created_at) return;
        out[id] = {
          id: m?.id ? String(m.id) : undefined,
          league_id: id,
          content: typeof m.content === 'string' ? m.content : null,
          created_at: String(m.created_at),
          user_id: String(m.user_id ?? ''),
        };
      });
      return out;
    },
  });

  const broadcastSummaryQ = useQuery({
    enabled: leaderboardIdsForQuery.length > 0,
    queryKey: ['chatInboxBrandedBroadcastSummaryV1', meId ?? 'anon', leaderboardIdsKey],
    queryFn: async () => {
      const unreadByLeaderboardId: Record<string, number> = {};
      leaderboardIdsForQuery.forEach((id) => {
        unreadByLeaderboardId[id] = 0;
      });

      const { data: lastMessages, error: lastMessagesError } = await (supabase as any)
        .from('branded_leaderboard_broadcast_messages')
        .select('id, leaderboard_id, content, created_at, user_id')
        .in('leaderboard_id', leaderboardIdsForQuery)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(500);
      if (lastMessagesError) throw lastMessagesError;

      const lastByLeaderboardId: LastByLeagueId = {};
      (lastMessages ?? []).forEach((message: any) => {
        const leaderboardId = String(message.leaderboard_id ?? '');
        if (!leaderboardId || lastByLeaderboardId[leaderboardId]) return;
        if (!message?.created_at) return;
        lastByLeaderboardId[leaderboardId] = {
          id: message?.id ? String(message.id) : undefined,
          league_id: leaderboardId,
          content: typeof message.content === 'string' ? message.content : null,
          created_at: String(message.created_at),
          user_id: String(message.user_id ?? ''),
        };
      });

      if (!meId) {
        return { unreadByLeaderboardId, lastByLeaderboardId };
      }

      const { data: readsData, error: readsErr } = await (supabase as any)
        .from('branded_leaderboard_broadcast_reads')
        .select('leaderboard_id,last_read_at')
        .eq('user_id', meId)
        .in('leaderboard_id', leaderboardIdsForQuery);
      if (readsErr) throw readsErr;

      const defaultMs = 0;
      const lastReadMsByLeaderboard = new Map<string, number>();
      (readsData ?? []).forEach((row: any) => {
        const leaderboardId = String(row?.leaderboard_id ?? '');
        if (!leaderboardId) return;
        const ms = Date.parse(String(row?.last_read_at ?? ''));
        lastReadMsByLeaderboard.set(leaderboardId, Number.isFinite(ms) ? ms : defaultMs);
      });

      const withReads: string[] = [];
      const withoutReads: string[] = [];
      leaderboardIdsForQuery.forEach((id) => {
        if (lastReadMsByLeaderboard.has(id)) withReads.push(id);
        else withoutReads.push(id);
      });

      if (withReads.length > 0) {
        let earliestMs = Number.POSITIVE_INFINITY;
        withReads.forEach((id) => {
          const ms = lastReadMsByLeaderboard.get(id);
          if (typeof ms === 'number' && Number.isFinite(ms)) earliestMs = Math.min(earliestMs, ms);
        });
        if (!Number.isFinite(earliestMs)) earliestMs = defaultMs;

        const { data: unreadMessages, error: unreadMessagesError } = await (supabase as any)
          .from('branded_leaderboard_broadcast_messages')
          .select('leaderboard_id,created_at,user_id')
          .in('leaderboard_id', withReads)
          .gt('created_at', new Date(earliestMs).toISOString())
          .neq('user_id', meId)
          .neq('user_id', String(BRANDED_BROADCAST_VOLLEY_USER_ID))
          .limit(10_000);
        if (unreadMessagesError) throw unreadMessagesError;

        (unreadMessages ?? []).forEach((message: any) => {
          const leaderboardId = String(message?.leaderboard_id ?? '');
          if (!leaderboardId) return;
          const createdAtMs = Date.parse(String(message?.created_at ?? ''));
          if (!Number.isFinite(createdAtMs)) return;
          const lastReadMs = lastReadMsByLeaderboard.get(leaderboardId) ?? defaultMs;
          if (createdAtMs > lastReadMs) {
            unreadByLeaderboardId[leaderboardId] = (unreadByLeaderboardId[leaderboardId] ?? 0) + 1;
          }
        });
      }

      if (withoutReads.length > 0) {
        const counts = await Promise.all(
          withoutReads.map(async (leaderboardId) => {
            const { count, error } = await (supabase as any)
              .from('branded_leaderboard_broadcast_messages')
              .select('id', { count: 'exact', head: true })
              .eq('leaderboard_id', leaderboardId)
              .neq('user_id', meId)
              .neq('user_id', String(BRANDED_BROADCAST_VOLLEY_USER_ID));
            if (error) throw error;
            return [leaderboardId, typeof count === 'number' ? count : 0] as const;
          })
        );
        counts.forEach(([leaderboardId, count]) => {
          unreadByLeaderboardId[leaderboardId] = count;
        });
      }

      return { unreadByLeaderboardId, lastByLeaderboardId };
    },
    staleTime: 0,
  });

  React.useEffect(() => {
    if (leaderboardIdsForQuery.length === 0) return;
    let active = true;
    const channels = leaderboardIdsForQuery.map((leaderboardId) =>
      supabase
        .channel(`chat-inbox-branded-broadcast:${leaderboardId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'branded_leaderboard_broadcast_messages',
            filter: `leaderboard_id=eq.${leaderboardId}`,
          },
          () => {
            if (!active) return;
            void queryClient.invalidateQueries({ queryKey: ['chatInboxBrandedBroadcastSummaryV1', meId ?? 'anon'] });
          }
        )
        .subscribe()
    );

    return () => {
      active = false;
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [leaderboardIdsForQuery, meId, queryClient]);

  React.useEffect(() => {
    if (!meId) return;
    let active = true;
    const channel = supabase
      .channel(`chat-inbox-branded-broadcast-reads:${meId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'branded_leaderboard_broadcast_reads',
          filter: `user_id=eq.${meId}`,
        },
        () => {
          if (!active) return;
          void queryClient.invalidateQueries({ queryKey: ['chatInboxBrandedBroadcastSummaryV1', meId] });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [meId, queryClient]);

  const lastByLeagueId: LastByLeagueId = React.useMemo(() => {
    const raw = lastMessagesQ.data as unknown;
    // Backward compat: if a persisted cache ever contained a Map, normalize it.
    if (raw instanceof Map) {
      const obj: LastByLeagueId = {};
      (raw as Map<string, LastMessage>).forEach((v, k) => {
        obj[String(k)] = v;
      });
      return obj;
    }
    if (raw && typeof raw === 'object') return raw as LastByLeagueId;
    return {};
  }, [lastMessagesQ.data]);

  const lastBroadcastByLeaderboardId: LastByLeagueId = React.useMemo(() => {
    const raw = broadcastSummaryQ.data?.lastByLeaderboardId as unknown;
    if (raw && typeof raw === 'object') return raw as LastByLeagueId;
    return {};
  }, [broadcastSummaryQ.data?.lastByLeaderboardId]);

  const unreadBroadcastByLeaderboardId = React.useMemo(() => {
    const raw = broadcastSummaryQ.data?.unreadByLeaderboardId as unknown;
    if (raw && typeof raw === 'object') return raw as Record<string, number>;
    return {};
  }, [broadcastSummaryQ.data?.unreadByLeaderboardId]);

  const lastMessageUserIds = React.useMemo(() => {
    const ids = new Set<string>();
    Object.values(lastByLeagueId).forEach((m) => {
      const uid = String(m.user_id ?? '');
      if (!uid) return;
      ids.add(uid);
    });
    Object.values(lastBroadcastByLeaderboardId).forEach((m) => {
      const uid = String(m.user_id ?? '');
      if (!uid) return;
      ids.add(uid);
    });
    return Array.from(ids).sort();
  }, [lastBroadcastByLeaderboardId, lastByLeagueId]);

  const namesQ = useQuery({
    enabled: lastMessageUserIds.length > 0,
    queryKey: ['chatInboxUserNamesV2', lastMessageUserIds.join(',')],
    queryFn: async () => {
      // Best-effort: resolve sender names for last-message previews.
      const { data, error } = await (supabase as any).from('users').select('id,name,email').in('id', lastMessageUserIds).limit(200);
      if (error) throw error;
      const out: NameByUserId = {};
      (data ?? []).forEach((u: any) => {
        const id = u?.id ? String(u.id) : '';
        if (!id) return;
        const name = u?.name ? String(u.name) : u?.email ? String(u.email) : '';
        if (name) out[id] = name;
      });
      return out;
    },
    staleTime: 60_000,
  });

  const nameByUserId: NameByUserId = React.useMemo(() => {
    const raw = namesQ.data as unknown;
    if (raw instanceof Map) {
      const obj: NameByUserId = {};
      (raw as Map<string, string>).forEach((v, k) => {
        obj[String(k)] = String(v);
      });
      return obj;
    }
    if (raw && typeof raw === 'object') return raw as NameByUserId;
    return {};
  }, [namesQ.data]);

  const leaguePreviewByLeagueId = React.useMemo(() => {
    const out: Record<string, string> = {};
    Object.entries(lastByLeagueId).forEach(([leagueId, last]) => {
      const content = last?.content ? String(last.content) : null;
      const senderName =
        last?.user_id === String(meId ?? '')
          ? 'You'
          : last?.user_id === String(VOLLEY_USER_ID)
            ? 'Volley'
            : last?.user_id
              ? nameByUserId[String(last.user_id)] ?? null
              : null;
      out[leagueId] = content ? (senderName ? `${senderName}: ${content}` : content) : 'No messages yet';
    });
    return out;
  }, [lastByLeagueId, meId, nameByUserId]);

  const broadcastPreviewByLeaderboardId = React.useMemo(() => {
    const out: Record<string, string> = {};
    Object.entries(lastBroadcastByLeaderboardId).forEach(([leaderboardId, last]) => {
      const content = last?.content ? String(last.content) : null;
      const senderName =
        last?.user_id === String(meId ?? '')
          ? 'You'
          : last?.user_id === String(BRANDED_BROADCAST_VOLLEY_USER_ID)
            ? 'Volley'
            : last?.user_id
              ? nameByUserId[String(last.user_id)] ?? 'Host'
              : 'Host';
      out[leaderboardId] = content ? (senderName ? `${senderName}: ${content}` : content) : 'No broadcasts yet';
    });
    return out;
  }, [lastBroadcastByLeaderboardId, meId, nameByUserId]);

  const brandedHostIds = React.useMemo(() => {
    const raw = brandedHostsQ.data as unknown;
    if (raw instanceof Set) return raw as Set<string>;
    if (Array.isArray(raw)) return new Set(raw.map((value) => String(value)).filter(Boolean));
    return new Set<string>();
  }, [brandedHostsQ.data]);

  const rows = React.useMemo(() => {
    return buildChatInboxRows({
      threadRouteName,
      leagues: leagueList.map((league) => ({
        id: String(league.id),
        name: String(league.name ?? ''),
        avatar: typeof (league as any)?.avatar === 'string' ? (league as any).avatar : null,
      })),
      unreadByLeagueId,
      lastLeagueMessageByLeagueId: lastByLeagueId,
      leaguePreviewByLeagueId,
      brandedLeaderboards: brandedLeaderboards.map((item) => ({
        ...item,
        canPostBroadcast: Boolean((item as any).canPostBroadcast) || brandedHostIds.has(String(item.leaderboard.id)),
      })),
      unreadBroadcastByLeaderboardId,
      lastBroadcastByLeaderboardId,
      broadcastPreviewByLeaderboardId,
    });
  }, [
    brandedHostIds,
    broadcastPreviewByLeaderboardId,
    brandedLeaderboards,
    lastBroadcastByLeaderboardId,
    lastByLeagueId,
    leagueList,
    leaguePreviewByLeagueId,
    threadRouteName,
    unreadBroadcastByLeaderboardId,
    unreadByLeagueId,
  ]);

  const showInitialSpinner = (leaguesQ.isLoading && !leaguesQ.data && !leaguesQ.error) || false;
  if (showInitialSpinner) {
    return (
      <Screen fullBleed>
        <CenteredSpinner loading />
      </Screen>
    );
  }

  return (
    <Screen fullBleed>
      <PageHeader
        title={title}
        subtitle={subtitle}
        leftAction={
          showBackButton ? (
            <Pressable
              onPress={() => {
                if (navigation?.canGoBack?.()) {
                  navigation.goBack();
                  return;
                }
                navigation.navigate('Tabs', { screen: 'Predictions' });
              }}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons name="chevron-back" size={22} color={t.color.text} />
            </Pressable>
          ) : null
        }
      />
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r) => r.key}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: 0,
          paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
        }}
        ListHeaderComponent={
          <View style={{ paddingBottom: 12 }}>
            {leaguesQ.error ? (
              <Card style={{ marginTop: 12 }}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  Couldn’t load chats
                </TotlText>
                <TotlText variant="muted">{(leaguesQ.error as any)?.message ?? 'Unknown error'}</TotlText>
              </Card>
            ) : null}

            {lastMessagesQ.error ? (
              <Card style={{ marginTop: 12 }}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  Couldn’t load latest messages
                </TotlText>
                <TotlText variant="muted">{(lastMessagesQ.error as any)?.message ?? 'Unknown error'}</TotlText>
              </Card>
            ) : null}

            {brandedLeaderboardsQ.error ? (
              <Card style={{ marginTop: 12 }}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  Couldn’t load broadcasts
                </TotlText>
                <TotlText variant="muted">{(brandedLeaderboardsQ.error as any)?.message ?? 'Unknown error'}</TotlText>
              </Card>
            ) : null}

            {broadcastSummaryQ.error ? (
              <Card style={{ marginTop: 12 }}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  Couldn’t load latest broadcasts
                </TotlText>
                <TotlText variant="muted">{(broadcastSummaryQ.error as any)?.message ?? 'Unknown error'}</TotlText>
              </Card>
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: 'rgba(15,23,42,0.06)' }} />}
        ListEmptyComponent={
          leaguesQ.isLoading || brandedLeaderboardsQ.isLoading ? null : (
            <Card>
              <TotlText variant="muted">No chats or broadcasts yet.</TotlText>
            </Card>
          )
        }
        renderItem={({ item }: { item: ChatInboxThreadRow }) => {
          const avatarUri = item.type === 'league' ? resolveLeagueAvatarUri(item.avatarUri) : item.avatarUri;
          const unread = item.unread;

          return (
            <Pressable
              onPress={() => {
                if (item.type === 'broadcast') {
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
                          [item.leaderboardId]: 0,
                        },
                      };
                    }
                  );
                  navigation.push('BrandedLeaderboard', {
                    idOrSlug: item.leaderboardId,
                    initialTab: 'broadcast',
                  });
                  return;
                }
                navigation.push(item.routeName, { leagueId: item.leagueId, name: item.title });
              }}
              style={({ pressed }) => ({
                paddingVertical: 14,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, marginRight: 12, position: 'relative' }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: t.color.surface2,
                      borderWidth: 1,
                      borderColor: t.color.border,
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={{ width: 44, height: 44 }} />
                    ) : (
                      <TotlText style={{ fontFamily: 'Gramatika-Bold', fontWeight: '900' }}>{item.initials}</TotlText>
                    )}
                  </View>
                  {item.type === 'broadcast' ? (
                    <View
                      style={{
                        position: 'absolute',
                        right: -3,
                        bottom: -3,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: t.color.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <SvgXml xml={BRANDED_LB_BADGE_SVG} width={20} height={20} color="#1C8376" />
                    </View>
                  ) : null}
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}>
                      <TotlText
                        style={{
                          flexShrink: 1,
                          fontFamily: 'Gramatika-Bold',
                          fontWeight: '900',
                          fontSize: 16,
                          color: t.color.text,
                        }}
                        numberOfLines={1}
                      >
                        {item.title}
                      </TotlText>
                      {item.type === 'broadcast' ? (
                        <>
                          <View
                            style={{
                              marginLeft: 8,
                              borderRadius: 999,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              backgroundColor: 'rgba(28,131,118,0.12)',
                            }}
                          >
                            <TotlText style={{ color: '#1C8376', fontSize: 11, fontWeight: '700' }}>Broadcast</TotlText>
                          </View>
                          {item.canPostBroadcast ? (
                            <View
                              style={{
                                marginLeft: 6,
                                borderRadius: 999,
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                backgroundColor: 'rgba(15,23,42,0.08)',
                              }}
                            >
                              <TotlText style={{ color: t.color.text, fontSize: 11, fontWeight: '700' }}>Host</TotlText>
                            </View>
                          ) : null}
                        </>
                      ) : null}
                    </View>
                    {item.when ? (
                      <TotlText variant="microMuted" style={{ marginLeft: 10 }}>
                        {item.when}
                      </TotlText>
                    ) : null}
                  </View>

                  <TotlText
                    variant="muted"
                    numberOfLines={1}
                    style={{
                      marginTop: 5,
                      color: unread > 0 ? t.color.text : t.color.muted,
                      fontFamily: unread > 0 ? 'Gramatika-Medium' : 'Gramatika-Regular',
                      fontWeight: unread > 0 ? '700' : '400',
                    }}
                  >
                    {item.preview}
                  </TotlText>
                </View>

                {unread > 0 ? (
                  <View
                    style={{
                      marginLeft: 12,
                      minWidth: 22,
                      height: 22,
                      paddingHorizontal: 7,
                      borderRadius: 999,
                      backgroundColor: '#DC2626',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TotlText style={{ color: '#FFFFFF', fontFamily: 'System', fontWeight: '800', fontSize: 12 }}>
                      {unread > 99 ? '99+' : String(unread)}
                    </TotlText>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

