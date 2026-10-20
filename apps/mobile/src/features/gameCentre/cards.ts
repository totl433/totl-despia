import type { ReactionSummary } from '../../hooks/useLeagueChatReactions';
import type { FeedItem, FeedKind } from '../matchCenter/feed';
import type { GameweekPin } from '../../lib/gameweekState';

/**
 * Game Centre cards come in three kinds (Figma 278:35430):
 * - public: match events everyone sees, with shared reactions;
 * - league: Mini League chat lines, with that league's reactions and replies;
 * - personal: your own results and places, with no social footer.
 */
export type GameCentreCardType = 'public' | 'league' | 'personal';

const PUBLIC_KINDS: ReadonlySet<FeedKind> = new Set([
  'opener',
  'lineup',
  'xi',
  'kickoff',
  'goal',
  'ruled-out',
  'half-time',
  'second-half',
  'full-time',
]);

export function gameCentreCardType(kind: FeedKind): GameCentreCardType {
  if (kind === 'message') return 'league';
  return PUBLIC_KINDS.has(kind) ? 'public' : 'personal';
}

/** The three reactions every footer starts with, in the design's order. */
export const GAME_CENTRE_DEFAULT_REACTS = ['😎', '🫠', '🔥'] as const;

export type GameCentreCardHeader = {
  title: string;
  subtitle: string | null;
  /** Any line the header doesn't carry, shown with the card's content. */
  body: string | null;
};

function same(a: string, b: string): boolean {
  const plain = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return plain(a) === plain(b);
}

