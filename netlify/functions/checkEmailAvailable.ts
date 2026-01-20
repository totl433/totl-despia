import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

function json(statusCode: number, body: unknown) {
  return { 
    statusCode, 
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }, 
    body: JSON.stringify(body) 
  }
}

async function emailExistsViaAuthSchema(admin: ReturnType<typeof createClient>, trimmedEmail: string) {
  // Some Supabase projects do not expose the `auth` schema via PostgREST.
  // If this fails, callers should fall back to the GoTrue Admin API approach.
  try {
    const { data, error } = await admin
      .schema('auth')
      .from('users')
      .select('id')
      .eq('email', trimmedEmail)
      .limit(1)
      .maybeSingle()

    if (error) return { ok: false as const, error }
    return { ok: true as const, exists: !!data?.id }
  } catch (error: any) {
    return { ok: false as const, error }
  }
}

// POST body: { email: string }
// Returns: { available: boolean, message?: string }
export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return json(200, {});
  }
  
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' })

  const SUPABASE_URL = process.env.SUPABASE_URL as string
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' })
  }

  let payload: any
  try {
    payload = event.body ? JSON.parse(event.body) : {}
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const { email } = payload || {}
  if (!email || typeof email !== 'string') {
    return json(400, { error: 'Email is required' })
  }

  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail) {
    return json(400, { error: 'Email cannot be empty' })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // Prefer an efficient DB lookup if the `auth` schema is exposed.
    const authSchemaLookup = await emailExistsViaAuthSchema(admin, trimmedEmail)
    if (authSchemaLookup.ok) {
      if (authSchemaLookup.exists) {
        return json(200, {
          available: false,
          message: 'This email is already registered. Please sign in instead.',
        })
      }
      return json(200, { available: true })
    }
    
    // Fallback: GoTrue Admin API listUsers (paginated)
    // Note: this is heavier, but works even when `auth` schema isn't exposed to PostgREST.
    let page = 1
    const pageSize = 1000

    while (true) {
      const { data: usersData, error: authError } = await admin.auth.admin.listUsers({
        page,
        perPage: pageSize
      });

      if (authError) {
        console.error('[checkEmailAvailable] Error checking auth users via listUsers:', authError)
        return json(500, { error: 'Failed to check email availability' })
      }
      
      if (!usersData?.users || usersData.users.length === 0) {
        break; // No more users
      }

      // Check if email exists in this page (case-insensitive)
      const existingUser = usersData.users.find((u: any) => {
        const userEmail = u.email?.toLowerCase();
        const match = userEmail === trimmedEmail.toLowerCase();
        return match;
      });
      
      if (existingUser) {
        return json(200, { available: false, message: 'This email is already registered. Please sign in instead.' })
      }
      
      // Check if there are more pages
      const totalUsers = usersData.total || usersData.users.length;
      const currentPageCount = page * pageSize;
      if (currentPageCount >= totalUsers || usersData.users.length < pageSize) {
        break; // No more pages
      }
      
      page++;
    }

    // Email is available (not found)
    return json(200, { available: true })
  } catch (error: any) {
    console.error('[checkEmailAvailable] Unexpected error:', error)
    return json(500, { error: 'Failed to check email availability', details: error.message })
  }
}

