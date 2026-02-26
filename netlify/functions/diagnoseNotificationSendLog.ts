import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Diagnostics endpoint for recent notification_send_log activity.
 *
 * Usage:
 *   GET /.netlify/functions/diagnoseNotificationSendLog?days=14&keys=new-gameweek,gameweek-complete
 *
 * Notes:
 * - Returns aggregated counts only (no user IDs), but is still intended for internal debugging.
 * - Uses a capped row scan to avoid huge responses.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }

  const daysRaw = event.queryStringParameters?.days;
  const days = Math.max(1, Math.min(60, Number(daysRaw || 14) || 14));

  const keysRaw = (event.queryStringParameters?.keys || '').trim();
  const keys =
    keysRaw.length > 0
      ? keysRaw.split(',').map(k => k.trim()).filter(Boolean)
      : ['new-gameweek', 'gameweek-complete'];

  const MAX_ROWS = 5000;
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { data, error } = await supabase
      .from('notification_send_log')
      .select('notification_key,result,created_at')
      .in('notification_key', keys)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS);

    if (error) {
      return json(500, { error: 'Failed to query notification_send_log', details: error.message });
    }

    const rows = data || [];
    const truncated = rows.length >= MAX_ROWS;

    const countsByKey: Record<string, Record<string, number>> = {};
    const countsByResult: Record<string, number> = {};

    for (const row of rows as Array<{ notification_key: string; result: string | null }>) {
      const k = row.notification_key || 'unknown';
      const r = row.result || 'unknown';

      countsByKey[k] ||= {};
      countsByKey[k][r] = (countsByKey[k][r] || 0) + 1;
      countsByResult[r] = (countsByResult[r] || 0) + 1;
    }

    return json(200, {
      ok: true,
      since: sinceIso,
      days,
      keys,
      scanned_rows: rows.length,
      truncated,
      max_rows: MAX_ROWS,
      counts_by_key: countsByKey,
      counts_by_result: countsByResult,
    });
  } catch (e: any) {
    return json(500, { error: e?.message || 'Internal error' });
  }
};

