import React from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { TotlText } from '@totl/ui';

import { TotlRefreshControl } from '../../lib/refreshControl';
import { useShootoutClient } from '../../lib/retroPlayers/useShootoutClient';
import type { RetroTotlDailyPlayersStackParamList } from '../../navigation/RetroTotlDailyPlayersNavigator';
import { ShootoutRow, ShootoutTopBar } from '../../components/retroPlayers/PlayersShootoutBits';
import { PLAYERS_COLORS, PLAYERS_FONTS } from '../../components/retroPlayers/playersTheme';

/** Every finished Shootout, newest first. */
export default function PlayersShootoutHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RetroTotlDailyPlayersStackParamList>>();
  const { params } = useRoute<RouteProp<RetroTotlDailyPlayersStackParamList, 'PlayersShootoutHistory'>>();
  const { client, sandbox, listKey } = useShootoutClient(params?.sandbox);
  const insets = useSafeAreaInsets();
  const now = React.useMemo(() => Date.now(), []);

  const { data, isRefetching, refetch } = useQuery({ queryKey: listKey, queryFn: () => client.listPlayersShootouts() });
  // Everything that's over: played to the end, declined, expired or cancelled.
  const finished = (data?.challenges ?? []).filter((c) => c.nextAction === 'done');
  const played = finished.filter((c) => c.status === 'finished');
  const won = played.filter((c) => c.result === 'won').length;

  return (
    <View style={{ flex: 1, backgroundColor: PLAYERS_COLORS.paper, paddingTop: insets.top }}>
      <ShootoutTopBar onBack={() => navigation.goBack()} title="Finished" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 10 }}
        refreshControl={<TotlRefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      >
        <TotlText style={{ fontFamily: PLAYERS_FONTS.body, fontSize: 15, color: PLAYERS_COLORS.muted, marginBottom: 4 }}>
          {played.length ? `Won ${won} of ${played.length}` : finished.length ? 'None played to the end yet.' : 'No finished Shootouts yet.'}
        </TotlText>
        {finished.map((c) => (
          <ShootoutRow
            key={c.id}
            challenge={c}
            now={now}
            onPress={() => navigation.navigate('PlayersShootoutMatch', { id: c.id, sandbox })}
          />
        ))}
      </ScrollView>
    </View>
  );
}
