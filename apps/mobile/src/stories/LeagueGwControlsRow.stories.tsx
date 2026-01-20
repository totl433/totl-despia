import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import LeagueGwControlsRow from '../components/league/LeagueGwControlsRow';

export default {
  title: 'League/LeagueGwControlsRow',
};

export function Basic() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeagueGwControlsRow
          availableGws={[1, 2, 3, 4, 5]}
          selectedGw={4}
          onChangeGw={() => {}}
          onPressRules={() => {}}
        />
      </View>
    </Screen>
  );
}

