import { describe, expect, it } from 'vitest';

import {
  canJoinBrandedLeaderboard,
  getDefaultTierConfig,
  getExpectedLeaderboardProductIds,
  hasVerifiedRevenueCatV2ProductAccess,
  mapRevenueCatV1SubscriberToSnapshot,
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

describe('mapRevenueCatV1SubscriberToSnapshot', () => {
  it('maps a v1 non-subscription purchase into a redeemable access snapshot', () => {
    const snapshot = mapRevenueCatV1SubscriberToSnapshot({
      subscriber: {
        original_app_user_id: 'user-1',
        entitlements: {
          play_totl_pro: {
            product_identifier: 'totl_season_sub_099',
            expires_date: null,
            is_sandbox: true,
          },
        },
        non_subscriptions: {
          totl_season_sub_099: [
            {
              id: 'txn_1',
              is_sandbox: true,
            },
          ],
        },
      },
    });

    expect(snapshot).toMatchObject({
      originalAppUserId: 'user-1',
      environment: 'sandbox',
      activeEntitlementIds: ['play_totl_pro'],
      activeEntitlementProductIds: ['totl_season_sub_099'],
    });
    expect(snapshot.purchases).toEqual([
      {
        product_id: 'totl_season_sub_099',
        store_purchase_identifier: 'txn_1',
      },
    ]);
  });

  it('keeps the paid leaderboard product visible when v1 subscriber data arrives before v2 catches up', () => {
    const snapshot = mapRevenueCatV1SubscriberToSnapshot({
      subscriber: {
        subscriptions: {
          totl_season_sub_099: {
            expires_date: '2099-01-01T00:00:00Z',
            store_transaction_id: 'sub_txn_1',
            is_sandbox: false,
          },
        },
      },
    });

    expect(
      hasVerifiedRevenueCatV2ProductAccess({
        productId: 'totl_season_sub_099',
        subscriptions: snapshot.subscriptions,
        purchases: snapshot.purchases,
      })
    ).toBe(true);
  });

  it('tolerates non-array v1 purchase payloads without crashing', () => {
    const snapshot = mapRevenueCatV1SubscriberToSnapshot({
      subscriber: {
        non_subscriptions: {
          totl_season_sub_099: {
            id: 'txn_single',
            is_sandbox: true,
          } as any,
        },
        other_purchases: {
          totl_season_sub_199: null,
        },
      },
    });

    expect(snapshot.purchases).toEqual([
      {
        product_id: 'totl_season_sub_099',
        store_purchase_identifier: 'txn_single',
      },
    ]);
    expect(snapshot.environment).toBe('sandbox');
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

  it('treats legacy product rows as already consuming the first matching purchase', () => {
    expect(
      selectRedeemableRevenueCatGrant({
        allowedProductIds: ['totl_season_sub_099'],
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
        legacyUsedProductCounts: {
          totl_season_sub_099: 1,
        },
      })
    ).toEqual({
      productId: 'totl_season_sub_099',
      redemptionIdentifier: 'txn_2',
      source: 'purchase',
    });
  });

  it('requires a fresh purchase when only a legacy-consumed transaction exists', () => {
    expect(
      selectRedeemableRevenueCatGrant({
        allowedProductIds: ['totl_season_sub_099'],
        purchases: [
          {
            product_id: 'totl_season_sub_099',
            store_purchase_identifier: 'txn_1',
          },
        ],
        legacyUsedProductCounts: {
          totl_season_sub_099: 1,
        },
      })
    ).toBeNull();
  });
});
