import React from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';
import type { LeaguesStackParamList } from '../navigation/LeaguesNavigator';
import LeagueHeader from '../components/league/LeagueHeader';
import LeagueTabBar, { type LeagueTabKey } from '../components/league/LeagueTabBar';

export default function LeagueDetailScreen() {
  const route = useRoute<any>();
  const params = route.params as LeaguesStackParamList['LeagueDetail'];
  const t = useTokens();
  const navigation = useNavigation<any>();
  const [tab, setTab] = React.useState<LeagueTabKey>('chat');

  const { data: leagues } = useQuery({
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });

  const leagueFromList = React.useMemo(() => {
    const list = leagues?.leagues ?? [];
    return list.find((l: any) => String(l.id) === String(params.leagueId)) ?? null;
  }, [leagues?.leagues, params.leagueId]);

  const avatarUri =
    leagueFromList && typeof leagueFromList.avatar === 'string' && leagueFromList.avatar.startsWith('http')
      ? leagueFromList.avatar
      : null;

  const { data: home } = useQuery({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });
  const viewingGw = home?.viewingGw ?? null;

  return (
    <Screen fullBleed>
      <LeagueHeader
        title={String(params.name ?? '')}
        subtitle={viewingGw ? `Gameweek ${viewingGw}` : 'Gameweek'}
        avatarUri={avatarUri}
        onPressBack={() => navigation.goBack()}
        onPressMenu={() => {}}
      />

      <LeagueTabBar value={tab} onChange={setTab} />

      <View style={{ flex: 1, padding: t.space[4] }}>
        <TotlText variant="muted">
          {tab === 'chat'
            ? 'Chat tab (coming next).'
            : tab === 'gwTable'
              ? 'GW Table tab (building next).'
              : tab === 'predictions'
                ? 'Predictions tab (coming).'
                : 'Season tab (coming).'}
        </TotlText>
      </View>
    </Screen>
  );
}

