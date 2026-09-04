import { useEffect, useState } from 'react';

/** Stay shy of 90° so the card never goes fully edge-on (iPhone Safari vanish). */
const EDGE_DEG = 72;

/**
 * Midpoint-swap flip for iOS Safari.
 * Rotates toward edge (not fully), swaps the single mounted face, then opens.
 * Avoids dual-face stacking bugs and the 90° disappear flash.
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

    const half = Math.max(100, Math.round(durationMs / 2));
    const timers: number[] = [];
    let cancelled = false;

    // Kick flip after first paint so transition runs from 0 → EDGE
    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setAnimating(true);
        setRotateY(EDGE_DEG);
      }, 30)
    );

    // Midpoint: swap while still slightly visible, then open from -EDGE → 0
    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setFace('b');
        setAnimating(false);
        setRotateY(-EDGE_DEG);
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

  const halfMs = Math.max(100, Math.round(durationMs / 2));

  // Slight squeeze so the card keeps perceived width near the fold
  const fold = Math.min(1, Math.abs(rotateY) / EDGE_DEG);
  const scaleX = 1 - fold * 0.12;

  if (settled || (showB && face === 'b' && rotateY === 0 && !animating)) {
    return <div className="h-full w-full overflow-hidden rounded-[28px]">{faceB}</div>;
  }

  return (
    <div
      className="h-full w-full rounded-[28px]"
      style={{
        perspective: '1400px',
        WebkitPerspective: '1400px',
        // overflow:hidden clips 3D mid-flip on iOS — clip faces themselves instead
      }}
    >
      <div
        className="h-full w-full overflow-hidden rounded-[28px]"
        style={{
          transform: `rotateY(${rotateY}deg) scaleX(${scaleX})`,
          transition: animating
            ? `transform ${halfMs}ms cubic-bezier(0.25, 0.8, 0.25, 1)`
            : 'none',
          transformOrigin: 'center center',
          WebkitTransformOrigin: 'center center',
          willChange: animating ? 'transform' : 'auto',
          // Do NOT use backface-visibility:hidden — it blanks the card early on Safari
        }}
      >
        <div className="h-full w-full">{face === 'a' ? faceA : faceB}</div>
      </div>
    </div>
  );
}
