/**
 * Club colour allocation for Predictions swipe cards.
 * Ported from Despia web `src/pages/Predictions.tsx` (TEAM_COLORS + fallback generator).
 */
export const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  ARS: { primary: '#EF0107', secondary: '#023474' },
  AVL: { primary: '#95BFE5', secondary: '#670E36' },
  BOU: { primary: '#DA291C', secondary: '#000000' },
  BRE: { primary: '#E30613', secondary: '#FBB800' },
  BHA: { primary: '#0057B8', secondary: '#FFCD00' },
  CHE: { primary: '#034694', secondary: '#034694' },
  CRY: { primary: '#1B458F', secondary: '#C4122E' },
  EVE: { primary: '#003399', secondary: '#003399' },
  FUL: { primary: '#FFFFFF', secondary: '#000000' },
  LIV: { primary: '#C8102E', secondary: '#00B2A9' },
  MCI: { primary: '#6CABDD', secondary: '#1C2C5B' },
  MUN: { primary: '#DA291C', secondary: '#FBE122' },
  NEW: { primary: '#241F20', secondary: '#FFFFFF' },
  NFO: { primary: '#DD0000', secondary: '#FFFFFF' },
  TOT: { primary: '#132257', secondary: '#FFFFFF' },
  WHU: { primary: '#7A263A', secondary: '#1BB1E7' },
  WOL: { primary: '#FDB913', secondary: '#231F20' },
  SUN: { primary: '#EB172B', secondary: '#211E1F' },
  LEE: { primary: '#FFCD00', secondary: '#1D428A' },
};

const TEAM_CODE_ALIASES: Record<string, string> = {
  NOT: 'NFO', // Nottingham Forest (some feeds use NOT)
};

export function normalizeTeamCode(code: string | null | undefined): string {
  const raw = String(code ?? '').trim().toUpperCase();
  if (!raw) return '';
  return TEAM_CODE_ALIASES[raw] ?? raw;
}

// Generate a stable colour from a string (team name or code).
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash % 360);
  const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
  const lightness = 45 + (Math.abs(hash) % 15); // 45-60%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get the club primary colour. Uses canonical TEAM_COLORS first, then a stable generated fallback.
 */
export function getTeamColor(code: string | null | undefined, name: string | null | undefined): string {
  const normalized = normalizeTeamCode(code);
  if (normalized && TEAM_COLORS[normalized]) return TEAM_COLORS[normalized].primary;
  const identifier = normalized || String(name ?? '').trim() || 'default';
  return stringToColor(identifier);
}

