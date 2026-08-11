import { describe, expect, it } from 'vitest';

import {
  dedupeSubscriptionsByDevice,
  staleSubscriptionIdsForCurrentDevice,
} from './subscriptionDedupe';

describe('push subscription device deduplication', () => {
  const base = {
    user_id: 'user-1',
    platform: 'ios',
    os_payload: { device_model: 'iPhone16,1' },
  };

  it('keeps only the newest subscription for the same reported device', () => {
    const subscriptions = [
      { ...base, id: 'old', player_id: 'old-player', updated_at: '2026-08-11T14:00:00Z' },
      { ...base, id: 'new', player_id: 'new-player', updated_at: '2026-08-11T15:00:00Z' },
    ];

    expect(dedupeSubscriptionsByDevice(subscriptions).map((item) => item.id)).toEqual(['new']);
  });

  it('preserves different device models and unknown devices', () => {
    const subscriptions = [
      { ...base, id: 'phone', player_id: 'phone-player', updated_at: '2026-08-11T15:00:00Z' },
      {
        ...base,
        id: 'tablet',
        player_id: 'tablet-player',
        updated_at: '2026-08-11T14:00:00Z',
        os_payload: { device_model: 'iPad14,5' },
      },
      {
        ...base,
        id: 'unknown',
        player_id: 'unknown-player',
        updated_at: '2026-08-11T13:00:00Z',
        os_payload: null,
      },
    ];

    expect(dedupeSubscriptionsByDevice(subscriptions).map((item) => item.id)).toEqual([
      'phone',
      'tablet',
      'unknown',
    ]);
  });

  it('finds older records matching the currently registering device', () => {
    const current = {
      ...base,
      id: 'new',
      player_id: 'new-player',
      updated_at: '2026-08-11T15:00:00Z',
    };
    const subscriptions = [
      current,
      { ...base, id: 'old', player_id: 'old-player', updated_at: '2026-08-11T14:00:00Z' },
      {
        ...base,
        id: 'tablet',
        player_id: 'tablet-player',
        os_payload: { device_model: 'iPad14,5' },
      },
    ];

    expect(staleSubscriptionIdsForCurrentDevice(subscriptions, current)).toEqual(['old']);
  });
});
