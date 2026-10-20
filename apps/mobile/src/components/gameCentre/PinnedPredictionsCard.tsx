import React from 'react';
import { AppState } from 'react-native';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';

import { predictionsClosesLine } from '../../features/gameCentre/cards';
import GameCentreCard, { GameCentreCardButton, GameCentreCardHeader } from './GameCentreCard';

/** Figma 297:32555; Labels/Tertiary #3C3C43 at 30% is baked into the file. */
const PIN = Asset.fromModule(require('../../../assets/icons/pin.svg')).uri;

/**
 * Pinned above the Game Centre feed until this gameweek's predictions are in (Figma 295:35045).
 * It keeps its own clock, so the countdown never redraws the feed.
 */
function PinnedPredictionsCard({
  gw,
  deadlineMs,
  onPress,
}: {
  gw: number;
  deadlineMs: number | null;
  onPress: () => void;
}) {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    // Tick on the minute boundary so "Closes in" changes when the clock does.
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNowMs(Date.now());
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNowMs(Date.now());
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  const expired = deadlineMs != null && nowMs >= deadlineMs;
  return (
    <GameCentreCard
      header={
        <GameCentreCardHeader
          title="Don't miss the deadline!"
          subtitle={predictionsClosesLine(gw, deadlineMs, nowMs)}
          accessory={<SvgUri uri={PIN} width={10.6598} height={16} accessibilityLabel="Pinned" />}
        />
      }
      footer={<GameCentreCardButton label="Submit your predictions" onPress={onPress} disabled={expired} />}
    />
  );
}

export default React.memo(PinnedPredictionsCard);
