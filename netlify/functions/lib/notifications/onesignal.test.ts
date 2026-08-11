import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCatalogEntry } from './catalog';
import { buildPayload, sendNotification } from './onesignal';

const originalAppId = process.env.ONESIGNAL_APP_ID;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalAppId === undefined) delete process.env.ONESIGNAL_APP_ID;
  else process.env.ONESIGNAL_APP_ID = originalAppId;
  delete process.env.ONESIGNAL_REST_API_KEY;
});

describe('mobile notification destinations', () => {
  it('keeps deep links in additional data and omits OneSignal launch URLs', () => {
    process.env.ONESIGNAL_APP_ID = 'test-app-id';
    const catalogEntry = getCatalogEntry('chat-message');
    if (!catalogEntry) throw new Error('chat-message catalog entry missing');

    const destination = 'https://playtotl.com/league/TVYY4?tab=chat';
    const payload = buildPayload(catalogEntry, {
      title: 'New message',
      body: 'Hello',
      playerIds: ['player-id'],
      data: { type: 'league_message' },
      url: destination,
      groupingParams: { league_id: 'league-id', message_id: 'message-id' },
    });

    expect(payload).not.toHaveProperty('url');
    expect(payload.collapse_id).toBe('chat:league-id:message-id');
    expect(payload.include_subscription_ids).toEqual(['player-id']);
    expect(payload).not.toHaveProperty('include_player_ids');
    expect(payload.data).toMatchObject({
      type: 'league_message',
      url: destination,
      navigateTo: destination,
    });
  });

  it('uses the current endpoint and counts an ID response as accepted', async () => {
    process.env.ONESIGNAL_REST_API_KEY = 'os_v2_app_test';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'notification-id' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendNotification({
      app_id: 'test-app-id',
      headings: { en: 'Title' },
      contents: { en: 'Body' },
      include_subscription_ids: ['subscription-id'],
    });

    expect(result).toMatchObject({
      success: true,
      notification_id: 'notification-id',
      recipients: 1,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.onesignal.com/notifications',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Key os_v2_app_test' }),
      })
    );
  });

  it('preserves an explicitly supplied data destination', () => {
    process.env.ONESIGNAL_APP_ID = 'test-app-id';
    const catalogEntry = getCatalogEntry('member-join');
    if (!catalogEntry) throw new Error('member-join catalog entry missing');

    const payload = buildPayload(catalogEntry, {
      title: 'Player joined',
      body: 'Player joined your league',
      data: { url: 'com.despia.totlnative:///league/TVYY4' },
      url: 'https://playtotl.com/league/TVYY4',
      groupingParams: { league_id: 'league-id', user_id: 'user-id' },
    });

    expect(payload).not.toHaveProperty('url');
    expect(payload.collapse_id).toBe('member_join:league-id:user-id');
    expect(payload.data?.url).toBe('com.despia.totlnative:///league/TVYY4');
    expect(payload.data?.navigateTo).toBe('https://playtotl.com/league/TVYY4');
  });
});
