#!/usr/bin/env node
/**
 * Derive final Premier League tables from Retro Daily season fixtures
 * and embed them on each season pack as `table`.
 *
 * Usage:
 *   node scripts/build-retro-daily-tables.mjs
 *
 * Reads/writes:
 *   data/retro-daily/seasons/{seasonKey}.json
 *   apps/mobile/src/lib/retroDaily/data/seasons/{seasonKey}.json (copy)
 *
 * Point deductions match official post-appeal Prem tables.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_SEASONS = path.join(ROOT, 'data', 'retro-daily', 'seasons');
const APP_SEASONS = path.join(ROOT, 'apps/mobile/src/lib/retroDaily/data/seasons');

/** Official Prem points deductions applied after appeals (seasonKey → code → pts). */
const DEDUCTIONS = {
  '9697': { MID: 3 },
  '0910': { POR: 9 },
  '2324': { EVE: 6, NFO: 4 },
};

function buildTable(fixtures, deductions = {}) {
  const stats = new Map();

  const row = (code, name) => {
    if (!stats.has(code)) {
      stats.set(code, {
        code,
        name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        pts: 0,
        deduction: 0,
      });
    }
    return stats.get(code);
  };

  for (const f of fixtures) {
    const h = row(f.homeCode, f.homeName);
    const a = row(f.awayCode, f.awayName);
    const hg = Number(f.homeScore);
    const ag = Number(f.awayScore);
    h.played += 1;
    a.played += 1;
    h.gf += hg;
    h.ga += ag;
    a.gf += ag;
    a.ga += hg;
    if (hg > ag) {
      h.won += 1;
      a.lost += 1;
      h.pts += 3;
    } else if (hg < ag) {
      a.won += 1;
      h.lost += 1;
      a.pts += 3;
    } else {
      h.drawn += 1;
      a.drawn += 1;
      h.pts += 1;
      a.pts += 1;
    }
  }

  for (const [code, ded] of Object.entries(deductions)) {
    const r = stats.get(code);
    if (r) {
      r.pts -= ded;
      r.deduction = ded;
    }
  }

  for (const r of stats.values()) {
    r.gd = r.gf - r.ga;
  }

  const ordered = [...stats.values()].sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
  );
  ordered.forEach((r, i) => {
    r.position = i + 1;
  });
  return ordered;
}

function main() {
  const files = fs.readdirSync(DATA_SEASONS).filter((f) => f.endsWith('.json')).sort();
  fs.mkdirSync(APP_SEASONS, { recursive: true });

  for (const file of files) {
    const dataPath = path.join(DATA_SEASONS, file);
    const pack = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const deductions = DEDUCTIONS[pack.seasonKey] ?? {};
    pack.table = buildTable(pack.fixtures, deductions);
    pack.tableSource = 'derived-from-fixtures';
    if (Object.keys(deductions).length) pack.pointDeductions = deductions;
    else delete pack.pointDeductions;

    const json = `${JSON.stringify(pack)}\n`;
    fs.writeFileSync(dataPath, json);
    fs.writeFileSync(path.join(APP_SEASONS, file), json);
    const champ = pack.table[0];
    console.log(
      `${pack.seasonKey} ${pack.seasonLabel}: ${pack.table.length} teams · 1st ${champ.code} (${champ.pts} pts)`
    );
  }

  console.log(`\nUpdated ${files.length} season packs (+ app copy).`);
}

main();
