import { Image } from 'react-native';

type AssetModule = number;

// Keep requires static so Metro bundles the assets.
const ASSET_BY_FILENAME: Record<string, AssetModule> = {
  // Default ML avatars (web uses these filenames in leagues.avatar)
  'ML-avatar-1.png': require('../../../../public/assets/league-avatars/ML-avatar-1.png'),
  'ML-avatar-2.png': require('../../../../public/assets/league-avatars/ML-avatar-2.png'),
  'ML-avatar-3.png': require('../../../../public/assets/league-avatars/ML-avatar-3.png'),
  'ML-avatar-4.png': require('../../../../public/assets/league-avatars/ML-avatar-4.png'),
  'ML-avatar-5.png': require('../../../../public/assets/league-avatars/ML-avatar-5.png'),

  // Legacy league avatars used by the web’s deterministic fallback list
  'soccer-ball-motion.jpg': require('../../../../public/assets/league-avatars/soccer-ball-motion.jpg'),
  'trophy.jpg': require('../../../../public/assets/league-avatars/trophy.jpg'),
  'embrace.jpg': require('../../../../public/assets/league-avatars/embrace.jpg'),
  'baseball-throw.jpg': require('../../../../public/assets/league-avatars/baseball-throw.jpg'),
  'smiling-faces.jpg': require('../../../../public/assets/league-avatars/smiling-faces.jpg'),
  'infinity.jpg': require('../../../../public/assets/league-avatars/infinity.jpg'),
  'abstract-leaf.jpg': require('../../../../public/assets/league-avatars/abstract-leaf.jpg'),
  'soccer-ball.jpg': require('../../../../public/assets/league-avatars/soccer-ball.jpg'),
};

/**
 * Resolve a `leagues.avatar` string to a RN Image URI.
 * - Supabase/public URLs pass through
 * - Known filenames resolve to bundled assets
 */
export function resolveLeagueAvatarUri(avatar: string | null | undefined): string | null {
  if (!avatar) return null;
  const v = String(avatar);
  if (v.startsWith('http')) return v;
  const mod = ASSET_BY_FILENAME[v];
  if (!mod) return null;
  return Image.resolveAssetSource(mod)?.uri ?? null;
}

/**
 * Deterministic default ML avatar filename (matches web behavior).
 */
export function getDefaultMlAvatarFilename(leagueId: string): 'ML-avatar-1.png' | 'ML-avatar-2.png' | 'ML-avatar-3.png' | 'ML-avatar-4.png' | 'ML-avatar-5.png' {
  const ids: Array<'ML-avatar-1.png' | 'ML-avatar-2.png' | 'ML-avatar-3.png' | 'ML-avatar-4.png' | 'ML-avatar-5.png'> = [
    'ML-avatar-1.png',
    'ML-avatar-2.png',
    'ML-avatar-3.png',
    'ML-avatar-4.png',
    'ML-avatar-5.png',
  ];
  let hash = 0;
  const s = String(leagueId ?? '');
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % ids.length;
  return ids[idx]!;
}

