import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, TotlText, useTokens } from '@totl/ui';

import AppTopHeader from '../../components/AppTopHeader';
import LeaderboardTable, { type LeaderboardRow } from '../../components/leaderboards/LeaderboardTable';
import UnderlineTabs from '../../components/UnderlineTabs';
import { playersDayKey, playersMonthName } from '../../lib/retroPlayers/day';
import { readSharedPlayersScores, scoreForDay, scoreForMonth, scoreOverall, type PlayersScoreStore } from '../../lib/retroPlayers/scores';
import { supabase } from '../../lib/supabase';

type BoardTab = 'today' | 'month' | 'overall';

type PlayerName = { id: string; name: string | null; avatar_url: string | null };

function orderRows(rows: LeaderboardRow[]): LeaderboardRow[] {
  return [...rows].sort((a, b) => {
    if (a.value == null && b.value == null) return a.name.localeCompare(b.name);
    if (a.value == null) return 1;
    if (b.value == null) return -1;
    if (b.value !== a.value) return b.value - a.value;
    return a.name.localeCompare(b.name);
  });
}

/** The Players board, laid out like the 2026/27 leaderboard. */
export default function RetroPlayersScoreboardScreen() {
  const t = useTokens();
  const navigation = useNavigation();
  const [tab, setTab] = React.useState<BoardTab>('today');
  const dayKey = playersDayKey();
  const monthLabel = playersMonthName(dayKey);

  const close = React.useCallback(() => {
    if (navigation.canGoBack?.()) navigation.goBack();
  }, [navigation]);

  const { data: userData } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });
  const userId = userData?.id ?? null;

  const { data: scoresByUser = {}, isLoading: scoresLoading } = useQuery({
    queryKey: ['players-shared-scores', userId],
    enabled: !!userId,
    queryFn: readSharedPlayersScores,
    refetchOnMount: 'always',
  });

  const playerIds = React.useMemo(() => Object.keys(scoresByUser).sort(), [scoresByUser]);

  const { data: names = [], isLoading: namesLoading } = useQuery({
    queryKey: ['players-scoreboard-names', playerIds.join(',')],
    enabled: playerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, name, avatar_url').in('id', playerIds);
      if (error) throw error;
      return (data ?? []) as PlayerName[];
    },
  });

  const rows = React.useMemo(() => {
    const nameById = new Map(names.map((player) => [player.id, player]));
    const built: LeaderboardRow[] = [];
    for (const id of playerIds) {
      const store: PlayersScoreStore = scoresByUser[id] ?? {};
      const value =
        tab === 'today' ? scoreForDay(store, dayKey) : tab === 'month' ? scoreForMonth(store, dayKey) : scoreOverall(store);
      if (value == null) continue;
      const player = nameById.get(id);
      built.push({
        user_id: id,
        name: player?.name?.trim() || 'Player',
        avatar_url: player?.avatar_url ?? null,
        value,
      });
    }
    return orderRows(built);
  }, [dayKey, names, playerIds, scoresByUser, tab]);

  const winnerUserIds = React.useMemo(() => {
    const top = rows[0]?.value;
    if (top == null || top <= 0) return [];
    return rows.filter((row) => row.value === top).map((row) => row.user_id);
  }, [rows]);

  const subtitle =
    tab === 'today' ? 'All players · today' : tab === 'month' ? `All players · ${monthLabel}` : 'All players · overall';
  const valueLabel = tab === 'today' ? 'Today' : tab === 'month' ? monthLabel.slice(0, 3) : 'Total';

  return (
    <Screen fullBleed>
      <View style={{ flex: 1 }}>
        <AppTopHeader
          hideProfile
          hideChat
          onPressChat={() => undefined}
          onPressProfile={() => undefined}
          hasLiveGames={false}
          centerContent={<View />}
        />

        <View style={{ flex: 1, minHeight: 0, paddingHorizontal: t.space[4] }}>
          <View style={{ marginTop: 4, minHeight: 36, justifyContent: 'center' }}>
            <TotlText
              style={{
                textAlign: 'center',
                fontWeight: '900',
                fontSize: 20,
                lineHeight: 24,
                color: t.color.text,
                paddingHorizontal: 44,
              }}
            >
              Totl Daily - The Players
            </TotlText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close scoreboard"
              onPress={close}
              style={({ pressed }) => ({
                position: 'absolute',
                right: 0,
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? '#CBD5E1' : t.color.surface2,
                borderWidth: 1,
                borderColor: t.color.border,
              })}
            >
              <Ionicons name="close" size={22} color={t.color.text} />
            </Pressable>
          </View>
          <View style={{ marginTop: 12 }}>
            <UnderlineTabs
              items={[
                { key: 'today', label: 'Today' },
                { key: 'month', label: monthLabel },
                { key: 'overall', label: 'Overall' },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>

          <View style={{ marginTop: 14, marginBottom: 10 }}>
            <TotlText variant="sectionSubtitle" style={{ fontSize: 13, lineHeight: 18 }} numberOfLines={1}>
              {subtitle}
            </TotlText>
          </View>

          {scoresLoading || (namesLoading && rows.length === 0) ? (
            <TotlText variant="muted">Loading the table…</TotlText>
          ) : null}

          {!scoresLoading && !namesLoading && rows.length === 0 ? (
            <TotlText variant="muted">No scores yet.</TotlText>
          ) : null}

          {rows.length > 0 ? (
            <LeaderboardTable
              rows={rows}
              valueLabel={valueLabel}
              highlightUserId={userId}
              winnerUserIds={winnerUserIds}
              style={{ flex: 1, marginHorizontal: -t.space[4], marginBottom: -24 }}
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
