import React from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import CenteredSpinner from '../components/CenteredSpinner';
import PageHeader from '../components/PageHeader';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';
import { sortLeaguesByUnread } from '../lib/sortLeaguesByUnread';
import { resolveLeagueAvatarUri } from '../lib/leagueAvatars';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../lib/layout';
import { VOLLEY_USER_ID } from '../lib/volley';

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

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(d, now)) {
    // HH:MM (within a day)
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (isSameDay(d, y)) return 'Yesterday';

  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays >= 2 && diffDays <= 7) {
    // Day (older than a day)
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');

  // DD.MM (older than a month this year)
  if (d.getFullYear() === now.getFullYear()) return `${dd}.${mm}`;

  // DD.MM.YY (older than all of above)
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

export default function ChatInboxScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
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

  const showInitialSpinner = (leaguesQ.isLoading && !leaguesQ.data && !leaguesQ.error) || false;
  if (showInitialSpinner) {
    return (
      <Screen fullBleed>
        <CenteredSpinner loading />
      </Screen>
    );
  }

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

  const lastMessageUserIds = React.useMemo(() => {
    const ids = new Set<string>();
    Object.values(lastByLeagueId).forEach((m) => {
      const uid = String(m.user_id ?? '');
      if (!uid) return;
      ids.add(uid);
    });
    return Array.from(ids).sort();
  }, [lastByLeagueId]);

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

  const rows = React.useMemo(() => {
    const base = leagueList.map((l) => {
      const leagueId = String(l.id);
      const unread = Number(unreadByLeagueId[leagueId] ?? 0);
      const last = lastByLeagueId[leagueId] ?? null;
      const lastAt = last?.created_at ? new Date(last.created_at).getTime() : 0;
      return { league: l, leagueId, unread, last, lastAt };
    });

    // Airbnb-style ordering: unread first, then most recent message.
    base.sort((a, b) => {
      const aHas = a.unread > 0 ? 1 : 0;
      const bHas = b.unread > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      if (a.lastAt !== b.lastAt) return b.lastAt - a.lastAt;
      return String(a.league?.name ?? '').localeCompare(String(b.league?.name ?? ''));
    });

    return base;
  }, [lastByLeagueId, leagueList, unreadByLeagueId]);

  return (
    <Screen fullBleed>
      <PageHeader title="Chat" subtitle="All your mini league chats" />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.leagueId}
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
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: 'rgba(15,23,42,0.06)' }} />}
        ListEmptyComponent={
          leaguesQ.isLoading ? null : (
            <Card>
              <TotlText variant="muted">No mini leagues yet.</TotlText>
            </Card>
          )
        }
        renderItem={({ item }) => {
          const l = item.league;
          const leagueId = item.leagueId;
          const unread = item.unread;
          const last = item.last;

          const avatarUri = resolveLeagueAvatarUri(typeof (l as any)?.avatar === 'string' ? (l as any).avatar : null);
          const initials = String(l?.name ?? 'ML')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p.slice(0, 1).toUpperCase())
            .join('');

          const content = last?.content ? String(last.content) : null;
          const senderName =
            last?.user_id === String(meId ?? '')
              ? 'You'
              : last?.user_id === String(VOLLEY_USER_ID)
                ? 'Volley'
                : last?.user_id
                  ? nameByUserId[String(last.user_id)] ?? null
                  : null;
          const preview = content ? (senderName ? `${senderName}: ${content}` : content) : 'No messages yet';
          const when = last?.created_at ? formatTimestamp(last.created_at) : '';

          return (
            <Pressable
              onPress={() => navigation.navigate('ChatThread', { leagueId, name: String(l.name ?? '') })}
              style={({ pressed }) => ({
                paddingVertical: 14,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
                    marginRight: 12,
                  }}
                >
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={{ width: 44, height: 44 }} />
                  ) : (
                    <TotlText style={{ fontFamily: 'Gramatika-Bold', fontWeight: '900' }}>{initials || 'ML'}</TotlText>
                  )}
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TotlText
                      style={{
                        flex: 1,
                        fontFamily: 'Gramatika-Bold',
                        fontWeight: '900',
                        fontSize: 16,
                        color: t.color.text,
                      }}
                      numberOfLines={1}
                    >
                      {String(l.name ?? '')}
                    </TotlText>
                    {when ? (
                      <TotlText variant="microMuted" style={{ marginLeft: 10 }}>
                        {when}
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
                    {preview}
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

