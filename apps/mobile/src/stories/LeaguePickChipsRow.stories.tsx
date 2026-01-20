import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import LeaguePickChipsRow from '../components/league/LeaguePickChipsRow';

export default {
  title: 'League/LeaguePickChipsRow',
};

export function Basic() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeaguePickChipsRow
          members={[
            { id: '1', name: 'Thomas James Bird' },
            { id: '2', name: 'Jof' },
            { id: '3', name: 'SP' },
            { id: '4', name: 'Carl' },
          ]}
          picksByUserId={
            new Map([
              ['1', 'D'],
              ['2', 'D'],
              ['3', 'H'],
              ['4', 'D'],
            ])
          }
          outcome="D"
          currentUserId="2"
        />
      </View>
    </Screen>
  );
}

