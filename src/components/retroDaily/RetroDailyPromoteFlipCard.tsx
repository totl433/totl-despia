import { useEffect, useState } from 'react';
import RetroDailyFixtureCard from './RetroDailyFixtureCard';
import RetroDailyLogoBack from './RetroDailyLogoBack';
import type { RetroFixture } from '../../lib/retroDaily/mockPuzzle';

/** Brief peek on the under-card face before revealing the fixture. */
export const RETRO_PROMOTE_FLIP_DELAY_MS = 450;
/** Transition duration into the fixture face (kept for parent unlock timing). */
export const RETRO_PROMOTE_FLIP_MS = 720;
/** Shorter hold when coming off the 3-2-1 face. */
export const RETRO_PROMOTE_FLIP_DELAY_FROM_COUNTDOWN_MS = 280;

/**
 * Holds on the logo back, then swaps to the fixture.
 * One face at a time — avoids Safari stacking both sides of a CSS 3D flip.
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
    <div className="relative h-full w-full overflow-hidden rounded-[28px]">
      {!showFixture ? (
        <div key={`back-${flipKey}`} className="h-full w-full">
          {backFace ?? <RetroDailyLogoBack seasonLabel={seasonLabel} />}
        </div>
      ) : (
        <div
          key={`fix-${flipKey}-${fixture.id}`}
          className="h-full w-full"
          style={{
            animation: `retroPromoteIn ${flipMs}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
          }}
        >
          <RetroDailyFixtureCard fixture={fixture} />
        </div>
      )}
      <style>{`
        @keyframes retroPromoteIn {
          from { opacity: 0; transform: scale(0.96) rotateY(18deg); }
          to { opacity: 1; transform: scale(1) rotateY(0deg); }
        }
      `}</style>
    </div>
  );
}
