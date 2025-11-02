import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' })

  const SUPABASE_URL = process.env.SUPABASE_URL as string
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string
  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID as string
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY as string

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: 'Missing Supabase environment variables' })
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) return json(500, { error: 'Missing OneSignal environment variables' })

  // Optional debug
  if (event.queryStringParameters?.debug === '1') {
    return json(200, {
      appId: (ONESIGNAL_APP_ID || '').slice(0, 8) + '…',
      authHeader: 'Basic ' + (ONESIGNAL_REST_API_KEY || '').slice(0, 4) + '…'
    })
  }

  let payload: any
  try { payload = event.body ? JSON.parse(event.body) : {} } catch { return json(400, { error: 'Invalid JSON body' }) }

  const { userIds, playerIds: rawPlayerIds, title, message, data } = payload || {}
  if (!title || !message) return json(400, { error: 'Missing title or message' })

  const playerIds: string[] = Array.isArray(rawPlayerIds) ? rawPlayerIds.filter(Boolean) : []
  let includePlayerIds = [...playerIds]

  if (Array.isArray(userIds) && userIds.length > 0) {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: rows, error } = await admin
      .from('push_subscriptions')
      .select('player_id')
      .in('user_id', userIds)
      .eq('is_active', true)

    if (error) return json(500, { error: 'Failed to fetch player IDs', details: error.message })
    includePlayerIds.push(...(rows || []).map((r: any) => r.player_id).filter(Boolean))
  }

  includePlayerIds = Array.from(new Set(includePlayerIds))
  if (includePlayerIds.length === 0) return json(400, { error: 'No target player IDs found' })

  try {
    const resp = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // CRITICAL: Always Basic <REST API KEY>
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,                 // CRITICAL: app_id must be in the body
        include_player_ids: includePlayerIds,
        headings: { en: title },
        contents: { en: message },
        data: data ?? undefined,
      }),
    })

    const body = await resp.json().catch(() => ({}))
    if (!resp.ok) return json(resp.status, { error: 'OneSignal error', details: body })
    return json(200, { ok: true, result: body })
  } catch (e: any) {
    return json(500, { error: 'Failed to send notification', details: e?.message || String(e) })
  }
}