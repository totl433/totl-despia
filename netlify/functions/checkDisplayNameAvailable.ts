import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: JSON.stringify(body),
  }
}

function normalizeDisplayName(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

function hasSqlLikeWildcards(input: string): boolean {
  // We use ILIKE for case-insensitive matching; disallow wildcard characters
  // to avoid pattern-matching surprises.
  return input.includes('%') || input.includes('_')
}

// POST body: { displayName: string } (also accepts { name: string })
// Returns: { available: boolean, message?: string }
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, {})
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' })

  const SUPABASE_URL = process.env.SUPABASE_URL as string
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' })
  }

  let payload: unknown
  try {
    payload = event.body ? JSON.parse(event.body) : {}
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const rawName =
    (payload as { displayName?: unknown; name?: unknown } | null)?.displayName ??
    (payload as { displayName?: unknown; name?: unknown } | null)?.name

  if (typeof rawName !== 'string') {
    return json(400, { error: 'displayName is required' })
  }

  const displayName = normalizeDisplayName(rawName)
  if (!displayName) return json(400, { error: 'displayName cannot be empty' })
  if (hasSqlLikeWildcards(displayName)) {
    return json(400, { error: 'displayName contains invalid characters' })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // Case-insensitive exact match (ILIKE) after disallowing wildcard chars.
    const { data, error } = await admin
      .from('users')
      .select('id')
      .ilike('name', displayName)
      .limit(1)

    if (error) {
      console.error('[checkDisplayNameAvailable] Error checking public.users:', error)
      return json(500, { error: 'Failed to check display name availability' })
    }

    if (data && data.length > 0) {
      return json(200, {
        available: false,
        message: 'That display name is already in use. Please choose a different name.',
      })
    }

    return json(200, { available: true })
  } catch (error: any) {
    console.error('[checkDisplayNameAvailable] Unexpected error:', error)
    return json(500, { error: 'Failed to check display name availability', details: error.message })
  }
}

