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

/**
 * Get a soccer-themed photo URL for a league
 * Uses league ID as seed to ensure consistent photos per league
 * Uses Unsplash random images with sports collection IDs
 */
export function getGenericLeaguePhoto(leagueId: string, size: number = 128): string {
  const seed = hashString(leagueId);
  
  // Use Unsplash collection IDs for sports/soccer photos
  // These are curated collections on Unsplash
  const sportsCollections = [
    '9046579',  // Football/Soccer collection
    '9046578',  // Sports collection
    '9046577',  // Soccer players
    '9046576',  // Football stadiums
  ];
  
  const collectionId = sportsCollections[seed % sportsCollections.length];
  // Use Unsplash Source with collection parameter
  // Format: https://source.unsplash.com/collection/{collectionId}/{size}x{size}/
  return `https://source.unsplash.com/collection/${collectionId}/${size}x${size}/?sig=${seed}`;
}

/**
 * Get a generic photo URL using Picsum Photos (fallback)
 * More reliable but not soccer-themed
 */
export function getGenericLeaguePhotoPicsum(leagueId: string, size: number = 128): string {
  const seed = hashString(leagueId);
  return `https://picsum.photos/seed/${seed}/${size}/${size}`;
}

