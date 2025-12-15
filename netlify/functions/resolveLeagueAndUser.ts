import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

// POST body: { leagueName?: string, leagueCode?: string, userName?: string, userEmail?: string }
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' })

  const SUPABASE_URL = process.env.SUPABASE_URL as string
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: 'Missing Supabase environment variables' })

  let payload: any
  try { payload = event.body ? JSON.parse(event.body) : {} } catch { return json(400, { error: 'Invalid JSON body' }) }
  const { leagueName, leagueCode, userName, userEmail } = payload || {}
  if (!leagueName && !leagueCode) return json(400, { error: 'Provide leagueName or leagueCode' })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Resolve league
  let leagueId: string | null = null
  if (leagueCode) {
    const { data, error } = await admin.from('leagues').select('id,name,code').eq('code', leagueCode).maybeSingle()
    if (error) return json(500, { error: 'Failed to resolve league by code', details: error.message })
    leagueId = (data as any)?.id ?? null
  } else if (leagueName) {
    const { data, error } = await admin.from('leagues').select('id,name,code').ilike('name', leagueName).limit(5)
    if (error) return json(500, { error: 'Failed to search leagues by name', details: error.message })
    if ((data ?? []).length === 0) return json(404, { error: 'League not found', matches: [] })
    if ((data ?? []).length > 1) return json(409, { error: 'Multiple leagues matched name', matches: data })
    leagueId = (data as any)[0]?.id ?? null
  }
  if (!leagueId) return json(404, { error: 'League not found' })

  // Resolve user
  let userRow: any = null
  if (userEmail) {
    const { data, error } = await admin.from('users').select('id,name,email').eq('email', userEmail).maybeSingle()
    if (error) return json(500, { error: 'Failed to resolve user by email', details: error.message })
    userRow = data
  } else if (userName) {
    const { data, error } = await admin.from('users').select('id,name,email,created_at').ilike('name', userName).order('created_at', { ascending: false }).limit(5)
    if (error) return json(500, { error: 'Failed to search users by name', details: error.message })
    if ((data ?? []).length === 0) return json(404, { error: 'User not found', matches: [] })
    if ((data ?? []).length > 1) return json(409, { error: 'Multiple users matched name', matches: data })
    userRow = (data as any)[0]
  } else {
    return json(400, { error: 'Provide userName or userEmail' })
  }

  const senderId: string | undefined = userRow?.id
  if (!senderId) return json(404, { error: 'User not found' })

  // Optional: verify membership
  const { data: member, error: memErr } = await admin
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId)
    .eq('user_id', senderId)
    .maybeSingle()
  if (memErr) return json(500, { error: 'Failed to verify membership', details: memErr.message })

  return json(200, {
    ok: true,
    leagueId,
    senderId,
    user: userRow,
    isMember: Boolean(member)
  })
}


