import { useEffect, useRef, useState } from 'react';

type Face = 'a' | 'b';

/**
 * True card flip that works on iOS Safari.
 * Animates to edge-on (90°), swaps the face, then finishes — never mounts both
 * sides at once (which is what made Safari composite loading dots over CORRECT).
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
  /** Bump to reset back to face A (e.g. fixture / flipKey). */
  resetKey: string | number;
}) {
  const [face, setFace] = useState<Face>('a');
  const [rotateY, setRotateY] = useState(0);
  const [animating, setAnimating] = useState(false);
  const runId = useRef(0);

  // Reset when a new card starts
  useEffect(() => {
    runId.current += 1;
    setFace('a');
    setRotateY(0);
    setAnimating(false);
  }, [resetKey]);

  useEffect(() => {
    if (!showB || face === 'b') return;

    const id = ++runId.current;
    const half = Math.max(100, Math.round(durationMs / 2));
    const timers: number[] = [];

    // Start flip toward edge-on
    requestAnimationFrame(() => {
      if (runId.current !== id) return;
      setAnimating(true);
      setRotateY(90);

      timers.push(
        window.setTimeout(() => {
          if (runId.current !== id) return;
          // Midpoint: swap face while edge-on, then open the other way
          setFace('b');
          setAnimating(false);
          setRotateY(-90);

          requestAnimationFrame(() => {
            if (runId.current !== id) return;
            requestAnimationFrame(() => {
              if (runId.current !== id) return;
              setAnimating(true);
              setRotateY(0);
              timers.push(
                window.setTimeout(() => {
                  if (runId.current !== id) return;
                  setAnimating(false);
                }, half)
              );
            });
          });
        }, half)
      );
    });

    return () => {
      runId.current += 1;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [showB, face, durationMs]);

  const halfMs = Math.max(100, Math.round(durationMs / 2));

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
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
          willChange: animating ? 'transform' : 'auto',
        }}
      >
        <div className="h-full w-full">{face === 'a' ? faceA : faceB}</div>
      </div>
    </div>
  );
}
