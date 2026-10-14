import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, TotlText, useTokens } from '@totl/ui';

import AppTopHeader from '../../components/AppTopHeader';
import LeaderboardTable, { type LeaderboardRow } from '../../components/leaderboards/LeaderboardTable';
import UnderlineTabs from '../../components/UnderlineTabs';
import { api } from '../../lib/api';
import { playersDayKey, playersMonthName } from '../../lib/retroPlayers/day';
import { readPlayersScores, scoreForDay, scoreForMonth, scoreOverall } from '../../lib/retroPlayers/scores';
import { supabase } from '../../lib/supabase';

type BoardTab = 'today' | 'month' | 'overall';

const PREM_PREDICTIONS = 'prem predictions';

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

  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: ['players-scoreboard-roster'],
    queryFn: async () => {
      const { leagues } = await api.listLeagues();
      const league = leagues.find((row) => row.name.trim().toLowerCase() === PREM_PREDICTIONS);
      if (!league) return [];
      const detail = await api.getLeague(String(league.id));
      return detail.members.map((member) => ({
        user_id: String(member.id),
        name: member.name || 'Player',
        avatar_url: member.avatar_url ?? null,
      }));
    },
    staleTime: 60_000,
  });

  const { data: scores = {} } = useQuery({
    queryKey: ['players-day-scores'],
    queryFn: readPlayersScores,
  });

  const rows = React.useMemo(() => {
    const mine =
      tab === 'today' ? scoreForDay(scores, dayKey) : tab === 'month' ? scoreForMonth(scores, dayKey) : scoreOverall(scores);
    const built: LeaderboardRow[] = roster.map((member) => ({
      user_id: member.user_id,
      name: member.name,
      avatar_url: member.avatar_url,
      value: userId != null && member.user_id === userId ? mine : null,
    }));
    return orderRows(built);
  }, [dayKey, roster, scores, tab, userId]);

  const subtitle =
    tab === 'today'
      ? 'Prem Predictions · today'
      : tab === 'month'
        ? `Prem Predictions · ${monthLabel}`
        : 'Prem Predictions · overall';
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

          {rosterLoading ? <TotlText variant="muted">Loading the table…</TotlText> : null}

          {!rosterLoading && rows.length === 0 ? (
            <TotlText variant="muted">Prem Predictions isn’t on this account yet.</TotlText>
          ) : null}

          {rows.length > 0 ? (
            <LeaderboardTable
              rows={rows}
              valueLabel={valueLabel}
              highlightUserId={userId}
              style={{ flex: 1, marginHorizontal: -t.space[4], marginBottom: -24 }}
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
