/**
 * Fill public.retro_player_club_apps from the checked list.
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Run: npx tsx scripts/seedRetroPlayerClubApps.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { playerKeyFromName, VERIFIED_PLAYER_CLUB_SPELLS } from '../src/lib/retroPlayers/verifiedApps';

type Spell = {
  firstSeason: string;
  lastSeason: string;
  appearances: number;
  sources: string[];
};

type Row = {
  player_name: string;
  player_key: string;
  club_code: string;
  club_name: string;
  appearances: number;
  first_season: string;
  last_season: string;
  spells: Spell[];
  source: 'verified';
};

function loadEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    env[line.slice(0, i)] = line.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return env;
}

function parseSeasonStart(season: string): number | null {
  const m = String(season || '')
    .trim()
    .match(/^(\d{2,4})\s*\/\s*(\d{2})$/);
  if (!m) return null;
  let y = Number(m[1]);
  if (y < 100) y += y >= 50 ? 1900 : 2000;
  return y;
}

function buildRows(): Row[] {
  const map = new Map<string, Row>();
  for (const r of VERIFIED_PLAYER_CLUB_SPELLS) {
    if (!r.appearances || r.appearances <= 0) continue;
    if (!r.clubCode || r.clubCode.length > 3) continue;
    const playerKey = playerKeyFromName(r.playerName);
    const key = `${playerKey}::${r.clubCode}`;
    const spell: Spell = {
      firstSeason: r.firstSeason,
      lastSeason: r.lastSeason,
      appearances: r.appearances,
      sources: [...r.sources],
    };
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        player_name: r.playerName,
        player_key: playerKey,
        club_code: r.clubCode,
        club_name: r.clubName,
        appearances: r.appearances,
        first_season: r.firstSeason,
        last_season: r.lastSeason,
        spells: [spell],
        source: 'verified',
      });
      continue;
    }
    const dup = prev.spells.find(
      (s) => s.firstSeason === spell.firstSeason && s.lastSeason === spell.lastSeason
    );
    if (dup) {
      if (spell.appearances > dup.appearances) dup.appearances = spell.appearances;
      for (const url of spell.sources) {
        if (!dup.sources.includes(url)) dup.sources.push(url);
      }
    } else {
      prev.spells.push(spell);
    }
  }

  return Array.from(map.values()).map((row) => {
    const spells = [...row.spells].sort((a, b) => {
      const ay = parseSeasonStart(a.firstSeason || a.lastSeason);
      const by = parseSeasonStart(b.firstSeason || b.lastSeason);
      return (ay ?? 0) - (by ?? 0);
    });
    return {
      ...row,
      spells,
      first_season: spells[0]?.firstSeason ?? row.first_season,
      last_season: spells[spells.length - 1]?.lastSeason ?? row.last_season,
      appearances: spells.reduce((sum, s) => sum + s.appearances, 0),
    };
  });
}

async function main() {
  const env = loadEnv(resolve(process.cwd(), '.env.local'));
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

  const rows = buildRows();
  const players = new Set(rows.map((r) => r.player_key));
  console.log(`rows ${rows.length} players ${players.size}`);

  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/retro_player_club_apps?on_conflict=player_key,club_code`;
  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`batch ${i} failed ${res.status} ${text.slice(0, 400)}`);
    }
    console.log(`wrote ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
