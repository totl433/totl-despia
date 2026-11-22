import type { SupabaseClient } from '@supabase/supabase-js';
import type { ShootoutCatalogRow } from '@totl/domain';

/** The Players catalogue for Shootout cards. Dealing lives in @totl/domain (playersShootoutDeck). */

type Spell = ShootoutCatalogRow['spells'][number];

const CATALOG_TTL_MS = 60 * 60 * 1000;
let catalogCache: { at: number; rows: Promise<ShootoutCatalogRow[]> } | null = null;

/** Every checked club row, read once an hour. */
export function loadShootoutCatalog(admin: SupabaseClient): Promise<ShootoutCatalogRow[]> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.rows;
  const rows = fetchCatalog(admin).catch((error) => {
    catalogCache = null;
    throw error;
  });
  catalogCache = { at: Date.now(), rows };
  return rows;
}

async function fetchCatalog(admin: SupabaseClient): Promise<ShootoutCatalogRow[]> {
  const pageSize = 1000;
  const out: ShootoutCatalogRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from('retro_player_club_apps')
      .select('player_name,player_key,club_code,club_name,appearances,first_season,last_season,spells,wiki_views')
      .order('player_key', { ascending: true })
      .order('club_code', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as any[];
    for (const row of batch) {
      const spells: Spell[] = Array.isArray(row.spells)
        ? row.spells
            .filter((s: any) => (s?.appearances ?? 0) > 0)
            .map((s: any) => ({ firstSeason: s.firstSeason, lastSeason: s.lastSeason, appearances: s.appearances ?? 0 }))
        : [];
      out.push({
        playerName: String(row.player_name),
        playerKey: String(row.player_key),
        clubCode: String(row.club_code),
        clubName: String(row.club_name),
        appearances: Number(row.appearances) || 0,
        wikiViews: Number(row.wiki_views) || 0,
        firstSeason: row.first_season ?? undefined,
        lastSeason: row.last_season ?? undefined,
        spells,
      });
    }
    if (batch.length < pageSize) break;
  }
  if (!out.length) throw new Error('retro_player_club_apps is empty');
  return out;
}
