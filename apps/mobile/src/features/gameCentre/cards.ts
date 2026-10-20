import type { ReactionSummary } from '../../hooks/useLeagueChatReactions';
import type { FeedItem, FeedKind } from '../matchCenter/feed';

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
