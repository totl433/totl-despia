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

// Default ML avatars (ML-avatar-1.png through ML-avatar-5.png)
export const DEFAULT_ML_AVATARS = [
  'ML-avatar-1.png',
  'ML-avatar-2.png',
  'ML-avatar-3.png',
  'ML-avatar-4.png',
  'ML-avatar-5.png',
] as const;

export type DefaultMlAvatar = typeof DEFAULT_ML_AVATARS[number];

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

/**
 * Get default ML avatar based on league ID (deterministic)
 * Returns one of ML-avatar-1.png through ML-avatar-5.png
 */
export function getDefaultMlAvatar(leagueId: string): DefaultMlAvatar {
  const hash = hashString(leagueId);
  const index = hash % DEFAULT_ML_AVATARS.length;
  return DEFAULT_ML_AVATARS[index];
}

/**
 * Check if a string is a Supabase Storage URL
 */
function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('supabase.co/storage/v1/object/public');
}

/**
 * Check if a string is a default ML avatar filename
 */
function isDefaultMlAvatar(filename: string | null | undefined): boolean {
  if (!filename) return false;
  return DEFAULT_ML_AVATARS.includes(filename as DefaultMlAvatar);
}

/**
 * Get the avatar URL for a league
 * Priority:
 * 1. Custom uploaded avatar (Supabase Storage URL)
 * 2. Default ML avatar filename in league.avatar field
 * 3. Deterministic default ML avatar based on league ID
 */
export function getLeagueAvatarUrl(league: { id: string; avatar?: string | null }): string {
  // Priority 1: Custom uploaded avatar (Supabase Storage URL)
  if (league.avatar && isSupabaseStorageUrl(league.avatar)) {
    return league.avatar;
  }
  
  // Priority 2: Default ML avatar filename in league.avatar field
  if (league.avatar && isDefaultMlAvatar(league.avatar)) {
    return `/assets/league-avatars/${league.avatar}`;
  }
  
  // Priority 3: Deterministic default ML avatar based on league ID
  const defaultAvatar = getDefaultMlAvatar(league.id);
  return `/assets/league-avatars/${defaultAvatar}`;
}

