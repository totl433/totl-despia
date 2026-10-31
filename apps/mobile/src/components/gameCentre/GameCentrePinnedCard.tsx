import React from 'react';
import { AppState } from 'react-native';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';

import { TotlText } from '@totl/ui';

import { lockedStartingSoon, pinDismissible, pinnedCardCopy, type PinnedCardAction } from '../../features/gameCentre/cards';
import type { GameweekPin } from '../../lib/gameweekState';
import GameCentreCard, { GameCentreCardButton, GameCentreCardHeader } from './GameCentreCard';

/** Figma 297:32555; Labels/Tertiary #3C3C43 at 30% is baked into the file. */
const PIN = Asset.fromModule(require('../../../assets/icons/pin.svg')).uri;
/** The pinned card sits tighter than feed cards: 20pt between header and buttons (Figma 320:33327). */
const PINNED_GAP = 20;

/**
 * Pinned above the Game Centre feed: where you are in the gameweek (Figma 295:35045), from
 * picks due to moving on. The same card throughout; only the words and the button change.
 * It keeps its own clock, so the countdown never redraws the feed.
 */
function GameCentrePinnedCard({
  pin,
  scoreLabel,
  leagues = null,
  busy = false,
  onAction,
  onDismiss,
}: {
  pin: GameweekPin;
  /** Your mini-leagues still waiting on someone this gameweek, for the "See who's missing" card. */
  leagues?: { leagueCount: number; missingCount: number } | null;
  /** Last gameweek's score ("6/10") for the coming-soon and ready cards. */
  scoreLabel: string | null;
  /** True while moving on, so the button can't be tapped twice. */
  busy?: boolean;
  onAction: (action: PinnedCardAction, pin: GameweekPin) => void;
  /** Shown as Dismiss (Figma 300:32561) on the states people may hide. */
  onDismiss?: (pin: GameweekPin) => void;
}) {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const needsSeconds = lockedStartingSoon(pin, nowMs);
  React.useEffect(() => {
    // Seconds while First teams is counting down; otherwise on the minute for "Closes in".
    let timer: ReturnType<typeof setTimeout>;
    const delay = () => (needsSeconds ? 1000 : 60_000 - (Date.now() % 60_000) + 50);
    const tick = () => {
      setNowMs(Date.now());
      timer = setTimeout(tick, delay());
    };
    timer = setTimeout(tick, delay());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNowMs(Date.now());
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [needsSeconds]);

  const copy = pinnedCardCopy(pin, nowMs, scoreLabel, leagues);
  const expired = pin.kind === 'predict' && pin.deadlineMs != null && nowMs >= pin.deadlineMs;
  const dismiss = !!onDismiss && pinDismissible(pin);
  return (
    <GameCentreCard
      gap={PINNED_GAP}
      header={
        <GameCentreCardHeader
          title={copy.title}
          subtitle={copy.subtitle}
          accessory={<SvgUri uri={PIN} width={10.6598} height={16} accessibilityLabel="Pinned" />}
        />
      }
      footer={
        (copy.action && copy.actionLabel) || dismiss ? (
          <GameCentreCardButton
            label={copy.action && copy.actionLabel ? (busy ? 'Moving on…' : copy.actionLabel) : null}
            disabled={busy || expired}
            onPress={() => onAction(copy.action as PinnedCardAction, pin)}
            secondary={dismiss ? { label: 'Dismiss', onPress: () => onDismiss?.(pin) } : null}
          />
        ) : null
      }
    >
      {copy.countdown ? (
        <>
          <TotlText style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: '#3C3C4399', marginBottom: 2 }}>
            {copy.countdownLabel ?? 'FIRST TEAMS IN'}
          </TotlText>
          <TotlText style={{ fontSize: 16, lineHeight: 20, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{copy.countdown}</TotlText>
        </>
      ) : null}
    </GameCentreCard>
  );
}

export default React.memo(
  GameCentrePinnedCard,
  (a, b) =>
    a.busy === b.busy &&
    a.scoreLabel === b.scoreLabel &&
    a.onAction === b.onAction &&
    a.onDismiss === b.onDismiss &&
    JSON.stringify(a.pin) === JSON.stringify(b.pin)
);
