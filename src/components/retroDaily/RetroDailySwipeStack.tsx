import { useCallback, useEffect, useRef, useState } from 'react';
import RetroDailyLogoBack from './RetroDailyLogoBack';

export const SWIPE_THRESHOLD = 100;
export const DRAW_THRESHOLD = 120;

type Props = {
  cardKey: string;
  children: React.ReactNode;
  showNext?: boolean;
  showQueued?: boolean;
  /** Under-card peek face (defaults to logo back). */
  nextFace?: React.ReactNode;
  /** Third-card peek face (defaults to logo back). */
  queuedFace?: React.ReactNode;
  seasonLabel: string;
  disabled?: boolean;
  /** Live drag offsets for button highlight in the parent. */
  onDrag?: (dx: number, dy: number) => void;
  /** Called at swipe commit — parent should advance to the next face immediately. */
  onSwipeAway: (dx: number, dy: number) => void;
};

/**
 * Predictions-style stack: peeks under, outgoing flies on top, new face planted underneath.
 * CSS replica of Expo RetroDailySwipeStack.
 */
export default function RetroDailySwipeStack({
  cardKey,
  children,
  showNext = true,
  showQueued = true,
  nextFace,
  queuedFace,
  seasonLabel,
  disabled = false,
  onDrag,
  onSwipeAway,
}: Props) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const childrenRef = useRef(children);
  childrenRef.current = children;

  const [outgoing, setOutgoing] = useState<React.ReactNode | null>(null);
  const [settling, setSettling] = useState(false);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [scale, setScale] = useState(1);
  const [reveal, setReveal] = useState(0);
  const [flying, setFlying] = useState(false);

  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const animating = useRef(false);
  const onSwipeAwayRef = useRef(onSwipeAway);
  onSwipeAwayRef.current = onSwipeAway;
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;

  const resetMotion = useCallback(() => {
    setTx(0);
    setTy(0);
    setOpacity(1);
    setScale(1);
    setReveal(0);
    animating.current = false;
    setFlying(false);
    onDragRef.current?.(0, 0);
  }, []);

  // New planted face after parent advances — clear fly leftovers
  useEffect(() => {
    if (outgoing) return;
    resetMotion();
  }, [cardKey, outgoing, resetMotion]);

  const finishTransition = useCallback(() => {
    setOutgoing(null);
    setSettling(true);
    requestAnimationFrame(() => {
      resetMotion();
      setSettling(false);
    });
  }, [resetMotion]);

  const startFlyOff = useCallback(
    (dx: number, dy: number) => {
      if (disabled || outgoing || settling || animating.current) return;
      animating.current = true;
      setFlying(true);

      const leaving = childrenRef.current;
      setOutgoing(leaving);
      onSwipeAwayRef.current(dx, dy);

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const w = typeof window !== 'undefined' ? window.innerWidth : 400;
      const h = typeof window !== 'undefined' ? window.innerHeight : 800;
      let offX = 0;
      let offY = 0;
      if (absX >= absY && absX > 8) {
        offX = dx >= 0 ? w * 1.12 : -w * 1.12;
      } else if (absY > 8) {
        offY = dy >= 0 ? h * 1.02 : -h * 1.02;
      } else {
        offY = h * 0.55;
      }

      // Kick CSS transition on next frame from current drag position
      requestAnimationFrame(() => {
        setTx((cur) => cur + offX);
        setTy((cur) => cur + offY);
        setOpacity(0);
        setScale(0.96);
        setReveal(1);
      });
      window.setTimeout(finishTransition, 260);
    },
    [disabled, finishTransition, outgoing, settling]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || outgoing || settling || animating.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current || disabled || outgoing || settling || animating.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    setTx(dx);
    setTy(dy);
    setReveal(Math.min(1, Math.max(Math.abs(dx), Math.abs(dy)) / SWIPE_THRESHOLD));
    onDragRef.current?.(dx, dy);
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    pointerStart.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (disabled || outgoing || settling || animating.current) {
      resetMotion();
      return;
    }

    if (Math.abs(dx) > 60 || Math.abs(dy) > 60) {
      startFlyOff(dx, dy);
      return;
    }
    // Spring-ish snap back
    setTx(0);
    setTy(0);
    setReveal(0);
    onDragRef.current?.(0, 0);
  };

  const busy = !!outgoing || settling;
  const rotate = `${(tx / Math.max(1, typeof window !== 'undefined' ? window.innerWidth : 400)) * 14}deg`;
  const defaultBack = <RetroDailyLogoBack seasonLabel={seasonLabel} />;

  return (
    <div
      ref={surfaceRef}
      className="relative mx-auto w-full max-w-[420px] touch-none select-none"
      style={{
        aspectRatio: '0.75',
        cursor: disabled ? 'default' : 'grab',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={(e) => {
        pointerStart.current = null;
        if (!flying) resetMotion();
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
    >
      {showQueued ? (
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            opacity: 0.72,
            transform: 'translateY(20px) scale(0.935)',
          }}
        >
          {queuedFace ?? defaultBack}
        </div>
      ) : null}

      {showNext ? (
        <div
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            opacity: 0.84 + 0.16 * reveal,
            transform: `translateY(${10 - 10 * reveal}px) scale(${0.968 + 0.032 * reveal})`,
            transition: flying ? 'opacity 0.24s ease, transform 0.24s ease' : undefined,
          }}
        >
          {nextFace ?? defaultBack}
        </div>
      ) : null}

      {busy ? (
        <div key={`planted-${cardKey}`} className="absolute inset-0 z-[3]">
          {children}
        </div>
      ) : (
        <div
          key={`live-${cardKey}`}
          className="absolute inset-0 z-[3]"
          style={{
            opacity,
            transform: `translate(${tx}px, ${ty}px) rotate(${rotate}) scale(${scale})`,
            transition: flying
              ? 'transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.22s ease'
              : tx === 0 && ty === 0
                ? 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease'
                : undefined,
          }}
        >
          {children}
        </div>
      )}

      {outgoing ? (
        <div
          className="pointer-events-none absolute inset-0 z-[4]"
          style={{
            opacity,
            transform: `translate(${tx}px, ${ty}px) rotate(${rotate}) scale(${scale})`,
            transition: 'transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.22s ease',
          }}
        >
          {outgoing}
        </div>
      ) : null}
    </div>
  );
}
