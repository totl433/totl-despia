// List of available league avatar filenames
// These should match the files in public/assets/league-avatars/
export const LEAGUE_AVATARS = [
  'soccer-ball-motion.jpg',
  'trophy.jpg',
  'embrace.jpg',
  'baseball-throw.jpg',
  'smiling-faces.jpg',
  'infinity.jpg',
  'abstract-leaf.jpg',
  'soccer-ball.jpg',
] as const;

export type LeagueAvatar = typeof LEAGUE_AVATARS[number];

/**
 * Simple hash function to convert a string to a number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get a deterministic avatar for a league based on its ID
 * This ensures the same league always gets the same avatar
 */
export function getDeterministicLeagueAvatar(leagueId: string): LeagueAvatar {
  const hash = hashString(leagueId);
  const index = hash % LEAGUE_AVATARS.length;
  return LEAGUE_AVATARS[index];
}

/**
 * Get a random league avatar filename
 * @deprecated Use getDeterministicLeagueAvatar instead for consistency
 */
export function getRandomLeagueAvatar(): LeagueAvatar {
  const randomIndex = Math.floor(Math.random() * LEAGUE_AVATARS.length);
  return LEAGUE_AVATARS[randomIndex];
}

/**
 * Get the avatar path for a given avatar filename
 */
export function getLeagueAvatarPath(avatar: string | null | undefined): string {
  if (!avatar || !LEAGUE_AVATARS.includes(avatar as LeagueAvatar)) {
    // Return default avatar if invalid or missing
    return '/assets/league-avatars/soccer-ball.jpg';
  }
  return `/assets/league-avatars/${avatar}`;
}

