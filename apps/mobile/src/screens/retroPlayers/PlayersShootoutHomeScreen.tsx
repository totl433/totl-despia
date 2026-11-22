import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { PlayersShootout } from '@totl/api-client';
import { TotlText } from '@totl/ui';

import { TotlRefreshControl } from '../../lib/refreshControl';
import { groupShootouts } from '../../lib/retroPlayers/shootout';
import { shootoutSandbox } from '../../lib/retroPlayers/shootoutSandbox';
import { markShootoutSeen } from '../../lib/retroPlayers/shootoutSeen';
import { useShootoutClient } from '../../lib/retroPlayers/useShootoutClient';
import { supabase } from '../../lib/supabase';
import type { RetroTotlDailyPlayersStackParamList } from '../../navigation/RetroTotlDailyPlayersNavigator';
import { PlayersButton, PlayersTextLink } from '../../components/retroPlayers/PlayersControls';
import PlayersPatternCard from '../../components/retroPlayers/PlayersPatternCard';
import { ShootoutRow, ShootoutSectionLabel } from '../../components/retroPlayers/PlayersShootoutBits';
import ShootoutRulesSheet from '../../components/retroPlayers/ShootoutRulesSheet';
import ShootoutSandboxPanel from '../../components/retroPlayers/ShootoutSandboxPanel';
import { PLAYERS_COLORS, PLAYERS_FONTS } from '../../components/retroPlayers/playersTheme';

/** How many finished Shootouts the home shows before "See all". */
const RECENT_FINISHED = 3;

