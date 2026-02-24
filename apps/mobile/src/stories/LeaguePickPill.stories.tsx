import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import LeaguePickPill from '../components/league/LeaguePickPill';

export default {
  title: 'League/LeaguePickPill',
};

export function States() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16, gap: 10, flexDirection: 'row', flexWrap: 'wrap' }}>
        <LeaguePickPill value="H" tone="picked" />
        <LeaguePickPill value="D" tone="neutral" />
        <LeaguePickPill value="A" tone="correct" />
        <LeaguePickPill value="H" tone="wrong" />
        <LeaguePickPill value="D" tone="correctResult" />
      </View>
    </Screen>
  );
}

