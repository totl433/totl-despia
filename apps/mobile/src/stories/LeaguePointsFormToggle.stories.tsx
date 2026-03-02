import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import LeaguePointsFormToggle from '../components/league/LeaguePointsFormToggle';

export default {
  title: 'League/LeaguePointsFormToggle',
};

export function Points() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeaguePointsFormToggle showForm={false} onToggle={() => {}} />
      </View>
    </Screen>
  );
}

export function Form() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeaguePointsFormToggle showForm onToggle={() => {}} />
      </View>
    </Screen>
  );
}

