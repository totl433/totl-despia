import { supabase } from './supabase';

export type UserSearchHit = { id: string; name: string; avatarUrl: string | null };

function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, '');
}

/**
 * Players matching a username, from public.users — same table as Choose username.
 * Does not go through the BFF, so a stale deploy cannot hide people who exist.
 */
export async function searchUsersByName(query: string): Promise<UserSearchHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const needle = escapeIlike(q);
  const { data, error } = await supabase.from('users').select('id, name, avatar_url').ilike('name', `%${needle}%`).limit(8);
  if (error) {
    const fallback = await supabase.from('users').select('id, name').ilike('name', `%${needle}%`).limit(8);
    if (fallback.error) throw fallback.error;
    return mapHits(fallback.data);
  }
  return mapHits(data);
}

function mapHits(rows: Array<{ id?: string; name?: string | null; avatar_url?: string | null }> | null): UserSearchHit[] {
  return (rows ?? [])
    .filter((row) => typeof row.id === 'string' && typeof row.name === 'string' && row.name.trim())
    .map((row) => ({
      id: String(row.id),
      name: String(row.name).trim(),
      avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    }));
}
