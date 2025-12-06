/**
 * Canonical League type used across the application.
 * This is the single source of truth for league data structures.
 */

/**
 * Core league data from database
 * Note: start_gw may not exist in all database schemas - it's optional
 */
export type League = {
  id: string;
  name: string;
  code: string;
  avatar?: string | null;
  created_at?: string | null;
  start_gw?: number | null; // Optional - may not exist in all deployments
};

/**
 * League with computed display data (unread counts, etc.)
 * Used for rendering league lists with sorting
 */
export type LeagueWithUnread = League & {
  unreadCount: number;
};

/**
 * League member basic info
 */
export type LeagueMember = {
  id: string;
  name: string;
};

/**
 * Extended league data for display purposes (e.g., MiniLeagueCard)
 */
export type LeagueData = {
  id: string;
  members: LeagueMember[];
  userPosition: number | null;
  positionChange: 'up' | 'down' | 'same' | null;
  submittedMembers?: Set<string> | string[];
  sortedMemberIds?: string[];
  latestGwWinners?: Set<string> | string[];
  latestRelevantGw?: number | null;
  webUserIds?: Set<string> | string[];
};

/**
 * League row for Tables page display
 */
export type LeagueRow = {
  id: string;
  name: string;
  code: string;
  memberCount?: number;
  submittedCount?: number;
  avatar?: string | null;
  created_at?: string | null;
  start_gw?: number | null;
};

/**
 * Submission status for a league
 */
export type LeagueSubmissionStatus = {
  allSubmitted: boolean;
  submittedCount: number;
  totalCount: number;
};

