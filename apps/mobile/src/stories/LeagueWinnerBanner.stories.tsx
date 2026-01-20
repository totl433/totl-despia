import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import LeagueWinnerBanner from '../components/league/LeagueWinnerBanner';

export default {
  title: 'League/LeagueWinnerBanner',
};

export function Winner() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeagueWinnerBanner winnerName="Tom" isDraw={false} />
      </View>
    </Screen>
  );
}

export function Draw() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeagueWinnerBanner winnerName="—" isDraw />
      </View>
    </Screen>
  );
}

