import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ApiError } from '@totl/api-client';
import { TotlText } from '@totl/ui';

import { shootoutSandbox } from '../../lib/retroPlayers/shootoutSandbox';
import { useShootoutClient } from '../../lib/retroPlayers/useShootoutClient';
import { searchUsersByName, type UserSearchHit } from '../../lib/searchUsers';
import { supabase } from '../../lib/supabase';
import type { RetroTotlDailyPlayersStackParamList } from '../../navigation/RetroTotlDailyPlayersNavigator';
import {
  ShootoutAvatar,
  ShootoutSectionLabel,
  ShootoutTitle,
  ShootoutTopBar,
} from '../../components/retroPlayers/PlayersShootoutBits';
import { PLAYERS_COLORS, PLAYERS_FONTS } from '../../components/retroPlayers/playersTheme';

const SEARCH_DELAY_MS = 250;

/** Shootout: find someone and challenge them. */
export default function PlayersShootoutPickScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RetroTotlDailyPlayersStackParamList>>();
  const queryClient = useQueryClient();
  const { params } = useRoute<RouteProp<RetroTotlDailyPlayersStackParamList, 'PlayersShootoutPick'>>();
  const { client, sandbox, listKey } = useShootoutClient(params?.sandbox);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<UserSearchHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [sendingTo, setSendingTo] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const { data: me } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => (await supabase.auth.getUser()).data.user ?? null,
  });
  const { data: list } = useQuery({ queryKey: listKey, queryFn: () => client.listPlayersShootouts() });

  // People you've played before, most recent first.
  const recent = React.useMemo(() => {
    const seen = new Set<string>();
    const out: UserSearchHit[] = [];
    for (const c of list?.challenges ?? []) {
      if (seen.has(c.them.id)) continue;
      seen.add(c.them.id);
      out.push({ id: c.them.id, name: c.them.name, avatarUrl: c.them.avatarUrl });
    }
    return out.slice(0, 6);
  }, [list]);

  React.useEffect(() => {
    const q = query.trim();
    if (sandbox) return;
    if (q.length < 3) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      searchUsersByName(q)
        .then((found) => {
          if (!cancelled) setHits(found);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, sandbox]);

  const challenge = React.useCallback(
    async (player: UserSearchHit) => {
      if (sendingTo) return;
      setSendingTo(player.id);
      setMessage(null);
      try {
        const { challenge: created } = await client.createPlayersShootout(player.id);
        void queryClient.invalidateQueries({ queryKey: listKey });
        navigation.replace('PlayersShootoutMatch', { id: created.id, sandbox });
      } catch (error) {
        const body = error instanceof ApiError ? (error.body as { challengeId?: string } | null) : null;
        if (body?.challengeId) {
          // Already playing them: open that one.
          navigation.replace('PlayersShootoutMatch', { id: body.challengeId, sandbox });
          return;
        }
        setMessage(error instanceof Error ? error.message : "Couldn't send the challenge.");
      } finally {
        setSendingTo(null);
      }
    },
    [client, listKey, navigation, queryClient, sandbox, sendingTo]
  );

  const visibleHits = hits.filter((h) => h.id !== me?.id);
  const visibleRecent = recent.filter((h) => h.id !== me?.id);
  const typing = query.trim().length > 0;

  const renderPlayer = (player: UserSearchHit) => (
    <Pressable
      key={player.id}
      accessibilityRole="button"
      accessibilityLabel={`Challenge ${player.name}`}
      disabled={!!sendingTo}
      onPress={() => void challenge(player)}
      style={({ pressed }) => [styles.player, { opacity: pressed ? 0.85 : 1 }]}
    >
      <ShootoutAvatar person={player} size={36} />
      <TotlText style={styles.playerName} numberOfLines={1}>
        {player.name}
      </TotlText>
      {sendingTo === player.id ? (
        <ActivityIndicator color={PLAYERS_COLORS.brand} />
      ) : (
        <TotlText style={styles.challengeLabel}>Challenge</TotlText>
      )}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: PLAYERS_COLORS.paper, paddingTop: insets.top }}>
      <ShootoutTopBar onBack={() => navigation.goBack()} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 32, gap: 14 }}
      >
        <ShootoutTitle kicker="Shootout" title="Who's up?" />

        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={PLAYERS_COLORS.muted} />
          <TextInput
            editable={!sandbox}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name"
            placeholderTextColor={PLAYERS_COLORS.muted}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
            style={styles.searchInput}
            accessibilityLabel="Search players by name"
          />
          {searching ? <ActivityIndicator color={PLAYERS_COLORS.muted} /> : null}
        </View>

        {message ? <TotlText style={[styles.note, { color: PLAYERS_COLORS.red }]}>{message}</TotlText> : null}

        {sandbox ? (
          <View style={{ gap: 8 }}>
            <ShootoutSectionLabel>Sandbox</ShootoutSectionLabel>
            {renderPlayer({ id: shootoutSandbox.bot.id, name: shootoutSandbox.bot.name, avatarUrl: null })}
          </View>
        ) : typing ? (
          <View style={{ gap: 8 }}>
            {query.trim().length < 3 ? <TotlText style={styles.note}>Type at least 3 letters.</TotlText> : null}
            {query.trim().length >= 3 && !searching && visibleHits.length === 0 ? (
              <TotlText style={styles.note}>Nobody by that name.</TotlText>
            ) : null}
            {visibleHits.map(renderPlayer)}
          </View>
        ) : visibleRecent.length ? (
          <View style={{ gap: 8 }}>
            <ShootoutSectionLabel>Played before</ShootoutSectionLabel>
            {visibleRecent.map(renderPlayer)}
          </View>
        ) : (
          <TotlText style={styles.note}>Search for anyone who plays TOTL.</TotlText>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PLAYERS_COLORS.mist,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: PLAYERS_FONTS.body,
    fontSize: 17,
    color: PLAYERS_COLORS.inkSoft,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PLAYERS_COLORS.mist,
  },
  playerName: {
    flex: 1,
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 17,
    lineHeight: 22,
    color: PLAYERS_COLORS.inkSoft,
  },
  challengeLabel: {
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 15,
    color: PLAYERS_COLORS.brand,
  },
  note: {
    fontFamily: PLAYERS_FONTS.body,
    fontSize: 15,
    lineHeight: 21,
    color: PLAYERS_COLORS.muted,
  },
});
