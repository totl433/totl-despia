import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export const handler: Handler = async (event) => {
  // #region agent log
  await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'notifyLeagueMessage.ts:handler:entry',
      message: 'Function invoked',
      data: { method: event.httpMethod, hasBody: !!event.body },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H1'
    })
  }).catch(() => {});
  // #endregion

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || '').trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || '').trim();
  
  // Get base URL for constructing full deep link URLs (OneSignal requires full URLs)
  // Try to get from event headers, fallback to environment variable or default
  const getBaseUrl = () => {
    // Try to extract from event headers
    if (event.headers.host) {
      const protocol = event.headers['x-forwarded-proto'] || 'https';
      const url = `${protocol}://${event.headers.host}`;
      console.log(`[notifyLeagueMessage] Base URL from headers: ${url} (host: ${event.headers.host}, proto: ${protocol})`);
      return url;
    }
    // Fallback to environment variable
    if (process.env.URL || process.env.SITE_URL) {
      const url = (process.env.URL || process.env.SITE_URL || '').trim();
      console.log(`[notifyLeagueMessage] Base URL from env: ${url}`);
      return url;
    }
    // Default fallback (shouldn't happen in production)
    const defaultUrl = 'https://totl-staging.netlify.app';
    console.warn(`[notifyLeagueMessage] Base URL using default fallback: ${defaultUrl}`);
    return defaultUrl;
  };
  const baseUrl = getBaseUrl();
  
  // #region agent log
  await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'notifyLeagueMessage.ts:handler:base-url-construction',
      message: 'Base URL constructed',
      data: {
        baseUrl,
        hasHost: !!event.headers.host,
        host: event.headers.host,
        protocol: event.headers['x-forwarded-proto'],
        hasEnvUrl: !!process.env.URL,
        envUrl: process.env.URL,
        hasEnvSiteUrl: !!process.env.SITE_URL,
        envSiteUrl: process.env.SITE_URL
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H5'
    })
  }).catch(() => {});
  // #endregion

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Missing Supabase environment variables' });
  }
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return json(500, { error: 'Missing OneSignal environment variables' });
  }

  let payload: any;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'notifyLeagueMessage.ts:handler:payload-parsed',
        message: 'Payload parsed successfully',
        data: {
          leagueId: payload?.leagueId,
          senderId: payload?.senderId,
          hasContent: !!payload?.content,
          activeUserIdsCount: Array.isArray(payload?.activeUserIds) ? payload.activeUserIds.length : 0,
          activeUserIds: payload?.activeUserIds
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H2'
      })
    }).catch(() => {});
    // #endregion
  } catch (e) {
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'notifyLeagueMessage.ts:handler:payload-error',
        message: 'Failed to parse payload',
        data: { error: String(e) },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H2'
      })
    }).catch(() => {});
    // #endregion
    return json(400, { error: 'Invalid JSON body' });
  }
  
  const { leagueId, senderId, senderName, content, activeUserIds } = payload || {};
  if (!leagueId || !senderId || !content) {
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'notifyLeagueMessage.ts:handler:missing-fields',
        message: 'Missing required fields',
        data: { hasLeagueId: !!leagueId, hasSenderId: !!senderId, hasContent: !!content },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H2'
      })
    }).catch(() => {});
    // #endregion
    return json(400, { error: 'Missing leagueId, senderId, or content' });
  }

  // Optional auth: if Authorization Bearer provided, must match senderId
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : undefined;
  if (token) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || data.user?.id !== senderId) return json(401, { error: 'Unauthorized' });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get league code for deep linking (REQUIRED for notifications to work)
  let leagueCode: string | undefined;
  let leagueUrl: string | undefined;
  let leagueCodeError: any = null;
  try {
    const { data: leagueData, error: leagueErr } = await admin
      .from('leagues')
      .select('code')
      .eq('id', leagueId)
      .single();
    
    if (leagueErr) {
      leagueCodeError = leagueErr;
      console.error('[notifyLeagueMessage] Failed to load league code:', leagueErr);
      // Don't fail the notification, but log the error
    } else if (leagueData?.code) {
      leagueCode = leagueData.code;
      // Construct full URL (OneSignal requires http:// or https://)
      leagueUrl = `${baseUrl}/league/${leagueCode}?tab=chat`;
      console.log(`[notifyLeagueMessage] League code loaded: ${leagueCode}, URL: ${leagueUrl}`);
    } else {
      console.warn(`[notifyLeagueMessage] League code not found for leagueId: ${leagueId} (data: ${JSON.stringify(leagueData)})`);
    }
  } catch (e) {
    leagueCodeError = e;
    console.error('[notifyLeagueMessage] Error getting league code:', e);
  }
  
  // #region agent log
  await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'notifyLeagueMessage.ts:handler:league-code-query',
      message: 'League code query result',
      data: {
        leagueId,
        leagueCode,
        leagueUrl,
        hasError: !!leagueCodeError,
        error: leagueCodeError?.message || leagueCodeError?.code,
        baseUrl
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H5'
    })
  }).catch(() => {});
  // #endregion

  // Get current league members
  const { data: members, error: memErr } = await admin
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId);

  if (memErr) {
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'notifyLeagueMessage.ts:handler:members-error',
        message: 'Failed to load members',
        data: { error: memErr.message, code: memErr.code },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H4'
      })
    }).catch(() => {});
    // #endregion
    return json(500, { error: 'Failed to load members', details: memErr.message });
  }
  const totalMembers = (members ?? []).length;
  console.log(`[notifyLeagueMessage] Total league members: ${totalMembers}`);
  
  let recipientIds = new Set<string>((members ?? []).map((r: any) => r.user_id).filter(Boolean));
  const beforeExclusions = recipientIds.size;
  
  // #region agent log
  await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'notifyLeagueMessage.ts:handler:before-exclusions',
      message: 'Recipients before exclusions',
      data: { totalMembers, beforeExclusions, memberIds: Array.from(recipientIds) },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H2'
    })
  }).catch(() => {});
  // #endregion

  // Exclude sender
  recipientIds.delete(senderId);
  const afterSenderExclusion = recipientIds.size;
  console.log(`[notifyLeagueMessage] After excluding sender: ${afterSenderExclusion} recipients (excluded ${beforeExclusions - afterSenderExclusion})`);
  
  // #region agent log
  await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'notifyLeagueMessage.ts:handler:after-sender-exclusion',
      message: 'After excluding sender',
      data: { afterSenderExclusion, excluded: beforeExclusions - afterSenderExclusion },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H2'
    })
  }).catch(() => {});
  // #endregion

  // Exclude muted
  const { data: mutes, error: muteErr } = await admin
    .from('league_notification_settings')
    .select('user_id, muted')
    .eq('league_id', leagueId)
    .eq('muted', true);

  if (muteErr) {
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'notifyLeagueMessage.ts:handler:mutes-error',
        message: 'Failed to load mutes',
        data: { error: muteErr.message, code: muteErr.code },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H4'
      })
    }).catch(() => {});
    // #endregion
    return json(500, { error: 'Failed to load mutes', details: muteErr.message });
  }
  const mutedCount = (mutes ?? []).length;
  const mutedUserIds = (mutes ?? []).map((r: any) => r.user_id);
  for (const row of (mutes ?? [])) recipientIds.delete(row.user_id);
  const afterMuteExclusion = recipientIds.size;
  console.log(`[notifyLeagueMessage] After excluding ${mutedCount} muted users: ${afterMuteExclusion} recipients`);
  
  // #region agent log
  await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'notifyLeagueMessage.ts:handler:after-mute-exclusion',
      message: 'After excluding muted users',
      data: { mutedCount, mutedUserIds, afterMuteExclusion },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H2'
    })
  }).catch(() => {});
  // #endregion

  // Track exclusion values for logging
  let afterActiveExclusion: number | undefined;
  let afterPresenceExclusion: number | undefined;

  // Optional: exclude currently active chat users (if provided)
  if (Array.isArray(activeUserIds)) {
    const activeCount = activeUserIds.length;
    for (const uid of activeUserIds) recipientIds.delete(uid);
    afterActiveExclusion = recipientIds.size;
    console.log(`[notifyLeagueMessage] After excluding ${activeCount} active users: ${afterActiveExclusion} recipients`);
    
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'notifyLeagueMessage.ts:handler:after-active-exclusion',
        message: 'After excluding activeUserIds',
        data: { activeCount, activeUserIds, afterActiveExclusion },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H2'
      })
    }).catch(() => {});
    // #endregion
  }

  // Also exclude users who are actively viewing the chat (presence tracking)
  // Users are considered "active" if they've been seen in the last 30 seconds
  const presenceThreshold = new Date(Date.now() - 30000).toISOString();
  const { data: activeViewers, error: presenceErr } = await admin
    .from('chat_presence')
    .select('user_id, last_seen')
    .eq('league_id', leagueId)
    .gte('last_seen', presenceThreshold);
  
  // #region agent log
  await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'notifyLeagueMessage.ts:handler:presence-query',
      message: 'Presence query result',
      data: {
        hasError: !!presenceErr,
        error: presenceErr?.message,
        activeViewersCount: activeViewers?.length || 0,
        activeViewers: activeViewers?.map((v: any) => ({ user_id: v.user_id, last_seen: v.last_seen })),
        presenceThreshold,
        currentTime: new Date().toISOString()
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H1'
    })
  }).catch(() => {});
  // #endregion
  
  if (!presenceErr && activeViewers) {
    const presenceCount = activeViewers.length;
    const presenceUserIds = activeViewers.map((v: any) => v.user_id);
    for (const viewer of activeViewers) {
      recipientIds.delete(viewer.user_id);
    }
    afterPresenceExclusion = recipientIds.size;
    console.log(`[notifyLeagueMessage] After excluding ${presenceCount} active viewers (presence): ${afterPresenceExclusion} recipients`);
    
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'notifyLeagueMessage.ts:handler:after-presence-exclusion',
        message: 'After excluding presence viewers',
        data: { presenceCount, presenceUserIds, afterPresenceExclusion },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H1'
      })
    }).catch(() => {});
    // #endregion
  }

  if (recipientIds.size === 0) {
    console.log('[notifyLeagueMessage] No eligible recipients (all excluded: sender, muted, or active)');
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'notifyLeagueMessage.ts:handler:no-recipients',
        message: 'No eligible recipients after all exclusions',
        data: {
          beforeExclusions,
          afterSenderExclusion,
          afterMuteExclusion,
          afterActiveExclusion,
          afterPresenceExclusion
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H2'
      })
    }).catch(() => {});
    // #endregion
    return json(200, { ok: true, message: 'No eligible recipients' });
  }

  // Resolve player IDs
  const toIds = Array.from(recipientIds);
  console.log(`[notifyLeagueMessage] Looking up push subscriptions for ${toIds.length} recipient user IDs`);
  
  // #region agent log
  await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'notifyLeagueMessage.ts:handler:before-subscription-query',
      message: 'Before querying push subscriptions',
      data: { recipientCount: toIds.length, recipientIds: toIds },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H4'
    })
  }).catch(() => {});
  // #endregion
  
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('player_id, user_id')
    .in('user_id', toIds)
    .eq('is_active', true);

  if (subErr) {
    console.error('[notifyLeagueMessage] Failed to load subscriptions:', subErr);
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'notifyLeagueMessage.ts:handler:subscription-query-error',
        message: 'Failed to load subscriptions',
        data: { error: subErr.message, code: subErr.code, recipientIds: toIds },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H4'
      })
    }).catch(() => {});
    // #endregion
    return json(500, { error: 'Failed to load subscriptions', details: subErr.message });
  }
  
  const playerIds = Array.from(new Set((subs ?? []).map((s: any) => s.player_id).filter(Boolean)));
  console.log(`[notifyLeagueMessage] Found ${playerIds.length} active player IDs for ${toIds.length} recipients`);
  
  // #region agent log
  await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'notifyLeagueMessage.ts:handler:after-subscription-query',
      message: 'After querying push subscriptions',
      data: {
        subscriptionCount: subs?.length || 0,
        playerIdsCount: playerIds.length,
        recipientCount: toIds.length,
        subscriptions: subs?.map((s: any) => ({ user_id: s.user_id, hasPlayerId: !!s.player_id })),
        playerIds: playerIds.slice(0, 5) // First 5 for debugging
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H4'
    })
  }).catch(() => {});
  // #endregion
  
  if (playerIds.length === 0) {
    console.log('[notifyLeagueMessage] No registered devices found for recipients');
    // #region agent log
    await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'notifyLeagueMessage.ts:handler:no-player-ids',
        message: 'No player IDs found for recipients',
        data: { recipientCount: toIds.length, recipientIds: toIds, subscriptionCount: subs?.length || 0 },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H4'
      })
    }).catch(() => {});
    // #endregion
    return json(200, { ok: true, message: 'No devices' });
  }
  
  // Note: Having player IDs in database doesn't guarantee devices are subscribed in OneSignal
  // OneSignal may accept notifications but not deliver them if devices aren't subscribed
  // Check OneSignal dashboard or use Message History API to verify actual delivery

  // Build message: title = sender, body = content (trim to reasonable length)
  const title = senderName || 'New message';
  const message = String(content).slice(0, 180);
  
  console.log(`[notifyLeagueMessage] Sending notification to ${playerIds.length} devices:`, {
    leagueId,
    leagueCode,
    leagueUrl,
    senderId,
    senderName: title,
    messagePreview: message.slice(0, 50),
    playerIds: playerIds.slice(0, 3) // Log first 3 for debugging
  });

  // #region agent log
  await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'notifyLeagueMessage.ts:handler:before-payload-construction',
      message: 'Before building OneSignal payload',
      data: {
        leagueId,
        leagueCode,
        leagueUrl,
        baseUrl,
        hasLeagueUrl: !!leagueUrl,
        hasLeagueCode: !!leagueCode
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H5'
    })
  }).catch(() => {});
  // #endregion

  // Build OneSignal payload with deep link URL
  // iOS requires url and web_url at top level for deep linking
  const oneSignalPayload: Record<string, any> = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: playerIds,
    headings: { en: title },
    contents: { en: message },
    data: {
      type: 'league_message',
      leagueId,
      senderId,
      ...(leagueCode && { leagueCode }),
    },
  };
  
  // Add URL for deep linking (iOS needs web_url, NOT url - they conflict)
  let finalDeepLinkUrl: string | undefined;
  if (leagueUrl) {
    oneSignalPayload.web_url = leagueUrl;
    finalDeepLinkUrl = leagueUrl;
    console.log(`[notifyLeagueMessage] Deep link URL set from leagueUrl: ${leagueUrl}`);
  } else if (leagueCode) {
    // Fallback: construct full URL from code if leagueUrl wasn't set
    const fallbackUrl = `${baseUrl}/league/${leagueCode}?tab=chat`;
    oneSignalPayload.web_url = fallbackUrl;
    finalDeepLinkUrl = fallbackUrl;
    console.log(`[notifyLeagueMessage] Deep link URL set from fallback: ${fallbackUrl}`);
  } else {
    console.warn(`[notifyLeagueMessage] No deep link URL set - missing both leagueUrl and leagueCode`);
  }
  
  console.log(`[notifyLeagueMessage] Final OneSignal payload web_url:`, oneSignalPayload.web_url);
  console.log(`[notifyLeagueMessage] OneSignal payload data:`, JSON.stringify(oneSignalPayload.data, null, 2));
  
  // #region agent log
  await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'notifyLeagueMessage.ts:handler:after-payload-construction',
      message: 'OneSignal payload constructed with deep link',
      data: {
        hasWebUrl: !!oneSignalPayload.web_url,
        webUrl: oneSignalPayload.web_url,
        finalDeepLinkUrl,
        payloadData: oneSignalPayload.data,
        payloadKeys: Object.keys(oneSignalPayload)
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H5'
    })
  }).catch(() => {});
  // #endregion

  // Try v1 API first (returns recipients count), then v2 API (faster but less info)
  // v1 API uses Basic auth, v2 API uses Bearer auth
  const isV2 = ONESIGNAL_REST_API_KEY.startsWith('os_');
  const endpoints = isV2
    ? ['https://onesignal.com/api/v1/notifications', 'https://api.onesignal.com/notifications']
    : ['https://onesignal.com/api/v1/notifications', 'https://api.onesignal.com/notifications'];
  const headersList = isV2
    ? [`Basic ${ONESIGNAL_REST_API_KEY}`, `Bearer ${ONESIGNAL_REST_API_KEY}`, ONESIGNAL_REST_API_KEY]
    : [`Basic ${ONESIGNAL_REST_API_KEY}`, `Bearer ${ONESIGNAL_REST_API_KEY}`, ONESIGNAL_REST_API_KEY];

  // Log final payload before sending
  console.log(`[notifyLeagueMessage] Final payload being sent to OneSignal:`, JSON.stringify({
    ...oneSignalPayload,
    include_player_ids: `[${playerIds.length} player IDs]` // Don't log all player IDs
  }, null, 2));
  console.log(`[notifyLeagueMessage] Payload has web_url: ${!!oneSignalPayload.web_url}, value: ${oneSignalPayload.web_url || 'MISSING'}`);
  
  let lastResp: any = null;
  let attemptCount = 0;
  for (const endpoint of endpoints) {
    for (const auth of headersList) {
      attemptCount++;
      const authType = auth.startsWith('Bearer') ? 'Bearer' : auth.startsWith('Basic') ? 'Basic' : 'Raw';
      console.log(`[notifyLeagueMessage] Attempting OneSignal API call:`, { endpoint, authType });
      
      // #region agent log
      await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'notifyLeagueMessage.ts:handler:onesignal-attempt',
          message: 'Attempting OneSignal API call',
          data: {
            attempt: attemptCount,
            endpoint,
            authType,
            playerIdsCount: playerIds.length,
            payloadKeys: Object.keys(oneSignalPayload),
            hasWebUrl: !!oneSignalPayload.web_url,
            webUrl: oneSignalPayload.web_url,
            payloadData: oneSignalPayload.data
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'H3'
        })
      }).catch(() => {});
      // #endregion
      
      const startTime = Date.now();
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': auth },
        body: JSON.stringify(oneSignalPayload),
      });
      const fetchDuration = Date.now() - startTime;
      const body = await resp.json().catch(() => ({}));
      lastResp = { endpoint, auth, status: resp.status, body };
      
      // Log full response to understand structure
      console.log(`[notifyLeagueMessage] OneSignal API full response:`, JSON.stringify(body, null, 2));
      
      console.log(`[notifyLeagueMessage] OneSignal API response summary:`, {
        endpoint,
        status: resp.status,
        ok: resp.ok,
        recipients: body.recipients,
        errors: body.errors,
        id: body.id,
        // Check for alternative response structures
        result: body.result,
        success: body.success
      });
      
      // #region agent log
      await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'notifyLeagueMessage.ts:handler:onesignal-response',
          message: 'OneSignal API response received',
          data: {
            attempt: attemptCount,
            endpoint,
            authType,
            status: resp.status,
            ok: resp.ok,
            fetchDuration,
            hasErrors: !!(body.errors && body.errors.length > 0),
            errors: body.errors,
            recipients: body.recipients ?? body.result?.recipients ?? 0,
            hasId: !!body.id,
            notificationId: body.id,
            result: body.result,
            success: body.success
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          hypothesisId: 'H3'
        })
      }).catch(() => {});
      // #endregion
      
      // OneSignal often returns HTTP 200 even with errors in the body
      if (resp.ok) {
        // Check for errors in response body
        if (body.errors && body.errors.length > 0) {
          console.error(`[notifyLeagueMessage] OneSignal returned errors:`, body.errors);
          // If all players are not subscribed, that's a different issue
          if (body.errors.some((e: string) => e.includes('not subscribed'))) {
            console.warn(`[notifyLeagueMessage] Some/all players not subscribed in OneSignal - trying next endpoint/auth combo`);
            // #region agent log
            await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'notifyLeagueMessage.ts:handler:onesignal-not-subscribed',
                message: 'Players not subscribed, trying next attempt',
                data: { attempt: attemptCount, errors: body.errors },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                hypothesisId: 'H3'
              })
            }).catch(() => {});
            // #endregion
            // Continue to next endpoint/auth combo
            continue;
          }
        }
        
        // Success - check recipients count
        // OneSignal v2 API might return recipients in different structure
        const recipients = body.recipients ?? body.result?.recipients ?? 0;
        const hasErrors = body.errors && body.errors.length > 0;
        
        // If we got an ID and no errors, consider it successful even if recipients is 0
        // (OneSignal might not return recipients count in v2 API)
        // However, if recipients is 0, devices might not be subscribed - log a warning
        if (body.id && !hasErrors) {
          if (recipients === 0) {
            console.warn(`[notifyLeagueMessage] Notification queued (ID: ${body.id}) but recipients count is 0. Devices may not be subscribed in OneSignal.`);
            console.warn(`[notifyLeagueMessage] Player IDs sent: ${playerIds.slice(0, 3).join(', ')}${playerIds.length > 3 ? '...' : ''}`);
            console.warn(`[notifyLeagueMessage] Check OneSignal dashboard or use Message History API to verify delivery status.`);
            // #region agent log
            await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'notifyLeagueMessage.ts:handler:onesignal-success-zero-recipients',
                message: 'Success but zero recipients',
                data: { notificationId: body.id, recipients, playerIdsCount: playerIds.length },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                hypothesisId: 'H3'
              })
            }).catch(() => {});
            // #endregion
          } else {
            console.log(`[notifyLeagueMessage] Success! Notification ID: ${body.id}, recipients: ${recipients}`);
            // #region agent log
            await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'notifyLeagueMessage.ts:handler:onesignal-success',
                message: 'OneSignal success with recipients',
                data: { notificationId: body.id, recipients, attempt: attemptCount },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                hypothesisId: 'H3'
              })
            }).catch(() => {});
            // #endregion
          }
          return json(200, { ok: true, result: body, sent: playerIds.length, recipients, notificationId: body.id });
        }
        
        // If recipients > 0, definitely success
        if (recipients > 0) {
          console.log(`[notifyLeagueMessage] Success! Sent to ${recipients} recipients`);
          // #region agent log
          await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'notifyLeagueMessage.ts:handler:onesignal-success-recipients',
              message: 'OneSignal success with recipients > 0',
              data: { recipients, attempt: attemptCount },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              hypothesisId: 'H3'
            })
          }).catch(() => {});
          // #endregion
          return json(200, { ok: true, result: body, sent: playerIds.length, recipients });
        }
      }
      if (![401, 403].includes(resp.status)) {
        // #region agent log
        await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'notifyLeagueMessage.ts:handler:onesignal-break',
            message: 'Breaking retry loop (non-auth error)',
            data: { status: resp.status, attempt: attemptCount },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            hypothesisId: 'H3'
          })
        }).catch(() => {});
        // #endregion
        break;
      }
    }
  }
  
  console.error('[notifyLeagueMessage] All attempts failed:', lastResp);
  // #region agent log
  await fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'notifyLeagueMessage.ts:handler:onesignal-all-failed',
      message: 'All OneSignal attempts failed',
      data: { totalAttempts: attemptCount, lastResp },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      hypothesisId: 'H3'
    })
  }).catch(() => {});
  // #endregion
  return json(200, { ok: false, error: 'OneSignal error', details: lastResp, sent: 0 });
};
