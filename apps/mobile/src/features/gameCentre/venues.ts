/**
 * Home grounds, by club code. Fixtures carry no venue, and a league match is played at the
 * home side's ground. A club missing here just shows the date line without a venue.
 */
const HOME_GROUNDS: Record<string, string> = {
  ARS: 'Emirates Stadium, London',
  AVL: 'Villa Park, Birmingham',
  BHA: 'Amex Stadium, Brighton',
  BOU: 'Vitality Stadium, Bournemouth',
  BRE: 'Gtech Community Stadium, London',
  BUR: 'Turf Moor, Burnley',
  CHE: 'Stamford Bridge, London',
  COV: 'Coventry Building Society Arena, Coventry',
  CRY: 'Selhurst Park, London',
  EVE: 'Hill Dickinson Stadium, Liverpool',
  FUL: 'Craven Cottage, London',
  HUL: 'MKM Stadium, Hull',
  IPS: 'Portman Road, Ipswich',
  LEE: 'Elland Road, Leeds',
  LEI: 'King Power Stadium, Leicester',
  LIV: 'Anfield, Liverpool',
  LUT: 'Kenilworth Road, Luton',
  MCI: 'Etihad Stadium, Manchester',
  MID: 'Riverside Stadium, Middlesbrough',
  MUN: 'Old Trafford, Manchester',
  NEW: "St James' Park, Newcastle",
  NFO: 'City Ground, Nottingham',
  NOT: 'City Ground, Nottingham',
  NOR: 'Carrow Road, Norwich',
  SHU: 'Bramall Lane, Sheffield',
  SOU: "St Mary's Stadium, Southampton",
  STK: 'bet365 Stadium, Stoke-on-Trent',
  SUN: 'Stadium of Light, Sunderland',
  SWA: 'Swansea.com Stadium, Swansea',
  TOT: 'Tottenham Hotspur Stadium, London',
  WAT: 'Vicarage Road, Watford',
  WBA: 'The Hawthorns, West Bromwich',
  WHU: 'London Stadium, London',
  WOL: 'Molineux, Wolverhampton',
};

export function homeGround(code: string | null | undefined): string | null {
  return HOME_GROUNDS[String(code ?? '').trim().toUpperCase()] ?? null;
}

/** "Sat 24 Oct 2026 · Old Trafford, Manchester", local date; either part may be missing. */
export function matchDateVenueLine(kickoffIso: string | null | undefined, homeCode: string | null | undefined): string | null {
  const at = kickoffIso ? new Date(kickoffIso) : null;
  const date =
    at && !Number.isNaN(at.getTime())
      ? at.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/,/g, '')
      : null;
  const parts = [date, homeGround(homeCode)].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
