import type { Fixture } from '@totl/domain';

import { firstKickoffMs, type FeedItem } from './feed';

/**
 * The Game Centre feed is one timeline through the season: the gameweek at the top, then
 * each older gameweek below it as you scroll, like scrolling back through a chat.
 */

/** A gameweek's feed opens when its first line-ups can land, 75 minutes before kickoff. */
export const FEED_OPENS_BEFORE_KICKOFF_MS = 75 * 60_000;

export function gameweekOpensAtMs(fixtures: Fixture[]): number | null {
  const ko = firstKickoffMs(fixtures);
  return ko == null ? null : ko - FEED_OPENS_BEFORE_KICKOFF_MS;
}

export function isoOrNull(ms: number | null | undefined): string | null {
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Time order; cards sharing a moment keep the match's own order. */
export function compareFeedItems(a: FeedItem, b: FeedItem): number {
  return a.sortAt - b.sortAt || kindRank(a.kind) - kindRank(b.kind) || a.id.localeCompare(b.id);
}

function kindRank(kind: FeedItem['kind']): number {
  if (kind === 'half-time') return 10;
  if (kind === 'second-half') return 20;
  if (kind === 'goal' || kind === 'ruled-out') return 30;
  if (kind === 'rank') return 40;
  if (kind === 'message') return 50;
  return 35;
}

/**
 * The round-up is built pinned to the end of its gameweek. In the timeline, messages carry
 * on after it, so it goes just after the gameweek's last match card instead.
 */
export function placeRoundUp(roundUp: FeedItem[], matchCards: FeedItem[]): FeedItem[] {
  const times = matchCards.map((item) => item.sortAt).filter((ms) => Number.isFinite(ms) && ms < Number.MAX_SAFE_INTEGER / 2);
  if (!times.length) return roundUp;
  const after = Math.max(...times) + 1;
  return roundUp.map((item) => ({ ...item, sortAt: after }));
}

/** One older gameweek in the timeline, oldest item first. */
export type TimelinePage = { gw: number; items: FeedItem[] };

export type TimelineRow =
  | {
      type: 'item';
      key: string;
      item: FeedItem;
      /** Set for older gameweeks; null for the one on top. */ gw: number | null;
    }
  | { type: 'divider'; key: string; gw: number };

/**
 * The rows the feed list draws: the top gameweek as it is shown, then each older gameweek
 * newest first under a "Gameweek N" divider. Card ids repeat from week to week, so older
 * rows are keyed by their gameweek. A gameweek with nothing in it is left out.
 */
export function timelineRows(shownTop: FeedItem[], pages: TimelinePage[]): TimelineRow[] {
  const rows: TimelineRow[] = shownTop.map((item) => ({
    type: 'item',
    key: item.id,
    item,
    gw: null,
  }));
  pages.forEach((page) => {
    if (!page.items.length) return;
    rows.push({ type: 'divider', key: `gw-divider:${page.gw}`, gw: page.gw });
    for (let i = page.items.length - 1; i >= 0; i -= 1) {
      const item = page.items[i] as FeedItem;
      rows.push({
        type: 'item',
        key: `gw${page.gw}|${item.id}`,
        item,
        gw: page.gw,
      });
    }
  });
  return rows;
}
