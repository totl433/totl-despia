import fdMap from './fdTeamMap.json';

export const FD_TEAM_NAME_TO_CODE: Record<string, string> = fdMap;

/** Display names for RTD UI (short, badge-friendly). */
export const RETRO_TEAM_DISPLAY_NAME: Record<string, string> = {
  ARS: 'Arsenal',
  AVL: 'Aston Villa',
  BAR: 'Barnsley',
  BIR: 'Birmingham',
  BLA: 'Blackburn',
  BLP: 'Blackpool',
  BOL: 'Bolton',
  BOU: 'Bournemouth',
  BRD: 'Bradford',
  BRE: 'Brentford',
  BHA: 'Brighton',
  BUR: 'Burnley',
  CAR: 'Cardiff',
  CHA: 'Charlton',
  CHE: 'Chelsea',
  COV: 'Coventry',
  CRY: 'Crystal Palace',
  DER: 'Derby',
  EVE: 'Everton',
  FUL: 'Fulham',
  HUD: 'Huddersfield',
  HUL: 'Hull',
  IPS: 'Ipswich',
  LEE: 'Leeds',
  LEI: 'Leicester',
  LIV: 'Liverpool',
  LUT: 'Luton',
  MCI: 'Man City',
  MUN: 'Man Utd',
  MID: 'Middlesbrough',
  NEW: 'Newcastle',
  NOR: 'Norwich',
  NFO: "Nott'm Forest",
  OLD: 'Oldham',
  POR: 'Portsmouth',
  QPR: 'QPR',
  REA: 'Reading',
  SHU: 'Sheffield Utd',
  SHW: 'Sheffield Weds',
  SOU: 'Southampton',
  STK: 'Stoke',
  SUN: 'Sunderland',
  SWA: 'Swansea',
  SWI: 'Swindon',
  TOT: 'Tottenham',
  WAT: 'Watford',
  WBA: 'West Brom',
  WHU: 'West Ham',
  WIG: 'Wigan',
  WIM: 'Wimbledon',
  WOL: 'Wolves',
};

export function fdTeamToCode(name: string): string | null {
  const key = String(name ?? '').trim();
  return FD_TEAM_NAME_TO_CODE[key] ?? null;
}

export function displayNameForCode(code: string, fallback?: string): string {
  return RETRO_TEAM_DISPLAY_NAME[code] ?? fallback ?? code;
}
