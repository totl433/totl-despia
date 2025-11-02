import type { Handler } from '@netlify/functions';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export const handler: Handler = async (event) => {
  const q = new URL(event.rawUrl).searchParams;
  if (q.get('debug') === '1') {
    return json(200, {
      endpoint: 'https://onesignal.com/api/v1/notifications',
      appIdPreview: (process.env.ONESIGNAL_APP_ID || '').slice(0, 8) + '…',
      authPreview: 'Basic ' + (process.env.ONESIGNAL_REST_API_KEY || '').slice(0, 4) + '…',
    })
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const playerIds: string[] = body.playerIds || [];
    const title: string = body.title || 'Notification';
    const message: string = body.message || '';

    const appId = process.env.ONESIGNAL_APP_ID;
    const restKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!appId || !restKey) return json(500, { error: 'Missing OneSignal env vars' })

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${restKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: playerIds,
        headings: { en: title },
        contents: { en: message },
      }),
    });

    const one = await res.json().catch(() => ({}));
    if (!res.ok) return json(res.status, { error: 'OneSignal error', status: res.status, body: one })
    return json(200, { ok: true, result: one })
  } catch (e: any) {
    return json(500, { error: e?.message || 'unknown' })
  }
};
