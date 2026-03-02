import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import LeagueGwTable from '../components/league/LeagueGwTable';

export default {
  title: 'League/LeagueGwTable',
};

export function WithUnicorns() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeagueGwTable
          submittedCount={6}
          totalMembers={6}
          showUnicorns
          rows={[
            { user_id: '1', name: 'Alice', score: 8, unicorns: 2 },
            { user_id: '2', name: 'Bob', score: 8, unicorns: 1 },
            { user_id: '3', name: 'Charlie', score: 7, unicorns: 0 },
          ]}
        />
      </View>
    </Screen>
  );
}

export function NoUnicorns() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeagueGwTable
          submittedCount={1}
          totalMembers={2}
          showUnicorns={false}
          rows={[
            { user_id: '1', name: 'Alice', score: 6, unicorns: 0 },
            { user_id: '2', name: 'Bob', score: 5, unicorns: 0 },
          ]}
        />
      </View>
    </Screen>
  );
}

