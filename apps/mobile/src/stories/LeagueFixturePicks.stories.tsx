import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import LeagueFixturePicks from '../components/league/LeagueFixturePicks';

export default {
  title: 'League/LeagueFixturePicks',
};

export function Basic() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeagueFixturePicks
          members={[
            { id: '1', name: 'Alice' },
            { id: '2', name: 'Bob' },
            { id: '3', name: 'Charlie' },
          ]}
          picksByUserId={new Map([
            ['1', 'H'],
            ['2', 'D'],
            ['3', 'A'],
          ])}
          outcome="H"
          currentUserId="2"
        />
      </View>
    </Screen>
  );
}

