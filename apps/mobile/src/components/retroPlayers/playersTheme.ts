import React from 'react';

/**
 * The Players visual tokens (Figma "The Players Quiz", 76:14395).
 * Only The Players uses these; Retro Totl Daily keeps its own styling.
 */
export const PLAYERS_COLORS = {
  /** Game background (slides in when play starts). */
  navy: '#0B1F3A',
  /** Intro + countdown background. */
  paper: '#FFFFFF',
  brand: '#1C8376',
  red: '#FF5E5C',
  ink: '#000000',
  inkSoft: '#0A0A0A',
  muted: '#7B7B7B',
  /** Light pip / tile border. */
  mist: '#DFEBE9',
  white: '#FFFFFF',
  goldStart: '#E4CE5B',
  goldEnd: '#FCC036',
} as const;

export const PLAYERS_FONTS = {
  display: 'TourneyCondensed-Bold',
  body: 'Gramatika-Regular',
  medium: 'Gramatika-Medium',
} as const;

/** Card in the design: 353 × 459.48 on a 393pt-wide screen (20pt side gutters). */
export const PLAYERS_CARD = {
  sideInset: 20,
  aspectRatio: 353 / 459.4786682128906,
  radius: 20,
  /** Pattern tile is 163.73pt; the design's grid starts at (-69.15, -15.91). */
  tileOffset: { x: -69.15234375, y: -15.9139404296875 },
} as const;

/** Card width ÷ 353 (the design width): faces scale their type and spacing by it. */
export const PlayersCardScale = React.createContext(1);

export function playersFinishedMessage(opts: {
  score: number;
  total: number;
  personalBest: boolean;
  practice: boolean;
}): [string, string] {
  if (opts.practice) return ['Practice round', "This one doesn't count."];
  if (opts.score === opts.total) return ['Perfect!', 'Every club nailed.'];
  if (opts.personalBest) return ['Congrats!', 'You beat your best score!'];
  if (opts.score === 0) return ['Tough one!', 'Think you can beat it tomorrow?'];
  return ['Solid effort!', 'Think you can beat it tomorrow?'];
}
