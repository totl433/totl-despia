#!/usr/bin/env node
/**
 * Fetch missing Retro Totl Daily club badges + colours from TheSportsDB (free).
 *
 * Usage:
 *   node scripts/fetch-retro-daily-badges.mjs
 *
 * Writes:
 *   public/assets/badges/{CODE}.png
 *   apps/mobile/src/lib/retroDaily/teamColorsExtra.json
 *   apps/mobile/src/lib/retroDaily/badgeFetchReport.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BADGE_DIR = path.join(ROOT, 'public', 'assets', 'badges');
const FD_MAP_PATH = path.join(ROOT, 'apps/mobile/src/lib/retroDaily/fdTeamMap.json');
const COLORS_OUT = path.join(ROOT, 'apps/mobile/src/lib/retroDaily/teamColorsExtra.json');
const REPORT_OUT = path.join(ROOT, 'apps/mobile/src/lib/retroDaily/badgeFetchReport.json');

const TSDB = 'https://www.thesportsdb.com/api/v1/json/3';

/** Prefer precise search strings so we hit the English football club. */
const SEARCH_BY_CODE = {
  ARS: 'Arsenal',
  AVL: 'Aston Villa',
  BAR: 'Barnsley',
  BIR: 'Birmingham City',
  BLA: 'Blackburn Rovers',
  BLP: 'Blackpool',
  BOL: 'Bolton Wanderers',
  BOU: 'AFC Bournemouth',
  BRD: 'Bradford City',
  BRE: 'Brentford',
  BHA: 'Brighton',
  BUR: 'Burnley',
  CAR: 'Cardiff City',
  CHA: 'Charlton Athletic',
  CHE: 'Chelsea',
  COV: 'Coventry City',
  CRY: 'Crystal Palace',
  DER: 'Derby County',
  EVE: 'Everton',
  FUL: 'Fulham',
  HUD: 'Huddersfield Town',
  HUL: 'Hull City',
  IPS: 'Ipswich Town',
  LEE: 'Leeds United',
  LEI: 'Leicester City',
  LIV: 'Liverpool',
  LUT: 'Luton Town',
  MCI: 'Manchester City',
  MUN: 'Manchester United',
  MID: 'Middlesbrough',
  NEW: 'Newcastle United',
  NOR: 'Norwich City',
  NFO: 'Nottingham Forest',
  OLD: 'Oldham Athletic',
  POR: 'Portsmouth',
  QPR: 'Queens Park Rangers',
  REA: 'Reading',
  SHU: 'Sheffield United',
  SHW: 'Sheffield Wednesday',
  SOU: 'Southampton',
  STK: 'Stoke City',
  SUN: 'Sunderland',
  SWA: 'Swansea City',
  SWI: 'Swindon Town',
  TOT: 'Tottenham Hotspur',
  WAT: 'Watford',
  WBA: 'West Bromwich Albion',
  WHU: 'West Ham United',
  WIG: 'Wigan Athletic',
  // Historic Prem club (Crazy Gang), not modern AFC Wimbledon.
  WIM: 'Wimbledon',
  WOL: 'Wolverhampton Wanderers',
};

/** Fallback colours when TheSportsDB has empty colour fields (classic kits). */
const COLOUR_FALLBACKS = {
  BAR: { primary: '#E31C23', secondary: '#FFFFFF' },
  BIR: { primary: '#0000FF', secondary: '#FFFFFF' },
  BLA: { primary: '#009EE0', secondary: '#FFFFFF' },
  BLP: { primary: '#F68712', secondary: '#FFFFFF' },
  BOL: { primary: '#FFFFFF', secondary: '#1A1A1A' },
  BRD: { primary: '#7A0001', secondary: '#F4A300' },
  CAR: { primary: '#0070B5', secondary: '#FFFFFF' },
  CHA: { primary: '#D4021D', secondary: '#FFFFFF' },
  DER: { primary: '#FFFFFF', secondary: '#000000' },
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
  SWA: { primary: '#FFFFFF', secondary: '#000000' },
  SWI: { primary: '#E03A3E', secondary: '#FFFFFF' },
  WAT: { primary: '#FBEE23', secondary: '#ED2127' },
  WBA: { primary: '#122F67', secondary: '#FFFFFF' },
  WIG: { primary: '#1D59AF', secondary: '#FFFFFF' },
  WIM: { primary: '#0033A0', secondary: '#FFD100' },
  BUR: { primary: '#6C1D45', secondary: '#99D6EA' },
};

