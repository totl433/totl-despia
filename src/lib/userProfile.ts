import { supabase } from './supabase';

function normalizeDisplayName(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

function hasSqlLikeWildcards(input: string): boolean {
  return input.includes('%') || input.includes('_');
}

export async function checkDisplayNameAvailable(
  displayName: string,
  exceptUserId?: string
): Promise<boolean> {
  const trimmed = normalizeDisplayName(displayName);
  if (!trimmed) return false;

  let query = supabase.from('users').select('id').ilike('name', trimmed).limit(1);
  if (exceptUserId) query = query.neq('id', exceptUserId);
  const { data, error } = await query;
  if (error) throw error;
  if (data && data.length > 0) return false;

  try {
    const response = await fetch('/.netlify/functions/checkDisplayNameAvailable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: trimmed }),
    });
    if (response.ok) {
      const result = (await response.json()) as { available?: boolean };
      return result.available !== false;
    }
  } catch {
    // Direct profile check above is the source of truth.
  }

  return true;
}

export async function saveUsername(userId: string, rawName: string): Promise<string> {
  const name = normalizeDisplayName(rawName);
  if (!name) throw new Error('Display name is required.');
  if (hasSqlLikeWildcards(name)) {
    throw new Error('Display name contains invalid characters. Please remove % or _.');
  }
  const available = await checkDisplayNameAvailable(name, userId);
  if (!available) {
    throw new Error('Username already taken. Please choose a different name.');
  }
  const { error: upsertError } = await supabase.from('users').upsert({ id: userId, name }, { onConflict: 'id' });
  if (upsertError) {
    const msg = (upsertError.message || '').toLowerCase();
    if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) {
      throw new Error('Username already taken. Please choose a different name.');
    }
    throw upsertError;
  }
  await supabase.auth.updateUser({ data: { display_name: name } });
  return name;
}

export async function resolveProfileStatus(userId: string): Promise<'ready' | 'needs-username'> {
  const { data: profile, error } = await supabase.from('users').select('name').eq('id', userId).maybeSingle();
  if (error) throw error;
  const existingName = typeof profile?.name === 'string' ? normalizeDisplayName(profile.name) : '';
  if (existingName) return 'ready';

  const { data: auth } = await supabase.auth.getUser();
  const metaName =
    typeof auth.user?.user_metadata?.display_name === 'string'
      ? normalizeDisplayName(auth.user.user_metadata.display_name)
      : '';
  if (!metaName) return 'needs-username';

  try {
    await saveUsername(userId, metaName);
    return 'ready';
  } catch {
    return 'needs-username';
  }
}
