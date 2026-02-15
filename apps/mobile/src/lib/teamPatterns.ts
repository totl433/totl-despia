import { Asset } from 'expo-asset';

const TEAM_PATTERN_URIS: Record<string, string> = {
  ARS: Asset.fromModule(require('../../../../public/assets/patterns/arsenal.svg')).uri,
  AVL: Asset.fromModule(require('../../../../public/assets/patterns/aston-villa.svg')).uri,
  BOU: Asset.fromModule(require('../../../../public/assets/patterns/bournemouth.svg')).uri,
  BRE: Asset.fromModule(require('../../../../public/assets/patterns/brentford.svg')).uri,
  BHA: Asset.fromModule(require('../../../../public/assets/patterns/brighton.svg')).uri,
  BUR: Asset.fromModule(require('../../../../public/assets/patterns/burnley.svg')).uri,
  CHE: Asset.fromModule(require('../../../../public/assets/patterns/chelsea.svg')).uri,
  CRY: Asset.fromModule(require('../../../../public/assets/patterns/crystal-palace.svg')).uri,
  EVE: Asset.fromModule(require('../../../../public/assets/patterns/everton.svg')).uri,
  FUL: Asset.fromModule(require('../../../../public/assets/patterns/fulham.svg')).uri,
  LEE: Asset.fromModule(require('../../../../public/assets/patterns/leeds.svg')).uri,
  LIV: Asset.fromModule(require('../../../../public/assets/patterns/liverpool.svg')).uri,
  MCI: Asset.fromModule(require('../../../../public/assets/patterns/man-city.svg')).uri,
  MUN: Asset.fromModule(require('../../../../public/assets/patterns/man-united.svg')).uri,
  NEW: Asset.fromModule(require('../../../../public/assets/patterns/newcastle.svg')).uri,
  NFO: Asset.fromModule(require('../../../../public/assets/patterns/nottingham-forest.svg')).uri,
  TOT: Asset.fromModule(require('../../../../public/assets/patterns/spurs.svg')).uri,
  SUN: Asset.fromModule(require('../../../../public/assets/patterns/sunderland.svg')).uri,
  WHU: Asset.fromModule(require('../../../../public/assets/patterns/west-ham.svg')).uri,
  WOL: Asset.fromModule(require('../../../../public/assets/patterns/wolves.svg')).uri,
};

const TEAM_CODE_ALIASES: Record<string, string> = {
  NOT: 'NFO',
};

const STRIPED_TEAMS: Set<string> = new Set([
  'BOU',
  'BRE',
  'BHA',
  'CRY',
  'NEW',
  'SUN',
]);

const STRIPED_TEAM_COLORS: Record<string, string> = {
  BOU: '#DA291C',
  BRE: '#E30613',
  BHA: '#0057B8',
  CRY: '#1B458F',
  NEW: '#241F20',
  SUN: '#E03A3E',
};

function normalizePatternCode(code: string | null | undefined): string {
  const raw = String(code ?? '').trim().toUpperCase();
  if (!raw) return '';
  return TEAM_CODE_ALIASES[raw] ?? raw;
}

export function getTeamPatternUri(code: string | null | undefined): string | null {
  const normalized = normalizePatternCode(code);
  return normalized ? (TEAM_PATTERN_URIS[normalized] ?? null) : null;
}

export function hasStripedPattern(code: string | null | undefined): boolean {
  const normalized = normalizePatternCode(code);
  return normalized ? STRIPED_TEAMS.has(normalized) : false;
}

export function getStripedPatternFallbackColor(code: string | null | undefined): string | null {
  const normalized = normalizePatternCode(code);
  return normalized ? (STRIPED_TEAM_COLORS[normalized] ?? null) : null;
}

