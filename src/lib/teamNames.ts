// src/lib/teamNames.ts
// Utilities for resolving medium team names and badge asset paths.
// This file intentionally exports pure helpers — no React components here.

/** Canonical key for each club (used for badge filenames). */
type TeamKey =
  | 'arsenal'
  | 'aston-villa'
  | 'bournemouth'
  | 'brentford'
  | 'brighton'
  | 'chelsea'
  | 'crystal-palace'
  | 'everton'
  | 'fulham'
  | 'ipswich'
  | 'leeds'
  | 'leicester'
  | 'liverpool'
  | 'man-city'
  | 'man-united'
  | 'newcastle'
  | 'nottingham-forest'
  | 'southampton'
  | 'spurs'
  | 'west-ham'
  | 'wolves'
  | 'sunderland'
  | 'burnley';

/** Helper to normalise incoming names (codes/aliases). */
function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+fc\s*$/i, '') // Remove "FC" at end first
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Registry of clubs with their medium display names, badge slugs, and aliases. */
const CLUBS: Record<
  TeamKey,
  { medium: string; slug: TeamKey; aliases: string[] }
> = {
  'arsenal': {
    medium: 'Arsenal',
    slug: 'arsenal',
    aliases: ['arsenal', 'arsenal fc', 'ars', 'the arsenal'],
  },
  'aston-villa': {
    medium: 'Villa',
    slug: 'aston-villa',
    aliases: ['aston villa', 'aston villa fc', 'villa', 'avl'],
  },
  'bournemouth': {
    medium: "B'mouth",
    slug: 'bournemouth',
    aliases: ['bournemouth', 'afc bournemouth', 'bournemouth fc', 'bou'],
  },
  'brentford': {
    medium: 'Brentford',
    slug: 'brentford',
    aliases: ['brentford', 'brentford fc', 'bre'],
  },
  'brighton': {
    medium: 'Brighton',
    slug: 'brighton',
    aliases: [
      'brighton',
      'brighton and hove albion',
      'brighton & hove albion',
      'brighton and hove albion fc',
      'brighton & hove albion fc',
      'brighton hove',
      'bha',
    ],
  },
  'chelsea': {
    medium: 'Chelsea',
    slug: 'chelsea',
    aliases: ['chelsea', 'chelsea fc', 'che'],
  },
  'crystal-palace': {
    medium: 'Palace',
    slug: 'crystal-palace',
    aliases: ['crystal palace', 'crystal palace fc', 'palace', 'cry'],
  },
  'everton': {
    medium: 'Everton',
    slug: 'everton',
    aliases: ['everton', 'everton fc', 'eve'],
  },
  'fulham': {
    medium: 'Fulham',
    slug: 'fulham',
    aliases: ['fulham', 'fulham fc', 'ful'],
  },
  'ipswich': {
    medium: 'Ipswich',
    slug: 'ipswich',
    aliases: ['ipswich', 'ipswich town', 'ips'],
  },
  'leeds': {
    medium: 'Leeds',
    slug: 'leeds',
    aliases: ['leeds', 'leeds united', 'leeds united fc', 'lee'],
  },
  'leicester': {
    medium: 'Leicester',
    slug: 'leicester',
    aliases: ['leicester', 'leicester city', 'lei'],
  },
  'liverpool': {
    medium: 'Liverpool',
    slug: 'liverpool',
    aliases: ['liverpool', 'liverpool fc', 'liv'],
  },
  'man-city': {
    medium: 'Man City',
    slug: 'man-city',
    aliases: ['manchester city', 'manchester city fc', 'man city', 'mci', 'city'],
  },
  'man-united': {
    medium: 'Man Utd',
    slug: 'man-united',
    aliases: ['manchester united', 'manchester united fc', 'man united', 'man utd', 'mun', 'united'],
  },
  'newcastle': {
    medium: 'Newc',
    slug: 'newcastle',
    aliases: ['newcastle', 'newcastle united', 'newcastle united fc', 'new'],
  },
  'nottingham-forest': {
    medium: 'Forest',
    slug: 'nottingham-forest',
    aliases: ['nottingham forest', 'nottingham forest fc', 'nottingham', 'forest', 'nfo', 'not'],
  },
  'southampton': {
    medium: 'Southampton',
    slug: 'southampton',
    aliases: ['southampton', 'southampton fc', 'sou'],
  },
  'spurs': {
    medium: 'Spurs',
    slug: 'spurs',
    aliases: ['tottenham', 'tottenham hotspur', 'tottenham hotspur fc', 'spurs', 'tot'],
  },
  'west-ham': {
    medium: 'West Ham',
    slug: 'west-ham',
    aliases: ['west ham', 'west ham united', 'west ham united fc', 'whu'],
  },
  'wolves': {
    medium: 'Wolves',
    slug: 'wolves',
    aliases: ['wolves', 'wolverhampton wanderers', 'wolverhampton wanderers fc', 'wolverhampton', 'wol'],
  },
  'sunderland': {
    medium: 'Sunder',
    slug: 'sunderland',
    aliases: ['sunderland', 'sunderland fc', 'sun'],
  },
  'burnley': {
    medium: 'Burnley',
    slug: 'burnley',
    aliases: ['burnley', 'burnley fc', 'bur'],
  },
};

