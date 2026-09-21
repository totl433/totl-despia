import type { ImageSourcePropType } from 'react-native';

/**
 * Bundled club crests — includes every Premier League club that appears in
 * Retro Totl Daily historic data (football-data.co.uk E0).
 */
export const TEAM_BADGES: Record<string, number> = {
  ARS: require('../../../../public/assets/badges/ARS.png'),
  AVL: require('../../../../public/assets/badges/AVL.png'),
  BAR: require('../../../../public/assets/badges/BAR.png'),
  BHA: require('../../../../public/assets/badges/BHA.png'),
  BIR: require('../../../../public/assets/badges/BIR.png'),
  BLA: require('../../../../public/assets/badges/BLA.png'),
  BLP: require('../../../../public/assets/badges/BLP.png'),
  BOL: require('../../../../public/assets/badges/BOL.png'),
  BOU: require('../../../../public/assets/badges/BOU.png'),
  BRD: require('../../../../public/assets/badges/BRD.png'),
  BRE: require('../../../../public/assets/badges/BRE.png'),
  BUR: require('../../../../public/assets/badges/BUR.png'),
  CAR: require('../../../../public/assets/badges/CAR.png'),
  CHA: require('../../../../public/assets/badges/CHA.png'),
  CHE: require('../../../../public/assets/badges/CHE.png'),
  COV: require('../../../../public/assets/badges/COV.png'),
  CRY: require('../../../../public/assets/badges/CRY.png'),
  DER: require('../../../../public/assets/badges/DER.png'),
  EVE: require('../../../../public/assets/badges/EVE.png'),
  FUL: require('../../../../public/assets/badges/FUL.png'),
  HUD: require('../../../../public/assets/badges/HUD.png'),
  HUL: require('../../../../public/assets/badges/HUL.png'),
  IPS: require('../../../../public/assets/badges/IPS.png'),
  LEE: require('../../../../public/assets/badges/LEE.png'),
  LEI: require('../../../../public/assets/badges/LEI.png'),
  LIV: require('../../../../public/assets/badges/LIV.png'),
  LUT: require('../../../../public/assets/badges/LUT.png'),
  MCI: require('../../../../public/assets/badges/MCI.png'),
  MID: require('../../../../public/assets/badges/MID.png'),
  MUN: require('../../../../public/assets/badges/MUN.png'),
  NEW: require('../../../../public/assets/badges/NEW.png'),
  NFO: require('../../../../public/assets/badges/NFO.png'),
  NOR: require('../../../../public/assets/badges/NOR.png'),
  NOT: require('../../../../public/assets/badges/NOT.png'),
  OLD: require('../../../../public/assets/badges/OLD.png'),
  POR: require('../../../../public/assets/badges/POR.png'),
  QPR: require('../../../../public/assets/badges/QPR.png'),
  REA: require('../../../../public/assets/badges/REA.png'),
  SHU: require('../../../../public/assets/badges/SHU.png'),
  SHW: require('../../../../public/assets/badges/SHW.png'),
  SOU: require('../../../../public/assets/badges/SOU.png'),
  STK: require('../../../../public/assets/badges/STK.png'),
  SUN: require('../../../../public/assets/badges/SUN.png'),
  SWA: require('../../../../public/assets/badges/SWA.png'),
  SWI: require('../../../../public/assets/badges/SWI.png'),
  TOT: require('../../../../public/assets/badges/TOT.png'),
  WAT: require('../../../../public/assets/badges/WAT.png'),
  WBA: require('../../../../public/assets/badges/WBA.png'),
  WHU: require('../../../../public/assets/badges/WHU.png'),
  WIG: require('../../../../public/assets/badges/WIG.png'),
  WIM: require('../../../../public/assets/badges/WIM.png'),
  WOL: require('../../../../public/assets/badges/WOL.png'),
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
