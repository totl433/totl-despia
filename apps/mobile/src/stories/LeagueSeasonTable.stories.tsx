import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import LeagueSeasonTable from '../components/league/LeagueSeasonTable';

export default {
  title: 'League/LeagueSeasonTable',
};

export function PointsView() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeagueSeasonTable
          loading={false}
          showForm={false}
          showUnicorns
          isLateStartingLeague={false}
          rows={[
            { user_id: '1', name: 'Alice', mltPts: 22, ocp: 74, unicorns: 9, wins: 6, draws: 4, form: ['W', 'D', 'L', 'W', 'W'] },
            { user_id: '2', name: 'Bob', mltPts: 19, ocp: 71, unicorns: 6, wins: 5, draws: 4, form: ['L', 'D', 'W', 'L', 'W'] },
            { user_id: '3', name: 'Charlie', mltPts: 14, ocp: 66, unicorns: 3, wins: 4, draws: 2, form: ['D', 'L', 'L', 'W', 'D'] },
          ]}
        />
      </View>
    </Screen>
  );
}

export function FormView() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <LeagueSeasonTable
          loading={false}
          showForm
          showUnicorns={false}
          isLateStartingLeague
          rows={[
            { user_id: '1', name: 'Alice', mltPts: 22, ocp: 74, unicorns: 0, wins: 6, draws: 4, form: ['W', 'D', 'L', 'W', 'W', 'L', 'W'] },
            { user_id: '2', name: 'Bob', mltPts: 19, ocp: 71, unicorns: 0, wins: 5, draws: 4, form: ['L', 'D', 'W', 'L', 'W'] },
          ]}
        />
      </View>
    </Screen>
  );
}

