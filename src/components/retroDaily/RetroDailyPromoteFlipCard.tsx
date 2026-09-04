import { useEffect, useState } from 'react';
import RetroDailyFixtureCard from './RetroDailyFixtureCard';
import RetroDailyLogoBack from './RetroDailyLogoBack';
import type { RetroFixture } from '../../lib/retroDaily/mockPuzzle';

/** Brief peek on the under-card face before revealing the fixture. */
export const RETRO_PROMOTE_FLIP_DELAY_MS = 450;
/** Card-flip duration into the fixture face. */
export const RETRO_PROMOTE_FLIP_MS = 720;
/** Shorter hold when coming off the 3-2-1 face. */
export const RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS = 280;

/**
 * Holds on the logo (or custom) back, then flips to the fixture face.
 * CSS 3D replica of the Expo promote flip.
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
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setFlipped(false);
    const id = window.setTimeout(() => setFlipped(true), holdMs);
    return () => window.clearTimeout(id);
  }, [flipKey, fixture.id, holdMs]);

  return (
    <div className="h-full w-full [perspective:1200px]">
      <div
        className="relative h-full w-full [transform-style:preserve-3d]"
        style={{
          transition: `transform ${flipMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">
          {backFace ?? <RetroDailyLogoBack seasonLabel={seasonLabel} />}
        </div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <RetroDailyFixtureCard fixture={fixture} />
        </div>
      </div>
    </div>
  );
}
