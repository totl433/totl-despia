import teamColorsExtra from './teamColorsExtra.json';

/**
 * Club colour allocation for Predictions swipe cards + Retro Totl Daily.
 * Current PL colours kept as product defaults; historic clubs from TheSportsDB / kit fallbacks.
 */
export const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  // Current / established product colours
  ARS: { primary: '#EF0107', secondary: '#023474' },
  AVL: { primary: '#95BFE5', secondary: '#670E36' },
  BOU: { primary: '#DA291C', secondary: '#000000' },
  BRE: { primary: '#E30613', secondary: '#FBB800' },
  BHA: { primary: '#0057B8', secondary: '#FFCD00' },
  BUR: { primary: '#6C1D45', secondary: '#99D6EA' },
  CHE: { primary: '#034694', secondary: '#034694' },
  COV: { primary: '#059DD9', secondary: '#059DD9' },
  CRY: { primary: '#1B458F', secondary: '#C4122E' },
  EVE: { primary: '#003399', secondary: '#003399' },
  FUL: { primary: '#000000', secondary: '#FFFFFF' },
  HUL: { primary: '#F18A01', secondary: '#000000' },
  IPS: { primary: '#3A64A3', secondary: '#3A64A3' },
  LEE: { primary: '#FFCD00', secondary: '#1D428A' },
  LIV: { primary: '#C8102E', secondary: '#00B2A9' },
  MCI: { primary: '#6CABDD', secondary: '#1C2C5B' },
  MUN: { primary: '#DA291C', secondary: '#FBE122' },
  NEW: { primary: '#241F20', secondary: '#FFFFFF' },
  NFO: { primary: '#DD0000', secondary: '#FFFFFF' },
  SUN: { primary: '#EB172B', secondary: '#211E1F' },
  TOT: { primary: '#132257', secondary: '#FFFFFF' },
  WHU: { primary: '#7A263A', secondary: '#1BB1E7' },
  WOL: { primary: '#FDB913', secondary: '#231F20' },

  // Historic / occasional PL clubs (TheSportsDB + kit fallbacks)
  BAR: { primary: '#E31C23', secondary: '#FFFFFF' },
  BIR: { primary: '#0000FF', secondary: '#FFFFFF' },
  BLA: { primary: '#009EE0', secondary: '#FFFFFF' },
  BLP: { primary: '#FF5F00', secondary: '#FFFFFF' },
  BOL: { primary: '#1A1A1A', secondary: '#FFFFFF' },
  BRD: { primary: '#7A0001', secondary: '#F4A300' },
  CAR: { primary: '#0070B5', secondary: '#FFFFFF' },
  CHA: { primary: '#D4021D', secondary: '#FFFFFF' },
  DER: { primary: '#000000', secondary: '#FFFFFF' },
  HUD: { primary: '#0B45A0', secondary: '#FFFFFF' },
  LEI: { primary: '#003090', secondary: '#FDBE11' },
  LUT: { primary: '#F78F1E', secondary: '#002D62' },
  MID: { primary: '#E11B22', secondary: '#FFFFFF' },
  NOR: { primary: '#FFF200', secondary: '#00A651' },
  OLD: { primary: '#0053A0', secondary: '#E30613' },
  POR: { primary: '#001489', secondary: '#FFFFFF' },
  QPR: { primary: '#1D5BA4', secondary: '#FFFFFF' },
  REA: { primary: '#004C97', secondary: '#FFFFFF' },
  SHU: { primary: '#EE2737', secondary: '#FFFFFF' },
  SHW: { primary: '#007A3D', secondary: '#FFFFFF' },
  SOU: { primary: '#D71920', secondary: '#FFFFFF' },
  STK: { primary: '#E03A3E', secondary: '#FFFFFF' },
  SWA: { primary: '#000000', secondary: '#FFFFFF' },
  SWI: { primary: '#E03A3E', secondary: '#FFFFFF' },
  WAT: { primary: '#FBEE23', secondary: '#ED2127' },
  WBA: { primary: '#122F67', secondary: '#FFFFFF' },
  WIG: { primary: '#1D59AF', secondary: '#FFFFFF' },
  WIM: { primary: '#0033A0', secondary: '#FFD100' },
};

// Fill any gaps from the fetch report without overriding product colours above.
for (const [code, cols] of Object.entries(teamColorsExtra as Record<string, { primary: string; secondary: string }>)) {
  if (!TEAM_COLORS[code] && cols?.primary) {
    TEAM_COLORS[code] = { primary: cols.primary, secondary: cols.secondary || '#FFFFFF' };
  }
}

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
 * True if hex is white / near-white (vanishes on white swipe cards).
 */
export function isNearWhite(hex: string | null | undefined): boolean {
  if (!hex || typeof hex !== 'string') return false;
  let s = hex.trim();
  if (!s.startsWith('#')) s = `#${s}`;
  if (/^#([0-9a-fA-F]{3})$/.test(s)) {
    s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  const m = s.match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // High luminance + all channels bright
  return r >= 230 && g >= 230 && b >= 230;
}

/**
 * Colour safe to paint on a white card: swap near-white primary for secondary / black.
 */
export function cardSafeTeamColor(primary: string, secondary?: string | null): string {
  if (!isNearWhite(primary)) return primary;
  if (secondary && !isNearWhite(secondary)) return secondary;
  return '#1A1A1A';
}

/**
 * Get the club primary colour. Uses canonical TEAM_COLORS first, then a stable generated fallback.
 * Near-white primaries are swapped so diagonal card panels don’t vanish into the white face.
 */
export function getTeamColor(code: string | null | undefined, name: string | null | undefined): string {
  const normalized = normalizeTeamCode(code);
  if (normalized && TEAM_COLORS[normalized]) {
    const { primary, secondary } = TEAM_COLORS[normalized];
    return cardSafeTeamColor(primary, secondary);
  }
  const identifier = normalized || String(name ?? '').trim() || 'default';
  return stringToColor(identifier);
}