/** Shootouts home: your record, Start a Shootout, the ones in play, and the last few finished. */
export default function PlayersShootoutHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RetroTotlDailyPlayersStackParamList>>();
  const { params } = useRoute<RouteProp<RetroTotlDailyPlayersStackParamList, 'PlayersShootoutHome'>>();
  const { client, sandbox, listKey } = useShootoutClient(params?.sandbox);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [now, setNow] = React.useState(() => Date.now());
  const [rulesOpen, setRulesOpen] = React.useState(false);

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: listKey,
    queryFn: () => client.listPlayersShootouts(),
    refetchInterval: 60_000,
  });

  // Sandbox: play as yourself, with your name and picture.
  React.useEffect(() => {
    if (!sandbox) return;
    void (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      const { data: row } = await supabase.from('users').select('name, avatar_url').eq('id', user.id).maybeSingle();
      shootoutSandbox.setMe({
        id: user.id,
        name: String(row?.name ?? '').trim() || 'You',
        avatarUrl: typeof row?.avatar_url === 'string' ? row.avatar_url : null,
      });
    })();
  }, [sandbox]);

  // Back from a challenge: catch up on whatever moved.
  useFocusEffect(
    React.useCallback(() => {
      setNow(Date.now());
      void refetch();
    }, [refetch])
  );

  const all = React.useMemo(() => data?.challenges ?? [], [data]);
  const groups = React.useMemo(() => groupShootouts(all), [all]);
  const allFinished = React.useMemo(() => all.filter((c) => c.status === 'finished'), [all]);
  const won = allFinished.filter((c) => c.result === 'won').length;
  const lost = allFinished.filter((c) => c.result === 'lost').length;
  const inPlay = [...groups.yourMove, ...groups.waiting];
  const recentFinished = groups.finished.slice(0, RECENT_FINISHED);
  const moreFinished = groups.finished.length > RECENT_FINISHED;

  const open = (id: string) => navigation.navigate('PlayersShootoutMatch', { id, sandbox });
  const back = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else if (sandbox) navigation.getParent()?.goBack();
    else navigation.replace('RetroTotlDailyPlayersPlay');
  };

  /** The X on a row: end that Shootout, after saying what ending it means. */
  const confirmEnd = (c: PlayersShootout) => {
    const end = async () => {
      try {
        markShootoutSeen(c.id, sandbox, ['final', ...c.games.map((g) => `g${g.number}`)]);
        await client.leavePlayersShootout(c.id);
      } catch (e) {
        Alert.alert("Couldn't end it", e instanceof Error ? e.message : 'Try again in a moment.');
      } finally {
        void queryClient.invalidateQueries({ queryKey: listKey });
      }
    };
    const [title, body, action] =
      c.status === 'pending'
        ? c.iAmChallenger
          ? ['Cancel your challenge?', `${c.them.name} won't be able to accept it.`, 'Cancel it']
          : ['Decline the challenge?', `${c.them.name} will see you said no.`, 'Decline']
        : ['End this Shootout?', `${c.them.name} wins if you end it. This can't be undone.`, 'End it'];
    Alert.alert(title, body, [
      { text: 'Keep it', style: 'cancel' },
      { text: action, style: 'destructive', onPress: () => void end() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: PLAYERS_COLORS.paper, paddingTop: insets.top }}>
      <ShootoutRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Shootouts"
          onPress={back}
          hitSlop={10}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="close" size={24} color={PLAYERS_COLORS.inkSoft} />
        </Pressable>
        <PlayersTextLink label="Rules" onPress={() => setRulesOpen(true)} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 16 }}
        refreshControl={<TotlRefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card: the name, and your record */}
        <PlayersPatternCard variant="green" layout="hug">
          <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 }}>
            <TotlText style={styles.kicker}>The Players · Head to head</TotlText>
            <TotlText accessibilityRole="header" style={styles.title}>
              Shootout
            </TotlText>
            <View style={styles.stats}>
              {(
                [
                  ['In play', inPlay.length],
                  ['Won', won],
                  ['Lost', lost],
                ] as const
              ).map(([label, value]) => (
                <View key={label} style={styles.stat}>
                  <TotlText style={styles.statValue}>{value}</TotlText>
                  <TotlText style={styles.statLabel}>{label}</TotlText>
                </View>
              ))}
            </View>
          </View>
        </PlayersPatternCard>

        <PlayersButton label="Start a Shootout" arrow onPress={() => navigation.navigate('PlayersShootoutPick', { sandbox })} />

        {isLoading ? <TotlText style={styles.note}>Loading your Shootouts…</TotlText> : null}
        {error ? <TotlText style={styles.note}>Couldn't load your Shootouts. Pull down to try again.</TotlText> : null}

        <View style={{ gap: 10 }}>
          <ShootoutSectionLabel>In play</ShootoutSectionLabel>
          {inPlay.length ? (
            inPlay.map((c) => (
              <ShootoutRow key={c.id} challenge={c} now={now} onPress={() => open(c.id)} onEnd={() => confirmEnd(c)} />
            ))
          ) : !isLoading ? (
            <TotlText style={styles.empty}>Nothing in play. Start a Shootout to get one going.</TotlText>
          ) : null}
        </View>

        {recentFinished.length ? (
          <View style={{ gap: 10 }}>
            <View style={styles.sectionRow}>
              <ShootoutSectionLabel>Finished</ShootoutSectionLabel>
              {moreFinished ? (
                <PlayersTextLink
                  label={`See all ${groups.finished.length}`}
                  color={PLAYERS_COLORS.brand}
                  onPress={() => navigation.navigate('PlayersShootoutHistory', { sandbox })}
                />
              ) : null}
            </View>
            {recentFinished.map((c) => (
              <ShootoutRow key={c.id} challenge={c} now={now} onPress={() => open(c.id)} />
            ))}
          </View>
        ) : null}

        {sandbox ? (
          <View style={{ marginTop: 12 }}>
            <ShootoutSandboxPanel onOpenChallenge={open} />
          </View>
        ) : null}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  // As the Scoreboard: close 15pt from the top, at 24pt.
  topBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 15,
    paddingHorizontal: 16,
  },
  kicker: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 17,
    lineHeight: 19,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: PLAYERS_COLORS.whiteSoft,
  },
  title: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 64,
    lineHeight: 58,
    paddingTop: 8,
    textTransform: 'uppercase',
    color: PLAYERS_COLORS.white,
  },
  stats: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: PLAYERS_COLORS.whiteFaint,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 40,
    lineHeight: 40,
    paddingTop: 6,
    color: PLAYERS_COLORS.goldEnd,
  },
  statLabel: {
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 13,
    lineHeight: 17,
    color: PLAYERS_COLORS.whiteSoft,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  note: { fontFamily: PLAYERS_FONTS.body, fontSize: 15, lineHeight: 21, color: PLAYERS_COLORS.muted, textAlign: 'center' },
  empty: { fontFamily: PLAYERS_FONTS.body, fontSize: 15, lineHeight: 21, color: PLAYERS_COLORS.muted },
});
