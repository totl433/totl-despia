import { useCallback, useEffect, useRef, useState } from 'react';
import RetroDailyLogoBack from './RetroDailyLogoBack';

export const SWIPE_THRESHOLD = 100;
export const DRAW_THRESHOLD = 120;

const USER_FLY_MS = 280;
const AUTO_FLY_MS = 480;

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
  /**
   * Increment to force a swipe-away animation (even when disabled),
   * e.g. after the reveal 3-2-1 when the streak continues.
   */
  flyAwayNonce?: number;
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
  flyAwayNonce = 0,
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
  /** When true, CSS transition is armed (after wind-up has painted). */
  const [transitionOn, setTransitionOn] = useState(false);
  const [flyMs, setFlyMs] = useState(USER_FLY_MS);

  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const animating = useRef(false);
  const flyTimer = useRef<number | null>(null);
  const onSwipeAwayRef = useRef(onSwipeAway);
  onSwipeAwayRef.current = onSwipeAway;
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;
  const lastFlyNonce = useRef(0);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const clearFlyTimer = () => {
    if (flyTimer.current != null) {
      window.clearTimeout(flyTimer.current);
      flyTimer.current = null;
    }
  };

  const resetMotion = useCallback(() => {
    setTx(0);
    setTy(0);
    setOpacity(1);
    setScale(1);
    setReveal(0);
    setTransitionOn(false);
    animating.current = false;
    setFlying(false);
    onDragRef.current?.(0, 0);
  }, []);

  // New planted face after parent advances — clear fly leftovers
  useEffect(() => {
    if (outgoing) return;
    resetMotion();
  }, [cardKey, outgoing, resetMotion]);

  useEffect(() => () => clearFlyTimer(), []);

  const finishTransition = useCallback(() => {
    clearFlyTimer();
    setOutgoing(null);
    setSettling(true);
    requestAnimationFrame(() => {
      resetMotion();
      setSettling(false);
    });
  }, [resetMotion]);

  const startFlyOff = useCallback(
    (dx: number, dy: number, opts?: { force?: boolean }) => {
      if ((!opts?.force && disabledRef.current) || outgoing || settling || animating.current) return;
      animating.current = true;
      clearFlyTimer();

      const leaving = childrenRef.current;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const w = typeof window !== 'undefined' ? window.innerWidth : 400;
      const h = typeof window !== 'undefined' ? window.innerHeight : 800;
      const duration = opts?.force ? AUTO_FLY_MS : USER_FLY_MS;

      // Exit vector — programmatic prefers a clear leftward flick
      let offX = 0;
      let offY = 0;
      if (opts?.force) {
        offX = -w * 1.25;
        offY = -h * 0.12;
      } else if (absX >= absY && absX > 8) {
        offX = dx >= 0 ? w * 1.12 : -w * 1.12;
        offY = dy * 0.35;
      } else if (absY > 8) {
        offY = dy >= 0 ? h * 1.02 : -h * 1.02;
        offX = dx * 0.35;
      } else {
        offY = h * 0.55;
      }

      // Wind-up pose (visible drag) so the flick reads as motion, not a pop
      const windX = opts?.force ? -52 : dx;
      const windY = opts?.force ? -28 : dy;

      setFlyMs(duration);
      setFlying(true);
      setTransitionOn(false);
      setOutgoing(leaving);
      setTx(windX);
      setTy(windY);
      setOpacity(1);
      setScale(1);
      setReveal(opts?.force ? 0.55 : Math.min(1, Math.max(absX, absY) / SWIPE_THRESHOLD));

      // Plant the next face under the flying card
      onSwipeAwayRef.current(opts?.force ? -140 : dx, opts?.force ? -80 : dy);

      // Paint wind-up with transition off, then arm transition and fly out
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitionOn(true);
          setTx(offX);
          setTy(offY);
          setOpacity(0);
          setScale(0.94);
          setReveal(1);
        });
      });

      flyTimer.current = window.setTimeout(finishTransition, duration + 48);
    },
    [finishTransition, outgoing, settling]
  );

  // Programmatic swipe (e.g. post 3-2-1 streak continue)
  useEffect(() => {
    if (!flyAwayNonce || flyAwayNonce === lastFlyNonce.current) return;
    lastFlyNonce.current = flyAwayNonce;
    startFlyOff(-140, -80, { force: true });
  }, [flyAwayNonce, startFlyOff]);

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
    setTransitionOn(true);
    setTx(0);
    setTy(0);
    setReveal(0);
    onDragRef.current?.(0, 0);
  };

  const busy = !!outgoing || settling;
  const rotate = `${(tx / Math.max(1, typeof window !== 'undefined' ? window.innerWidth : 400)) * 14}deg`;
  const defaultBack = <RetroDailyLogoBack seasonLabel={seasonLabel} />;
  const motionTransition = transitionOn
    ? `transform ${flyMs}ms cubic-bezier(0.2, 0.85, 0.25, 1), opacity ${Math.round(flyMs * 0.85)}ms ease`
    : 'none';

  return (
    <div
      ref={surfaceRef}
      className="relative mx-auto touch-none select-none"
      style={{
        // Width-first: parent cluster is shrink-wrapped (no height), so % height
        // collapses to 0. Cap at 420×560 like Expo.
        aspectRatio: '0.75',
        width: 'min(100%, 420px)',
        height: 'auto',
        maxHeight: '560px',
        maxWidth: 'min(100%, 420px)',
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
            transition: flying && transitionOn ? `opacity ${flyMs}ms ease, transform ${flyMs}ms ease` : undefined,
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
              ? motionTransition
              : tx === 0 && ty === 0 && transitionOn
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
            transition: motionTransition,
            willChange: 'transform, opacity',
          }}
        >
          {outgoing}
        </div>
      ) : null}
    </div>
  );
}