function normalizeHex(c) {
  if (!c || typeof c !== 'string') return null;
  let s = c.trim();
  if (!s || s.toLowerCase() === 'null') return null;
  if (!s.startsWith('#')) s = `#${s}`;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null;
  return s.toUpperCase();
}

async function searchTeam(query) {
  const url = `${TSDB}/searchteams.php?t=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TSDB ${res.status} for ${query}`);
  const json = await res.json();
  const teams = Array.isArray(json?.teams) ? json.teams : [];
  // Prefer English football clubs
  const scored = teams
    .map((t) => {
      let score = 0;
      const league = String(t.strLeague ?? '');
      const country = String(t.strCountry ?? '');
      const sport = String(t.strSport ?? '');
      if (sport === 'Soccer') score += 5;
      if (country === 'England' || country === 'Wales') score += 3;
      if (/Premier|Championship|League One|League Two|EFL/i.test(league)) score += 4;
      if (t.strBadge) score += 2;
      return { t, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.t ?? null;
}

async function downloadBadge(code, badgeUrl) {
  const res = await fetch(badgeUrl);
  if (!res.ok) throw new Error(`badge download ${res.status} ${badgeUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const out = path.join(BADGE_DIR, `${code}.png`);
  await fs.writeFile(out, buf);
  return out;
}

async function main() {
  await fs.mkdir(BADGE_DIR, { recursive: true });
  const fdMap = JSON.parse(await fs.readFile(FD_MAP_PATH, 'utf8'));
  const codes = [...new Set(Object.values(fdMap))].sort();

  const existing = new Set(
    (await fs.readdir(BADGE_DIR)).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/i, ''))
  );

  const colors = {};
  const report = { fetched: [], skippedExisting: [], failed: [], colours: {} };

  for (const code of codes) {
    const query = SEARCH_BY_CODE[code];
    if (!query) {
      report.failed.push({ code, reason: 'no search query' });
      continue;
    }

    process.stdout.write(`${code} (${query})… `);
    let team;
    try {
      team = await searchTeam(query);
    } catch (e) {
      console.log('search fail');
      report.failed.push({ code, reason: String(e.message || e) });
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }

    if (!team) {
      console.log('not found');
      report.failed.push({ code, reason: 'not found' });
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }

    const c1 = normalizeHex(team.strColour1) || COLOUR_FALLBACKS[code]?.primary || null;
    const c2 = normalizeHex(team.strColour2) || COLOUR_FALLBACKS[code]?.secondary || '#FFFFFF';
    if (c1) {
      colors[code] = { primary: c1, secondary: c2, source: team.strTeam };
      report.colours[code] = colors[code];
    }

    if (existing.has(code)) {
      console.log(`badge exists · colours ${c1 || '—'}`);
      report.skippedExisting.push(code);
    } else if (team.strBadge) {
      try {
        await downloadBadge(code, team.strBadge);
        console.log(`badge ok · ${team.strTeam}`);
        report.fetched.push({ code, team: team.strTeam, badge: team.strBadge });
        existing.add(code);
      } catch (e) {
        console.log('badge fail');
        report.failed.push({ code, reason: String(e.message || e) });
      }
    } else {
      console.log('no badge url');
      report.failed.push({ code, reason: 'no badge url', team: team.strTeam });
    }

    // Be polite to free API
    await new Promise((r) => setTimeout(r, 450));
  }

  // Ensure colour fallbacks for any still missing
  for (const [code, cols] of Object.entries(COLOUR_FALLBACKS)) {
    if (!colors[code]) colors[code] = { ...cols, source: 'fallback' };
  }

  await fs.writeFile(COLORS_OUT, JSON.stringify(colors, null, 2));
  await fs.writeFile(REPORT_OUT, JSON.stringify(report, null, 2));
  console.log(`\nColours → ${COLORS_OUT}`);
  console.log(`Report  → ${REPORT_OUT}`);
  console.log(`Fetched ${report.fetched.length} badges, skipped ${report.skippedExisting.length}, failed ${report.failed.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
