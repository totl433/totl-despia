/**
 * Canonical league sorting logic.
 * This is the ONLY place where league sort order is defined.
 * 
 * Sort order:
 * Simple alphabetical by name (stable, predictable order)
 */

import type { League, LeagueWithUnread } from '../types/league';

/**
 * Sort leagues alphabetically by name.
 * Does NOT mutate the input array.
 */
export function sortLeagues<T extends { name: string; unreadCount?: number }>(
  leagues: T[]
): T[] {
  return [...leagues].sort((a, b) => {
    return a.name.localeCompare(b.name);
  });
}

/**
 * Sort leagues alphabetically by name (ignores unread counts for ordering).
 * Useful when leagues don't have unreadCount property but you have a separate map.
 * Unread counts are kept for display purposes but don't affect sort order.
 */
export function sortLeaguesWithUnreadMap<T extends { id: string; name: string }>(
  leagues: T[],
  unreadByLeague: Record<string, number> | undefined
): T[] {
  return [...leagues].sort((a, b) => {
    // Simple alphabetical sort by name (stable, predictable order)
    return a.name.localeCompare(b.name);
  });
}

/**
 * Convenience function to attach unread counts to leagues and sort.
 * Returns LeagueWithUnread[] sorted by the canonical order.
 */
export function sortLeaguesAttachingUnread(
  leagues: League[],
  unreadByLeague: Record<string, number> | undefined
): LeagueWithUnread[] {
  const withUnread: LeagueWithUnread[] = leagues.map(league => ({
    ...league,
    unreadCount: unreadByLeague?.[league.id] ?? 0,
  }));
  
  return sortLeagues(withUnread);
}

