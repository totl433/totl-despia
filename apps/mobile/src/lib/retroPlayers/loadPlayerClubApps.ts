import { supabase } from '../supabase';
import type { ClubSpell, PlayerClubApp } from './seedApps';

type SpellJson = {
  firstSeason?: string;
  lastSeason?: string;
  appearances?: number;
};

type PlayerClubRow = {
  player_name: string;
  player_key: string;
  club_code: string;
  club_name: string;
  appearances: number;
  first_season: string | null;
  last_season: string | null;
  spells: SpellJson[] | null;
  wiki_views: number | null;
};

const PAGE_SIZE = 1000;

let cached: Promise<PlayerClubApp[]> | null = null;

/**
 * All checked Premier League club rows for The Players.
 * One read is reused until it fails.
 */
export function loadPlayerClubApps(): Promise<PlayerClubApp[]> {
  if (!cached) {
    cached = fetchAll().catch((error) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}

async function fetchAll(): Promise<PlayerClubApp[]> {
  const all: PlayerClubRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('retro_player_club_apps')
      .select(
        'player_name,player_key,club_code,club_name,appearances,first_season,last_season,spells,wiki_views'
      )
      .order('player_key', { ascending: true })
      .order('club_code', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as PlayerClubRow[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  if (all.length === 0) {
    throw new Error('retro_player_club_apps is empty');
  }
  return all.map(mapRow);
}

function mapRow(row: PlayerClubRow): PlayerClubApp {
  const spells: ClubSpell[] = Array.isArray(row.spells)
    ? row.spells
        .filter((s) => (s.appearances ?? 0) > 0)
        .map((s) => ({
          firstSeason: s.firstSeason,
          lastSeason: s.lastSeason,
          appearances: s.appearances ?? 0,
        }))
    : [];
  const fallback: ClubSpell[] = spells.length
    ? spells
    : [
        {
          firstSeason: row.first_season ?? undefined,
          lastSeason: row.last_season ?? undefined,
          appearances: row.appearances,
        },
      ];
  return {
    playerName: row.player_name,
    playerKey: row.player_key,
    clubCode: row.club_code,
    clubName: row.club_name,
    appearances: row.appearances,
    wikiViews: row.wiki_views ?? undefined,
    firstSeason: row.first_season ?? undefined,
    lastSeason: row.last_season ?? undefined,
    spells: fallback,
  };
}
