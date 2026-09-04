import { useEffect, useState } from 'react';

/**
 * True card flip for iOS Safari.
 * Rotates to edge-on → swaps content → opens the other way.
 * Only one face is mounted at a time (avoids Safari stacking both sides).
 */
export default function RetroDailyFlip({
  showB,
  durationMs,
  faceA,
  faceB,
  resetKey,
}: {
  showB: boolean;
  durationMs: number;
  faceA: React.ReactNode;
  faceB: React.ReactNode;
  resetKey: string | number;
}) {
  const [face, setFace] = useState<'a' | 'b'>('a');
  const [rotateY, setRotateY] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setFace('a');
    setRotateY(0);
    setAnimating(false);
    setSettled(false);

    if (!showB) return;

    const half = Math.max(90, Math.round(durationMs / 2));
    const timers: number[] = [];
    let cancelled = false;

    // Kick flip after first paint so transition runs from 0 → 90
    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setAnimating(true);
        setRotateY(90);
      }, 30)
    );

    // Midpoint: swap face while edge-on, then open from -90 → 0
    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setFace('b');
        setAnimating(false);
        setRotateY(-90);
        requestAnimationFrame(() => {
          if (cancelled) return;
          requestAnimationFrame(() => {
            if (cancelled) return;
            setAnimating(true);
            setRotateY(0);
          });
        });
      }, 30 + half)
    );

    // Settle: drop transform so we never leave a half-rotated card
    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setAnimating(false);
        setRotateY(0);
        setSettled(true);
      }, 30 + half * 2 + 40)
    );

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [resetKey, showB, durationMs]);

  const halfMs = Math.max(90, Math.round(durationMs / 2));

  if (settled || (showB && face === 'b' && rotateY === 0 && !animating)) {
    return <div className="h-full w-full overflow-hidden rounded-[28px]">{faceB}</div>;
  }

  return (
    <div
      className="h-full w-full overflow-hidden rounded-[28px]"
      style={{ perspective: '1200px', WebkitPerspective: '1200px' }}
    >
      <div
        className="h-full w-full"
        style={{
          transform: `rotateY(${rotateY}deg)`,
          transition: animating ? `transform ${halfMs}ms cubic-bezier(0.22, 1, 0.36, 1)` : 'none',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          willChange: animating ? 'transform' : 'auto',
        }}
      >
        <div className="h-full w-full">{face === 'a' ? faceA : faceB}</div>
      </div>
    </div>
  );
}
