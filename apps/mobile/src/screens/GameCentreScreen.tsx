import React from 'react';

import GameCentreDrawer from '../components/gameCentre/GameCentreDrawer';
import GameCentreMenu from '../components/gameCentre/GameCentreMenu';
import MatchCenterScreen from './MatchCenterScreen';

/** The app's home: the Game Centre feed, with the side menu behind it. */
export default function GameCentreScreen() {
  return (
    <GameCentreDrawer menu={(menu) => <GameCentreMenu onNavigate={(go) => menu.close(go)} />}>
      <MatchCenterScreen />
    </GameCentreDrawer>
  );
}
