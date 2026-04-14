import { describe, expect, it } from 'vitest';

import { getBrandedLeaderboardAccessState, shouldShowPaywallBeforeJoin } from './brandedLeaderboardAccess';

const paidLeaderboard = {
  id: 'lb-paid',
  name: 'paid',
  display_name: 'Paid',
  description: null,
  slug: 'paid',
  header_image_url: null,
  visibility: 'private' as const,
  price_type: 'paid' as const,
  season_price_cents: 199,
  currency: 'GBP',
  revenue_share_pct: 0,
  payout_owner_id: null,
  status: 'active' as const,
  season: '2025-26',
  start_gw: null,
  rc_offering_id: 'off_green_peace',
  rc_entitlement_id: null,
  rc_product_id: 'lb_green_peace',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const freeLeaderboard = {
  ...paidLeaderboard,
  id: 'lb-free',
  price_type: 'free' as const,
  rc_offering_id: null,
  rc_product_id: null,
};

const membership = {
  id: 'mem-1',
  leaderboard_id: 'lb-paid',
  user_id: 'user-1',
  joined_at: '2026-01-01T00:00:00Z',
  left_at: null,
  source: 'join_code',
};

describe('getBrandedLeaderboardAccessState', () => {
  it('allows access for a paid leaderboard that has been purchased', () => {
    expect(
      getBrandedLeaderboardAccessState({
        leaderboard: paidLeaderboard,
        membership,
        hasAccess: true,
        requiresPurchase: false,
      })
    ).toBe('full_access');
  });

  it('shows the paywall for a different paid leaderboard that has not been purchased', () => {
    expect(
      getBrandedLeaderboardAccessState({
        leaderboard: paidLeaderboard,
        membership,
        hasAccess: false,
        requiresPurchase: true,
      })
    ).toBe('paywall_required');
  });

  it('keeps free leaderboards outside the paywall flow', () => {
    expect(
      getBrandedLeaderboardAccessState({
        leaderboard: freeLeaderboard,
        membership,
        hasAccess: true,
        requiresPurchase: false,
      })
    ).toBe('free_access');
  });
});

describe('shouldShowPaywallBeforeJoin', () => {
  it('shows the paywall for a deep link into an unpaid leaderboard before join completes', () => {
    expect(
      shouldShowPaywallBeforeJoin({
        leaderboard: paidLeaderboard,
        requiresPurchase: true,
      })
    ).toBe(true);
  });
});
