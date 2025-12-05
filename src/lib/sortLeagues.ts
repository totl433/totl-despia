/**
 * Canonical league sorting logic.
 * This is the ONLY place where league sort order is defined.
 * 
 * Sort order:
 * 1. Primary: unreadCount descending (leagues with unread messages first)
 * 2. Secondary: name ascending (alphabetical)
 */

import type { League, LeagueWithUnread } from '../types/league';

/**
 * Sort leagues by unread count (desc) then by name (asc).
 * Does NOT mutate the input array.
 */
export function sortLeagues<T extends { name: string; unreadCount?: number }>(
  leagues: T[]
): T[] {
  return [...leagues].sort((a, b) => {
    const unreadA = a.unreadCount ?? 0;
    const unreadB = b.unreadCount ?? 0;
    
    // Primary sort: unread count descending
    if (unreadB !== unreadA) {
      return unreadB - unreadA;
    }
    
    // Secondary sort: name ascending (alphabetical)
    return a.name.localeCompare(b.name);
  });
}

/**
 * Sort leagues using an external unread counts map.
 * Useful when leagues don't have unreadCount property but you have a separate map.
 */
export function sortLeaguesWithUnreadMap<T extends { id: string; name: string }>(
  leagues: T[],
  unreadByLeague: Record<string, number> | undefined
): T[] {
  return [...leagues].sort((a, b) => {
    const unreadA = unreadByLeague?.[a.id] ?? 0;
    const unreadB = unreadByLeague?.[b.id] ?? 0;
    
    // Primary sort: unread count descending
    if (unreadB !== unreadA) {
      return unreadB - unreadA;
    }
    
    // Secondary sort: name ascending (alphabetical)
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

