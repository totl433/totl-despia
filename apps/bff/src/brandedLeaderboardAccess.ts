export type BrandedLeaderboardPriceType = 'free' | 'paid';

export const DEFAULT_BRANDED_LEADERBOARD_PRICE_TIERS = {
  99: {
    offeringId: 'totl_season_sub_099',
    productId: 'totl_season_sub_099',
  },
  199: {
    offeringId: 'totl_season_sub_199',
    productId: 'totl_season_sub_199',
  },
} as const;

export type BrandedLeaderboardAccessReason =
  | 'free_not_joined'
  | 'free_joined'
  | 'paid_not_purchased'
  | 'paid_purchased_not_joined'
  | 'paid_full_access';

export type BrandedLeaderboardAccessSummary = {
  hasAccess: boolean;
  hasActivePurchase: boolean;
  requiresPurchase: boolean;
  accessReason: BrandedLeaderboardAccessReason;
};

export type RevenueCatV2Subscription = {
  id?: string | null;
  product_id?: string | null;
  store_subscription_identifier?: string | null;
  gives_access?: boolean | null;
  current_period_ends_at?: string | null;
  expires_at?: string | null;
  status?: string | null;
};

export type RevenueCatV2Purchase = {
  id?: string | null;
  product_id?: string | null;
  store_purchase_identifier?: string | null;
};

export type RevenueCatRedemptionCandidate = {
  productId: string;
  redemptionIdentifier: string;
  source: 'purchase' | 'subscription';
};

function isActiveAt(expiresAt: string | null | undefined, now: Date): boolean {
  if (!expiresAt) return true;
  const expiresMs = Date.parse(expiresAt);
  return Number.isFinite(expiresMs) && expiresMs > now.getTime();
}

export function summarizeBrandedLeaderboardAccess(input: {
  priceType: BrandedLeaderboardPriceType;
  isMember: boolean;
  hasActivePurchase: boolean;
}): BrandedLeaderboardAccessSummary {
  const { priceType, isMember, hasActivePurchase } = input;

  if (priceType === 'free') {
    return {
      hasAccess: isMember,
      hasActivePurchase: false,
      requiresPurchase: false,
      accessReason: isMember ? 'free_joined' : 'free_not_joined',
    };
  }

  if (!hasActivePurchase) {
    return {
      hasAccess: false,
      hasActivePurchase: false,
      requiresPurchase: true,
      accessReason: 'paid_not_purchased',
    };
  }

  if (!isMember) {
    return {
      hasAccess: false,
      hasActivePurchase: true,
      requiresPurchase: false,
      accessReason: 'paid_purchased_not_joined',
    };
  }

  return {
    hasAccess: true,
    hasActivePurchase: true,
    requiresPurchase: false,
    accessReason: 'paid_full_access',
  };
}

export function canJoinBrandedLeaderboard(input: {
  priceType: BrandedLeaderboardPriceType;
  hasActivePurchase: boolean;
}): boolean {
  return input.priceType === 'free' || input.hasActivePurchase;
}

export function getDefaultTierConfig(priceCents: number): { offeringId: string; productId: string } | null {
  return (DEFAULT_BRANDED_LEADERBOARD_PRICE_TIERS as Record<number, { offeringId: string; productId: string }>)[priceCents] ?? null;
}

export function getExpectedLeaderboardProductIds(input: {
  configuredProductId?: string | null;
  priceCents?: number | null;
}): string[] {
  const configured = input.configuredProductId?.trim();
  if (configured) {
    return [configured];
  }

  const tier = getDefaultTierConfig(Number(input.priceCents ?? 0));
  return tier ? [tier.productId] : [];
}

function normalizeIdentifier(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function hasVerifiedRevenueCatV2ProductAccess(input: {
  subscriptions?: RevenueCatV2Subscription[] | null | undefined;
  purchases?: RevenueCatV2Purchase[] | null | undefined;
  productId: string;
  now?: Date;
}): boolean {
  const { subscriptions, purchases, productId } = input;
  const now = input.now ?? new Date();
  if (!productId) return false;

  for (const subscription of subscriptions ?? []) {
    if (subscription?.product_id !== productId) continue;
    if (subscription.gives_access === true) return true;
    if (isActiveAt(subscription.current_period_ends_at ?? subscription.expires_at, now)) return true;
    const status = String(subscription.status ?? '').toLowerCase();
    if (status === 'active' || status === 'trialing') return true;
  }

  return (purchases ?? []).some((purchase) => purchase?.product_id === productId);
}

export function selectRedeemableRevenueCatGrant(input: {
  subscriptions?: RevenueCatV2Subscription[] | null | undefined;
  purchases?: RevenueCatV2Purchase[] | null | undefined;
  allowedProductIds: string[];
  preferredProductId?: string | null;
  usedRedemptionIdentifiers?: Iterable<string>;
  now?: Date;
}): RevenueCatRedemptionCandidate | null {
  const now = input.now ?? new Date();
  const allowed = new Set(input.allowedProductIds.filter(Boolean));
  const used = new Set(Array.from(input.usedRedemptionIdentifiers ?? []).filter(Boolean));
  const preferredProductId = normalizeIdentifier(input.preferredProductId);

  const purchases = (input.purchases ?? []).filter((purchase) => allowed.has(String(purchase.product_id ?? '')));
  const subscriptions = (input.subscriptions ?? []).filter((subscription) =>
    allowed.has(String(subscription.product_id ?? ''))
  );

  const purchaseCandidates = purchases
    .map((purchase) => ({
      productId: String(purchase.product_id ?? ''),
      redemptionIdentifier: normalizeIdentifier(purchase.store_purchase_identifier) ?? normalizeIdentifier(purchase.id),
      source: 'purchase' as const,
    }))
    .filter(
      (
        candidate
      ): candidate is RevenueCatRedemptionCandidate & {
        source: 'purchase';
      } => {
        const redemptionIdentifier = candidate.redemptionIdentifier;
        if (!redemptionIdentifier) return false;
        return !used.has(redemptionIdentifier);
      }
    );

  const preferredPurchase = preferredProductId
    ? purchaseCandidates.find((candidate) => candidate.productId === preferredProductId)
    : null;
  if (preferredPurchase) {
    return preferredPurchase;
  }
  if (purchaseCandidates.length > 0) {
    return purchaseCandidates[0];
  }

  const subscriptionCandidates = subscriptions
    .filter((subscription) => {
      if (subscription.gives_access === true) return true;
      if (isActiveAt(subscription.current_period_ends_at ?? subscription.expires_at, now)) return true;
      const status = String(subscription.status ?? '').toLowerCase();
      return status === 'active' || status === 'trialing';
    })
    .map((subscription) => ({
      productId: String(subscription.product_id ?? ''),
      redemptionIdentifier:
        normalizeIdentifier(subscription.store_subscription_identifier) ?? normalizeIdentifier(subscription.id),
      source: 'subscription' as const,
    }))
    .filter(
      (
        candidate
      ): candidate is RevenueCatRedemptionCandidate & {
        source: 'subscription';
      } => {
        const redemptionIdentifier = candidate.redemptionIdentifier;
        if (!redemptionIdentifier) return false;
        return !used.has(redemptionIdentifier);
      }
    );

  const preferredSubscription = preferredProductId
    ? subscriptionCandidates.find((candidate) => candidate.productId === preferredProductId)
    : null;
  if (preferredSubscription) {
    return preferredSubscription;
  }

  return subscriptionCandidates[0] ?? null;
}
