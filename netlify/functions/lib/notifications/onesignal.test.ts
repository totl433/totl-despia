import { afterEach, describe, expect, it } from 'vitest';

import { getCatalogEntry } from './catalog';
import { buildPayload } from './onesignal';

const originalAppId = process.env.ONESIGNAL_APP_ID;

afterEach(() => {
  if (originalAppId === undefined) delete process.env.ONESIGNAL_APP_ID;
  else process.env.ONESIGNAL_APP_ID = originalAppId;
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
    });

    expect(payload).not.toHaveProperty('url');
    expect(payload.include_subscription_ids).toEqual(['player-id']);
    expect(payload).not.toHaveProperty('include_player_ids');
    expect(payload.data).toMatchObject({
      type: 'league_message',
      url: destination,
      navigateTo: destination,
    });
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
    });

    expect(payload).not.toHaveProperty('url');
    expect(payload.data?.url).toBe('com.despia.totlnative:///league/TVYY4');
    expect(payload.data?.navigateTo).toBe('https://playtotl.com/league/TVYY4');
  });
});
