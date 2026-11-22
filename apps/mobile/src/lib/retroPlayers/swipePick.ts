import { DRAW_THRESHOLD, SWIPE_THRESHOLD } from '../../components/retroDaily/RetroDailySwipeStack';
import type { PlayersClubOption } from './buildPuzzle';

/**
 * The Players' swipe-to-answer, shared by the daily game and the Shootout.
 * Left / down / right → options[0] / [1] / [2] — same thresholds as fixtures H/D/A.
 */
export function optionIndexFromSwipe(dx: number, dy: number, count: number): number | null {
  if (count === 0) return null;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const right = Math.min(2, count - 1);
  const mid = Math.min(1, count - 1);
  if (absX >= SWIPE_THRESHOLD && absX > absY * 1.15) return dx > 0 ? right : 0;
  if (dy >= DRAW_THRESHOLD && dy > absX * 1.05) return mid;
  if (absX >= absY) return dx >= 0 ? right : 0;
  return mid;
}

export function optionFromSwipe(dx: number, dy: number, options: PlayersClubOption[]): PlayersClubOption | null {
  const i = optionIndexFromSwipe(dx, dy, options.length);
  return i == null ? null : options[i] ?? null;
}
