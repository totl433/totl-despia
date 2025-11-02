// netlify/functions/sendPush.ts
import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  // --- debug view to confirm what the function is using after deploy ---
  const q = new URL(event.rawUrl).searchParams;
  if (q.get('debug') === '1') {
    return new Response(
      JSON.stringify({
        endpoint: 'https://onesignal.com/api/v1/notifications',
        appIdPreview: (process.env.ONESIGNAL_APP_ID || '').slice(0, 8) + '…',
        authPreview:
          'Basic ' + (process.env.ONESIGNAL_REST_API_KEY || '').slice(0, 4) + '…',
        hasBasicPrefix: !!(`Basic ${process.env.ONESIGNAL_REST_API_KEY || ''}`.startsWith('Basic ')),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const playerIds: string[] = body.playerIds || [];
    const title: string = body.title || 'Notification';
    const message: string = body.message || '';

    const appId = process.env.ONESIGNAL_APP_ID;
    const restKey = process.env.ONESIGNAL_REST_API_KEY;
    if (!appId || !restKey) {
      return new Response(JSON.stringify({ error: 'Missing OneSignal env vars' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${restKey}`,         // << critical
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,                              // << required in body
        include_player_ids: playerIds,
        headings: { en: title },
        contents: { en: message },
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: 'OneSignal error', status: res.status, body: json }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ ok: true, result: json }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export default {};
