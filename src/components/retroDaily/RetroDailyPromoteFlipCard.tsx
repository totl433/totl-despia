import { useEffect, useState } from 'react';
import RetroDailyFixtureCard from './RetroDailyFixtureCard';
import RetroDailyLogoBack from './RetroDailyLogoBack';
import RetroDailyFlip from './RetroDailyFlip';
import type { RetroFixture } from '../../lib/retroDaily/mockPuzzle';

/** Brief peek on the under-card face before revealing the fixture. */
export const RETRO_PROMOTE_FLIP_DELAY_MS = 280;
/** Card-flip duration into the fixture face. */
export const RETRO_PROMOTE_FLIP_MS = 420;
/** Shorter hold when coming off the 3-2-1 face. */
export const RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS = 160;

/**
 * Holds on the logo back, then flips to the fixture (Safari-safe midpoint swap).
 */
export default function RetroDailyPromoteFlipCard({
  fixture,
  flipKey,
  seasonLabel,
  backFace,
  holdMs = RETRO_PROMOTE_FLIP_DELAY_MS,
  flipMs = RETRO_PROMOTE_FLIP_MS,
}: {
  fixture: RetroFixture;
  flipKey: number;
  seasonLabel: string;
  backFace?: React.ReactNode;
  holdMs?: number;
  flipMs?: number;
}) {
  const [showFixture, setShowFixture] = useState(false);

  useEffect(() => {
    setShowFixture(false);
    const id = window.setTimeout(() => setShowFixture(true), holdMs);
    return () => window.clearTimeout(id);
  }, [flipKey, fixture.id, holdMs]);

  return (
    <RetroDailyFlip
      resetKey={`${flipKey}-${fixture.id}`}
      showB={showFixture}
      durationMs={flipMs}
      faceA={backFace ?? <RetroDailyLogoBack seasonLabel={seasonLabel} />}
      faceB={<RetroDailyFixtureCard fixture={fixture} />}
    />
  );
}
