import type { ImageSourcePropType } from 'react-native';

/**
 * Bundled club crests — includes every Premier League club that appears in
 * Retro Totl Daily historic data (football-data.co.uk E0).
 * 512px renders of the football-data.org crests (scripts/fetch-mobile-badges.mjs);
 * HUL, SHW, OLD, DER and WIM keep the era crests from public/assets/badges.
 */
export const TEAM_BADGES: Record<string, number> = {
  ARS: require('../../assets/badges/ARS.png'),
  AVL: require('../../assets/badges/AVL.png'),
  BAR: require('../../assets/badges/BAR.png'),
  BHA: require('../../assets/badges/BHA.png'),
  BIR: require('../../assets/badges/BIR.png'),
  BLA: require('../../assets/badges/BLA.png'),
  BLP: require('../../assets/badges/BLP.png'),
  BOL: require('../../assets/badges/BOL.png'),
  BOU: require('../../assets/badges/BOU.png'),
  BRD: require('../../assets/badges/BRD.png'),
  BRE: require('../../assets/badges/BRE.png'),
  BUR: require('../../assets/badges/BUR.png'),
  CAR: require('../../assets/badges/CAR.png'),
  CHA: require('../../assets/badges/CHA.png'),
  CHE: require('../../assets/badges/CHE.png'),
  COV: require('../../assets/badges/COV.png'),
  CRY: require('../../assets/badges/CRY.png'),
  DER: require('../../assets/badges/DER.png'),
  EVE: require('../../assets/badges/EVE.png'),
  FUL: require('../../assets/badges/FUL.png'),
  HUD: require('../../assets/badges/HUD.png'),
  HUL: require('../../assets/badges/HUL.png'),
  IPS: require('../../assets/badges/IPS.png'),
  LEE: require('../../assets/badges/LEE.png'),
  LEI: require('../../assets/badges/LEI.png'),
  LIV: require('../../assets/badges/LIV.png'),
  LUT: require('../../assets/badges/LUT.png'),
  MCI: require('../../assets/badges/MCI.png'),
  MID: require('../../assets/badges/MID.png'),
  MUN: require('../../assets/badges/MUN.png'),
  NEW: require('../../assets/badges/NEW.png'),
  NFO: require('../../assets/badges/NFO.png'),
  NOR: require('../../assets/badges/NOR.png'),
  NOT: require('../../assets/badges/NOT.png'),
  OLD: require('../../assets/badges/OLD.png'),
  POR: require('../../assets/badges/POR.png'),
  QPR: require('../../assets/badges/QPR.png'),
  REA: require('../../assets/badges/REA.png'),
  SHU: require('../../assets/badges/SHU.png'),
  SHW: require('../../assets/badges/SHW.png'),
  SOU: require('../../assets/badges/SOU.png'),
  STK: require('../../assets/badges/STK.png'),
  SUN: require('../../assets/badges/SUN.png'),
  SWA: require('../../assets/badges/SWA.png'),
  SWI: require('../../assets/badges/SWI.png'),
  TOT: require('../../assets/badges/TOT.png'),
  WAT: require('../../assets/badges/WAT.png'),
  WBA: require('../../assets/badges/WBA.png'),
  WHU: require('../../assets/badges/WHU.png'),
  WIG: require('../../assets/badges/WIG.png'),
  WIM: require('../../assets/badges/WIM.png'),
  WOL: require('../../assets/badges/WOL.png'),
};

/**
 * Prefer bundled badge; fall back to Football Data crest URL when present
 * (covers promoted clubs before local assets exist).
 */
export function getTeamBadgeSource(
  code: string | null | undefined,
  crestUrl?: string | null
): ImageSourcePropType | null {
  const key = String(code ?? '')
    .trim()
    .toUpperCase();
  if (key && TEAM_BADGES[key]) return TEAM_BADGES[key];
  const url = typeof crestUrl === 'string' ? crestUrl.trim() : '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return { uri: url };
  }
  return null;
}
