import React from 'react';
import { View } from 'react-native';
import RetroDailyFlip from './RetroDailyFlip';
import RetroDailyFixtureCard from './RetroDailyFixtureCard';
import RetroDailyLogoBack from './RetroDailyLogoBack';
import type { RetroFixture } from '../../lib/retroDaily/mockPuzzle';

/** Brief peek on the under-card face before revealing the fixture. */
export const RETRO_PROMOTE_FLIP_DELAY_MS = 280;
/** Card-flip duration into the fixture face. */
export const RETRO_PROMOTE_FLIP_MS = 420;
/** Shorter hold when coming off the 3-2-1 face. */
export const RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS = 160;

/**
 * Holds on the logo (or custom) back, then flips to the fixture face.
 */
export default function RetroDailyPromoteFlipCard({
  fixture,
  flipKey,
  backFace,
  holdMs = RETRO_PROMOTE_FLIP_DELAY_MS,
  flipMs = RETRO_PROMOTE_FLIP_MS,
  instant = false,
}: {
  fixture: RetroFixture;
  flipKey: number;
  backFace?: React.ReactNode;
  holdMs?: number;
  flipMs?: number;
  instant?: boolean;
}) {
  const [show, setShow] = React.useState(instant);

  React.useEffect(() => {
    if (instant) {
      setShow(true);
      return;
    }
    setShow(false);
    const id = setTimeout(() => setShow(true), holdMs);
    return () => clearTimeout(id);
  }, [flipKey, fixture.id, holdMs, instant]);

  if (instant) {
    return (
      <View style={{ flex: 1 }}>
        <RetroDailyFixtureCard fixture={fixture} />
      </View>
    );
  }

  return (
    <RetroDailyFlip
      resetKey={`${flipKey}-${fixture.id}`}
      showB={show}
      durationMs={flipMs}
      faceA={backFace ?? <RetroDailyLogoBack />}
      faceB={<RetroDailyFixtureCard fixture={fixture} />}
    />
  );
}