/** Build a lookup from normalised alias -> key. */
const ALIAS_TO_KEY: Record<string, TeamKey> = (() => {
  const m: Record<string, TeamKey> = {} as any;
  (Object.keys(CLUBS) as TeamKey[]).forEach((k) => {
    CLUBS[k].aliases.forEach((a) => {
      m[norm(a)] = k;
    });
  });
  return m;
})();

/** Resolve the canonical TeamKey for an arbitrary input string (club name or code). */
function resolveKey(input: string): TeamKey | null {
  const n = norm(input);
  if (!n) return null;
  return ALIAS_TO_KEY[n] ?? null;
}

/** Public helpers */

/** Medium display name like "Spurs", "Man City". Falls back to the original input. */
export function getMediumName(input: string): string {
  const k = resolveKey(input);
  return k ? CLUBS[k].medium : input;
}

/** Full team name like "Tottenham Hotspur", "Manchester City". Falls back to the original input. */
export function getFullName(input: string): string {
  const k = resolveKey(input);
  if (!k) return input;
  // Return the first alias which is usually the full name
  const aliases = CLUBS[k].aliases;
  if (aliases.length > 0) {
    // Capitalize first letter of each word
    return aliases[0].split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
  return CLUBS[k].medium;
}

/** Badge asset path. Expects PNGs in /assets/badges/{slug}.png */
export function getTeamBadgePath(input: string): string {
  const k = resolveKey(input);
  const slug = k ? CLUBS[k].slug : 'default';
  return `/assets/badges/${slug}.png`;
}

/** Optional: expose a list of all known slugs (useful for preloading). */
export const ALL_BADGE_SLUGS: string[] = (Object.keys(CLUBS) as TeamKey[]).map(
  (k) => CLUBS[k].slug
);

/** 
 * Check if two team names match, handling abbreviations and variations.
 * Useful for matching goal data from APIs where team names might differ.
 */
export function areTeamNamesSimilar(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;
  
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  
  // Exact match
  if (n1 === n2) return true;
  
  // Normalize by removing non-alphanumeric characters for comparison
  const n1Normalized = n1.replace(/[^a-z0-9]/g, '');
  const n2Normalized = n2.replace(/[^a-z0-9]/g, '');
  
  // Check if one contains the other (handles "Paris Saint-Germain" vs "PSG")
  if (n1Normalized.length >= 3 && n2Normalized.length >= 3) {
    if (n1Normalized.includes(n2Normalized) || n2Normalized.includes(n1Normalized)) {
      return true;
    }
  }
  
  // Special abbreviation mappings for teams not in CLUBS registry
  const abbreviationMap: Record<string, string[]> = {
    'psg': ['parissaintgermain', 'paris saint germain', 'paris saint-germain', 'paris saintgermain'],
    'spurs': ['tottenham', 'tottenham hotspur'],
    'man city': ['manchester city'],
    'man united': ['manchester united'],
  };
  
  // Check abbreviation map
  for (const [abbr, fullNames] of Object.entries(abbreviationMap)) {
    const n1IsAbbr = n1Normalized === abbr;
    const n2IsAbbr = n2Normalized === abbr;
    
    if (n1IsAbbr && fullNames.some(full => {
      const fullNormalized = full.replace(/[^a-z0-9]/g, '');
      return n2Normalized.includes(fullNormalized) || fullNormalized.includes(n2Normalized);
    })) {
      return true;
    }
    
    if (n2IsAbbr && fullNames.some(full => {
      const fullNormalized = full.replace(/[^a-z0-9]/g, '');
      return n1Normalized.includes(fullNormalized) || fullNormalized.includes(n1Normalized);
    })) {
      return true;
    }
    
    // Check if both are variations of the same team
    if (fullNames.some(full => {
      const fullNormalized = full.replace(/[^a-z0-9]/g, '');
      return (n1Normalized.includes(fullNormalized) || fullNormalized.includes(n1Normalized)) &&
             (n2Normalized.includes(fullNormalized) || fullNormalized.includes(n2Normalized));
    })) {
      return true;
    }
  }
  
  return false;
}