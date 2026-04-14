import { describe, expect, it } from 'vitest';

import {
  canJoinBrandedLeaderboard,
  getDefaultTierConfig,
  getExpectedLeaderboardProductIds,
  hasVerifiedRevenueCatV2ProductAccess,
  selectRedeemableRevenueCatGrant,
  summarizeBrandedLeaderboardAccess,
} from './brandedLeaderboardAccess';

describe('summarizeBrandedLeaderboardAccess', () => {
  it('allows paid leaderboard access only when the exact leaderboard is purchased and joined', () => {
    expect(
      summarizeBrandedLeaderboardAccess({
        priceType: 'paid',
        isMember: true,
        hasActivePurchase: true,
      })
    ).toMatchObject({
      hasAccess: true,
      requiresPurchase: false,
      accessReason: 'paid_full_access',
    });
  });

  it('requires payment for a different paid leaderboard that has not been purchased', () => {
    expect(
      summarizeBrandedLeaderboardAccess({
        priceType: 'paid',
        isMember: true,
        hasActivePurchase: false,
      })
    ).toMatchObject({
      hasAccess: false,
      requiresPurchase: true,
      accessReason: 'paid_not_purchased',
    });
  });

  it('keeps free leaderboard access outside the paywall path', () => {
    expect(
      summarizeBrandedLeaderboardAccess({
        priceType: 'free',
        isMember: true,
        hasActivePurchase: false,
      })
    ).toMatchObject({
      hasAccess: true,
      requiresPurchase: false,
      accessReason: 'free_joined',
    });
  });
});

describe('canJoinBrandedLeaderboard', () => {
  it('does not allow join flow to create paid access without payment', () => {
    expect(canJoinBrandedLeaderboard({ priceType: 'paid', hasActivePurchase: false })).toBe(false);
    expect(canJoinBrandedLeaderboard({ priceType: 'paid', hasActivePurchase: true })).toBe(true);
    expect(canJoinBrandedLeaderboard({ priceType: 'free', hasActivePurchase: false })).toBe(true);
  });
});

describe('hasVerifiedRevenueCatV2ProductAccess', () => {
  it('verifies an active subscription for the exact leaderboard product', () => {
    expect(
      hasVerifiedRevenueCatV2ProductAccess({
        productId: 'lb_green_peace',
        subscriptions: [
          {
            product_id: 'lb_green_peace',
            gives_access: true,
          },
        ],
      })
    ).toBe(true);
  });

  it('does not treat a different product as access to this leaderboard', () => {
    expect(
      hasVerifiedRevenueCatV2ProductAccess({
        productId: 'lb_green_peace',
        subscriptions: [
          {
            product_id: 'lb_test_jof',
            gives_access: true,
          },
        ],
        purchases: [{ product_id: 'lb_test_jof' }],
      })
    ).toBe(false);
  });

  it('accepts an exact non-subscription purchase for the leaderboard product', () => {
    expect(
      hasVerifiedRevenueCatV2ProductAccess({
        productId: 'lb_green_peace',
        purchases: [{ product_id: 'lb_green_peace' }],
      })
    ).toBe(true);
  });
});

describe('price tier defaults', () => {
  it('provides generic offering and product defaults for supported price tiers', () => {
    expect(getDefaultTierConfig(99)).toEqual({
      offeringId: 'totl_season_sub_099',
      productId: 'totl_season_sub_099',
    });
    expect(getDefaultTierConfig(199)).toEqual({
      offeringId: 'totl_season_sub_199',
      productId: 'totl_season_sub_199',
    });
    expect(getDefaultTierConfig(299)).toBeNull();
  });

  it('prefers explicit leaderboard product ids when present', () => {
    expect(getExpectedLeaderboardProductIds({ configuredProductId: 'custom_lb_product', priceCents: 99 })).toEqual([
      'custom_lb_product',
    ]);
    expect(getExpectedLeaderboardProductIds({ priceCents: 99 })).toEqual(['totl_season_sub_099']);
  });
});

describe('selectRedeemableRevenueCatGrant', () => {
  it('returns an unused purchase for the exact product so each paid leaderboard needs its own redemption', () => {
    expect(
      selectRedeemableRevenueCatGrant({
        allowedProductIds: ['totl_season_sub_099'],
        preferredProductId: 'totl_season_sub_099',
        purchases: [
          {
            product_id: 'totl_season_sub_099',
            store_purchase_identifier: 'txn_1',
          },
          {
            product_id: 'totl_season_sub_099',
            store_purchase_identifier: 'txn_2',
          },
        ],
        usedRedemptionIdentifiers: ['txn_1'],
      })
    ).toEqual({
      productId: 'totl_season_sub_099',
      redemptionIdentifier: 'txn_2',
      source: 'purchase',
    });
  });

  it('does not allow a previously redeemed purchase to unlock another leaderboard', () => {
    expect(
      selectRedeemableRevenueCatGrant({
        allowedProductIds: ['totl_season_sub_099'],
        purchases: [
          {
            product_id: 'totl_season_sub_099',
            store_purchase_identifier: 'txn_1',
          },
        ],
        usedRedemptionIdentifiers: ['txn_1'],
      })
    ).toBeNull();
  });
});
