import React from 'react';
import { AppState } from 'react-native';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';

import { pinnedCardCopy, type PinnedCardAction } from '../../features/gameCentre/cards';
import type { GameweekPin } from '../../lib/gameweekState';
import GameCentreCard, { GameCentreCardButton, GameCentreCardHeader } from './GameCentreCard';

/** Figma 297:32555; Labels/Tertiary #3C3C43 at 30% is baked into the file. */
const PIN = Asset.fromModule(require('../../../assets/icons/pin.svg')).uri;

/**
 * Pinned above the Game Centre feed: where you are in the gameweek (Figma 295:35045), from
 * picks due to moving on. The same card throughout; only the words and the button change.
 * It keeps its own clock, so the countdown never redraws the feed.
 */
function GameCentrePinnedCard({
  pin,
  scoreLabel,
  busy = false,
  onAction,
}: {
  pin: GameweekPin;
  /** Last gameweek's score ("6/10") for the coming-soon and ready cards. */
  scoreLabel: string | null;
  /** True while moving on, so the button can't be tapped twice. */
  busy?: boolean;
  onAction: (action: PinnedCardAction, pin: GameweekPin) => void;
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

  const copy = pinnedCardCopy(pin, nowMs, scoreLabel);
  const expired = pin.kind === 'predict' && pin.deadlineMs != null && nowMs >= pin.deadlineMs;
  return (
    <GameCentreCard
      header={
        <GameCentreCardHeader
          title={copy.title}
          subtitle={copy.subtitle}
          accessory={<SvgUri uri={PIN} width={10.6598} height={16} accessibilityLabel="Pinned" />}
        />
      }
      footer={
        copy.action && copy.actionLabel ? (
          <GameCentreCardButton
            label={busy ? 'Moving on…' : copy.actionLabel}
            disabled={busy || expired}
            onPress={() => onAction(copy.action as PinnedCardAction, pin)}
          />
        ) : null
      }
    />
  );
}

export default React.memo(
  GameCentrePinnedCard,
  (a, b) => a.busy === b.busy && a.scoreLabel === b.scoreLabel && a.onAction === b.onAction && JSON.stringify(a.pin) === JSON.stringify(b.pin)
);
