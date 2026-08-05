import type { ImageSourcePropType } from 'react-native';

export const TEAM_BADGES: Record<string, number> = {
  ARS: require('../../../../public/assets/badges/ARS.png'),
  AVL: require('../../../../public/assets/badges/AVL.png'),
  BHA: require('../../../../public/assets/badges/BHA.png'),
  BOU: require('../../../../public/assets/badges/BOU.png'),
  BRE: require('../../../../public/assets/badges/BRE.png'),
  BUR: require('../../../../public/assets/badges/BUR.png'),
  CHE: require('../../../../public/assets/badges/CHE.png'),
  /** Promoted / new PL codes for 2026/27 (Football Data crests bundled) */
  COV: require('../../../../public/assets/badges/COV.png'),
  CRY: require('../../../../public/assets/badges/CRY.png'),
  EVE: require('../../../../public/assets/badges/EVE.png'),
  FUL: require('../../../../public/assets/badges/FUL.png'),
  HUL: require('../../../../public/assets/badges/HUL.png'),
  IPS: require('../../../../public/assets/badges/IPS.png'),
  LEE: require('../../../../public/assets/badges/LEE.png'),
  LIV: require('../../../../public/assets/badges/LIV.png'),
  MCI: require('../../../../public/assets/badges/MCI.png'),
  MUN: require('../../../../public/assets/badges/MUN.png'),
  NEW: require('../../../../public/assets/badges/NEW.png'),
  NFO: require('../../../../public/assets/badges/NFO.png'),
  NOT: require('../../../../public/assets/badges/NOT.png'),
  TOT: require('../../../../public/assets/badges/TOT.png'),
  WHU: require('../../../../public/assets/badges/WHU.png'),
  WOL: require('../../../../public/assets/badges/WOL.png'),
  SUN: require('../../../../public/assets/badges/SUN.png'),
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
