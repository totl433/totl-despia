import React from 'react';

import { OpenedFromMenuContext } from '../navigation/openedFromMenu';
import LeaguesScreen from './LeaguesScreen';

/**
 * "See who's missing" from the Game Centre's "You're in" card: the Mini Leagues list, showing only
 * leagues where someone hasn't submitted for the gameweek. Opened over the Game Centre, so it gets
 * the header's back button.
 */
export default function MissingPicksScreen() {
  return (
    <OpenedFromMenuContext.Provider value>
      <LeaguesScreen />
    </OpenedFromMenuContext.Provider>
  );
}
