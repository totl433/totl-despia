#!/usr/bin/env node
/**
 * Ingest Premier League historic results from football-data.co.uk into
 * data/retro-daily/ for Retro Totl Daily.
 *
 * Usage:
 *   node scripts/ingest-retro-daily-history.mjs
 *   node scripts/ingest-retro-daily-history.mjs --from 9394 --to 2425
 *
 * Writes:
 *   data/retro-daily/seasons/{seasonKey}.json
 *   data/retro-daily/index.json
 *   data/retro-daily/unmapped-teams.json (if any)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'retro-daily');
const SEASONS_DIR = path.join(OUT_DIR, 'seasons');
const TEAM_MAP_PATH = path.join(
  ROOT,
  'apps/mobile/src/lib/retroDaily/fdTeamMap.json'
);

const BASE = 'https://www.football-data.co.uk/mmz4281';

function parseArgs(argv) {
  const out = { from: '9394', to: '2526' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--from' && argv[i + 1]) out.from = argv[++i];
    else if (argv[i] === '--to' && argv[i + 1]) out.to = argv[++i];
  }
  return out;
}

/** Generate football-data season keys from 9394 … 2526 inclusive. */
function seasonKeysBetween(fromKey, toKey) {
  const keys = [];
  const startA = Number(fromKey.slice(0, 2));
  const endA = Number(toKey.slice(0, 2));
  let year = startA >= 90 ? 1900 + startA : 2000 + startA;
  const endYear = endA >= 90 ? 1900 + endA : 2000 + endA;
  while (year <= endYear) {
    const a = String(year).slice(2);
    const b = String(year + 1).slice(2);
    keys.push(`${a}${b}`);
    year += 1;
  }
  return keys;
}

function seasonLabelFromKey(key) {
  // 9697 → 96/97, 0001 → 00/01
  return `${key.slice(0, 2)}/${key.slice(2)}`;
}

function parseCsvLine(line) {
  // football-data CSVs are simple — no quoted commas in team names
  return line.split(',');
}

function parseFdDate(raw) {
  // dd/mm/yy or dd/mm/yyyy
  const m = String(raw ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  let year = Number(y);
  if (year < 100) year += year >= 90 ? 1900 : 2000;
  const month = String(mo).padStart(2, '0');
  const day = String(d).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchSeasonCsv(seasonKey) {
  const url = `${BASE}/${seasonKey}/E0.csv`;
  const res = await fetch(url);
  if (!res.ok) {
    return { ok: false, status: res.status, text: '' };
  }
  const text = await res.text();
  if (!text.includes('HomeTeam') || !text.includes('FTHG')) {
    return { ok: false, status: res.status, text: text.slice(0, 120) };
  }
  return { ok: true, status: res.status, text };
}

function parseSeason(seasonKey, csvText, teamMap, unmapped) {
  const text = csvText.replace(/^\uFEFF/, '');
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const hdr = parseCsvLine(lines[0]);
  const col = (name) => hdr.indexOf(name);
  const iDate = col('Date');
  const iHome = col('HomeTeam');
  const iAway = col('AwayTeam');
  const iFTHG = col('FTHG');
  const iFTAG = col('FTAG');
  const iFTR = col('FTR');
  const iHTHG = col('HTHG');
  const iHTAG = col('HTAG');
  const iDiv = col('Div');

  const seasonLabel = seasonLabelFromKey(seasonKey);
  const fixtures = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (iDiv >= 0 && cols[iDiv] && cols[iDiv] !== 'E0') continue;
    const homeName = (cols[iHome] ?? '').trim();
    const awayName = (cols[iAway] ?? '').trim();
    if (!homeName || !awayName) continue;

    const homeCode = teamMap[homeName];
    const awayCode = teamMap[awayName];
    if (!homeCode) unmapped.add(homeName);
    if (!awayCode) unmapped.add(awayName);
    if (!homeCode || !awayCode) continue;

    const homeScore = Number(cols[iFTHG]);
    const awayScore = Number(cols[iFTAG]);
    let result = (cols[iFTR] ?? '').trim().toUpperCase();
    if (!['H', 'D', 'A'].includes(result)) {
      if (Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
        result = homeScore > awayScore ? 'H' : homeScore < awayScore ? 'A' : 'D';
      } else {
        continue;
      }
    }
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

    const matchDate = parseFdDate(cols[iDate]);
    if (!matchDate) continue;

    const htHome = iHTHG >= 0 && cols[iHTHG] !== '' ? Number(cols[iHTHG]) : null;
    const htAway = iHTAG >= 0 && cols[iHTAG] !== '' ? Number(cols[iHTAG]) : null;

    const id = `rtd-${seasonKey}-${matchDate}-${slug(homeCode)}-${slug(awayCode)}`;

    fixtures.push({
      id,
      seasonLabel,
      seasonKey,
      matchDate,
      homeCode,
      awayCode,
      homeName,
      awayName,
      homeScore,
      awayScore,
      result,
      htHome: Number.isFinite(htHome) ? htHome : null,
      htAway: Number.isFinite(htAway) ? htAway : null,
      source: 'football-data.co.uk',
    });
  }

  return fixtures;
}

async function main() {
  const args = parseArgs(process.argv);
  const keys = seasonKeysBetween(args.from, args.to);
  const teamMap = JSON.parse(fs.readFileSync(TEAM_MAP_PATH, 'utf8'));
  const unmapped = new Set();

  fs.mkdirSync(SEASONS_DIR, { recursive: true });

  const index = {
    generatedAt: new Date().toISOString(),
    source: 'https://www.football-data.co.uk/',
    from: args.from,
    to: args.to,
    seasons: [],
  };

  let totalFixtures = 0;

  for (const key of keys) {
    process.stdout.write(`Fetching ${key}… `);
    const { ok, status, text } = await fetchSeasonCsv(key);
    if (!ok) {
      console.log(`skip (HTTP ${status})`);
      continue;
    }
    const fixtures = parseSeason(key, text, teamMap, unmapped);
    if (fixtures.length === 0) {
      console.log('skip (0 rows)');
      continue;
    }
    const outPath = path.join(SEASONS_DIR, `${key}.json`);
    fs.writeFileSync(outPath, JSON.stringify({ seasonKey: key, seasonLabel: seasonLabelFromKey(key), fixtures }, null, 0));
    index.seasons.push({
      seasonKey: key,
      seasonLabel: seasonLabelFromKey(key),
      fixtureCount: fixtures.length,
      file: `seasons/${key}.json`,
    });
    totalFixtures += fixtures.length;
    console.log(`${fixtures.length} fixtures`);
    // Be polite to football-data.co.uk
    await new Promise((r) => setTimeout(r, 200));
  }

  index.totalFixtures = totalFixtures;
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2));

  const unmappedPath = path.join(OUT_DIR, 'unmapped-teams.json');
  if (unmapped.size > 0) {
    fs.writeFileSync(unmappedPath, JSON.stringify([...unmapped].sort(), null, 2));
    console.warn(`\n⚠ Unmapped teams (${unmapped.size}) written to ${unmappedPath}`);
  } else if (fs.existsSync(unmappedPath)) {
    fs.unlinkSync(unmappedPath);
  }

  console.log(`\nDone. ${index.seasons.length} seasons, ${totalFixtures} fixtures → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
