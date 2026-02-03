import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import LeagueSubmissionStatusCard from '../components/league/LeagueSubmissionStatusCard';

export default {
  title: 'League/LeagueSubmissionStatusCard',
};

export function Full() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeagueSubmissionStatusCard
          picksGw={22}
          fixtures={[{ kickoff_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() }]}
          members={[
            { id: '1', name: 'Alice' },
            { id: '2', name: 'Bob' },
            { id: '3', name: 'Charlie' },
          ]}
          submittedUserIds={['1']}
          variant="full"
        />
      </View>
    </Screen>
  );
}

export function Compact() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeagueSubmissionStatusCard
          picksGw={22}
          fixtures={[{ kickoff_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() }]}
          members={[
            { id: '1', name: 'Alice' },
            { id: '2', name: 'Bob' },
            { id: '3', name: 'Charlie' },
          ]}
          submittedUserIds={['1']}
          variant="compact"
        />
      </View>
    </Screen>
  );
}

