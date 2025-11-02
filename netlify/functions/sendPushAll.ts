import type { Handler } from '@netlify/functions'

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' })

  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID as string
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY as string
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
  const { title, message, data } = payload || {}
  if (!title || !message) return json(400, { error: 'Missing title or message' })

  try {
    const resp = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,   // CRITICAL
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,               // CRITICAL
        included_segments: ['Subscribed Users'],
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