function text(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

/**
 * Title, subtitle and leftover line for a card's new header. The event names the card
 * ("Half-time", "Goal!!"); its old headline becomes the subtitle; repeats are dropped.
 */
export function gameCentreCardHeader(item: Pick<FeedItem, 'kind' | 'eyebrow' | 'title' | 'body'>): GameCentreCardHeader {
  const eyebrow = text(item.eyebrow) ?? '';
  const title = text(item.title);
  const body = text(item.body);

  if (item.kind === 'goal') return { title: 'Goal!!', subtitle: body, body: null };
  if (item.kind === 'opener' || item.kind === 'waiting' || item.kind === 'full-time') {
    return { title: title ?? eyebrow, subtitle: body, body: null };
  }

  const subtitle = title && !same(title, eyebrow) ? title : null;
  const rest = body && !same(body, eyebrow) && !(subtitle && same(body, subtitle)) ? body : null;
  return { title: eyebrow || subtitle || '', subtitle: eyebrow ? subtitle : null, body: rest };
}

/**
 * Chips for a footer: the three defaults always (count hidden at 0), then any other
 * emoji people have added, in the order they arrived.
 */
export function gameCentreReactionChips(
  reactions: ReactionSummary[],
  defaults: readonly string[] = GAME_CENTRE_DEFAULT_REACTS
): ReactionSummary[] {
  const byEmoji = new Map(reactions.map((reaction) => [reaction.emoji, reaction]));
  const chips: ReactionSummary[] = defaults.map(
    (emoji) => byEmoji.get(emoji) ?? { emoji, count: 0, hasUserReacted: false }
  );
  for (const reaction of reactions) {
    if (!defaults.includes(reaction.emoji) && reaction.count > 0) chips.push(reaction);
  }
  return chips;
}

/** Rough rendered width of a reaction chip (Figma 250:41941): padding, the emoji, its count. */
export function reactionChipWidth(count: number): number {
  return 6 + 16 + (count > 0 ? 4 + 7 * String(count).length : 0) + 6;
}

/**
 * How many chips fit in two rows of `width`, leaving room for the + chip in the last row.
 * Chips past that are left off the card (they still count, and show in the picker).
 */
export function fitReactionChips(
  chips: ReactionSummary[],
  width: number,
  options: { gap?: number; rows?: number; moreWidth?: number } = {}
): number {
  const gap = options.gap ?? 12;
  const rows = options.rows ?? 2;
  const more = options.moreWidth ?? 28;
  if (width <= 0) return chips.length;
  let row = 1;
  let used = 0;
  for (let i = 0; i < chips.length; i++) {
    const chip = reactionChipWidth((chips[i] as ReactionSummary).count);
    const next = used === 0 ? chip : used + gap + chip;
    // On the last row, the + must still fit after this chip.
    const limit = row === rows ? width - gap - more : width;
    if (next <= limit) {
      used = next;
      continue;
    }
    if (row === rows) return i;
    row += 1;
    used = chip;
    if (row === rows && used > width - gap - more) return i;
  }
  return chips.length;
}

/**
 * Subtitle on the pinned predictions card: "Gameweek 7: Closes in 2h 30m".
 * Days and hours over a day, hours and minutes over an hour, then minutes.
 */
export function predictionsClosesLine(gw: number, deadlineMs: number | null, nowMs: number): string {
  if (deadlineMs == null) return `Gameweek ${gw}: Predictions open`;
  const left = deadlineMs - nowMs;
  if (left <= 0) return `Gameweek ${gw}: Deadline passed`;
  const minutes = Math.floor(left / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const span = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${Math.max(1, mins)}m`;
  return `Gameweek ${gw}: Closes in ${span}`;
}

/** "Sat 12:30" in the viewer's time zone, as the Predictions page shows deadlines. */
export function dayAndTime(ms: number): string {
  const d = new Date(ms);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} ${time}`;
}

export type PinnedCardAction = 'predict' | 'roundUp' | 'moveOn';

/**
 * States people may dismiss: the ones that only tell you something. Picks due and moving on
 * stay, since they are what moves the week along (and moving on is the review step).
 */
export function pinDismissible(pin: GameweekPin): boolean {
  return pin.kind === 'picked' || pin.kind === 'missed' || pin.kind === 'locked' || pin.kind === 'comingSoon';
}

/** A dismissal lasts for that gameweek and state, so the next state still shows. */
export function pinDismissKey(userId: string, pin: GameweekPin): string {
  return `game-centre-pin-dismissed:${userId}:gw${pin.gw}:${pin.kind}`;
}

/**
 * Title, subtitle and button for the Game Centre's pinned card in each gameweek state
 * (Figma 295:35045; the same layout throughout, only the words and the button change).
 */
export function pinnedCardCopy(
  pin: GameweekPin,
  nowMs: number,
  scoreLabel: string | null
): { title: string; subtitle: string; action: PinnedCardAction | null; actionLabel: string | null } {
  const lastWeek = (gw: number) => (scoreLabel ? `Gameweek ${gw}: ${scoreLabel}` : `Gameweek ${gw} is complete`);
  switch (pin.kind) {
    case 'predict':
      return { title: "Don't miss the deadline!", subtitle: predictionsClosesLine(pin.gw, pin.deadlineMs, nowMs), action: 'predict', actionLabel: 'Submit your predictions' };
    case 'picked':
      return {
        title: "You're in",
        subtitle: pin.deadlineMs != null ? `Gameweek ${pin.gw}: Edit until ${dayAndTime(pin.deadlineMs)}` : `Gameweek ${pin.gw}: Predictions in`,
        action: 'predict',
        actionLabel: 'Edit predictions',
      };
    case 'missed':
      return {
        title: 'Deadline passed',
        subtitle: pin.kickoffMs != null ? `Gameweek ${pin.gw} kicks off at ${dayAndTime(pin.kickoffMs)}` : `Gameweek ${pin.gw} kicks off soon`,
        action: null,
        actionLabel: null,
      };
    case 'locked':
      return {
        title: "You're in",
        subtitle: pin.kickoffMs != null ? `Gameweek ${pin.gw}: Kicks off at ${dayAndTime(pin.kickoffMs)}` : `Gameweek ${pin.gw}: Kicks off soon`,
        action: null,
        actionLabel: null,
      };
    case 'comingSoon':
      return { title: `Gameweek ${pin.nextGw} coming soon`, subtitle: lastWeek(pin.gw), action: 'roundUp', actionLabel: 'View the round-up' };
    case 'ready':
      return { title: `Gameweek ${pin.nextGw} is here`, subtitle: lastWeek(pin.gw), action: 'moveOn', actionLabel: `Move to Gameweek ${pin.nextGw}` };
  }
}
