import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import LeaguePillButton from '../components/league/LeaguePillButton';

export default {
  title: 'League/LeaguePillButton',
};

export function Basic() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16, alignItems: 'flex-start' }}>
        <LeaguePillButton label="Rules" onPress={() => {}} />
      </View>
    </Screen>
  );
}

