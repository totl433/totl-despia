export type BrandedLeaderboardPriceType = 'free' | 'paid';

export const DEFAULT_BRANDED_LEADERBOARD_PRICE_TIERS = {
  99: {
    offeringId: 'totl_access_099',
    productId: 'totl_access_099',
  },
  199: {
    offeringId: 'totl_access_199',
    productId: 'totl_access_199',
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

export type RevenueCatV1Entitlement = {
  expires_date?: string | null;
  product_identifier?: string | null;
  purchase_date?: string | null;
  is_sandbox?: boolean | null;
};

export type RevenueCatV1Subscription = {
  auto_resume_date?: string | null;
  billing_issues_detected_at?: string | null;
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  original_purchase_date?: string | null;
  ownership_type?: string | null;
  period_type?: string | null;
  purchase_date?: string | null;
  refunded_at?: string | null;
  store?: string | null;
  store_transaction_id?: string | number | null;
  unsubscribe_detected_at?: string | null;
  is_sandbox?: boolean | null;
};

export type RevenueCatV1Purchase = {
  id?: string | number | null;
  store_transaction_id?: string | number | null;
  purchase_date?: string | null;
  store?: string | null;
  is_sandbox?: boolean | null;
};

export type RevenueCatV1Subscriber = {
  entitlements?: Record<string, RevenueCatV1Entitlement | null> | null;
  non_subscriptions?: Record<string, RevenueCatV1Purchase[] | null> | null;
  original_app_user_id?: string | null;
  other_purchases?: Record<string, RevenueCatV1Purchase[] | null> | null;
  subscriptions?: Record<string, RevenueCatV1Subscription | null> | null;
};

export type RevenueCatCustomerSnapshot = {
  activeEntitlementIds: string[];
  activeEntitlementProductIds: string[];
  environment: 'sandbox' | 'production' | 'mixed' | 'unknown';
  originalAppUserId: string | null;
  purchases: RevenueCatV2Purchase[];
  subscriptions: RevenueCatV2Subscription[];
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

function normalizeUnknownIdentifier(value: unknown): string | null {
  if (typeof value === 'string') {
    return normalizeIdentifier(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function recordSandboxState(
  target: Set<'sandbox' | 'production'>,
  isSandbox: boolean | null | undefined
) {
  if (isSandbox === true) {
    target.add('sandbox');
  } else if (isSandbox === false) {
    target.add('production');
  }
}

function coerceRevenueCatV1PurchaseEntries(entries: unknown): RevenueCatV1Purchase[] {
  if (Array.isArray(entries)) {
    return entries.filter((entry): entry is RevenueCatV1Purchase => Boolean(entry) && typeof entry === 'object');
  }
  if (entries && typeof entries === 'object') {
    return [entries as RevenueCatV1Purchase];
  }
  return [];
}

export function mapRevenueCatV1SubscriberToSnapshot(input: {
  now?: Date;
  subscriber?: RevenueCatV1Subscriber | null | undefined;
}): RevenueCatCustomerSnapshot {
  const now = input.now ?? new Date();
  const subscriber = input.subscriber ?? null;
  const environmentFlags = new Set<'sandbox' | 'production'>();
  const activeEntitlementIds: string[] = [];
  const activeEntitlementProductIds = new Set<string>();

  for (const [entitlementId, entitlement] of Object.entries(subscriber?.entitlements ?? {})) {
    if (!entitlement) continue;
    recordSandboxState(environmentFlags, entitlement.is_sandbox);
    const productId = normalizeIdentifier(entitlement.product_identifier);
    if (!productId) continue;
    if (isActiveAt(entitlement.expires_date, now)) {
      activeEntitlementIds.push(entitlementId);
      activeEntitlementProductIds.add(productId);
    }
  }

  const subscriptions: RevenueCatV2Subscription[] = [];
  for (const [productId, subscription] of Object.entries(subscriber?.subscriptions ?? {})) {
    if (!subscription) continue;
    recordSandboxState(environmentFlags, subscription.is_sandbox);
    const expiresAt = subscription.grace_period_expires_date ?? subscription.expires_date ?? null;
    const refunded = Boolean(subscription.refunded_at);
    const active = !refunded && isActiveAt(expiresAt, now);
    subscriptions.push({
      product_id: productId,
      store_subscription_identifier: normalizeUnknownIdentifier(subscription.store_transaction_id),
      gives_access: active,
      current_period_ends_at: expiresAt,
      expires_at: subscription.expires_date ?? null,
      status: refunded ? 'refunded' : active ? 'active' : 'expired',
    });
  }

  const purchases: RevenueCatV2Purchase[] = [];
  const appendPurchases = (
    collection?: Record<string, RevenueCatV1Purchase[] | RevenueCatV1Purchase | null> | null
  ) => {
    for (const [productId, entries] of Object.entries(collection ?? {})) {
      for (const entry of coerceRevenueCatV1PurchaseEntries(entries)) {
        if (!entry) continue;
        recordSandboxState(environmentFlags, entry.is_sandbox);
        purchases.push({
          product_id: productId,
          store_purchase_identifier:
            normalizeUnknownIdentifier(entry.store_transaction_id) ?? normalizeUnknownIdentifier(entry.id),
        });
      }
    }
  };

  appendPurchases(subscriber?.non_subscriptions);
  appendPurchases(subscriber?.other_purchases);

  const environment =
    environmentFlags.size === 0
      ? 'unknown'
      : environmentFlags.size > 1
        ? 'mixed'
        : environmentFlags.has('sandbox')
          ? 'sandbox'
          : 'production';

  return {
    activeEntitlementIds,
    activeEntitlementProductIds: Array.from(activeEntitlementProductIds),
    environment,
    originalAppUserId: normalizeIdentifier(subscriber?.original_app_user_id),
    purchases,
    subscriptions,
  };
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
  legacyUsedProductCounts?: Record<string, number> | null | undefined;
  now?: Date;
}): RevenueCatRedemptionCandidate | null {
  const now = input.now ?? new Date();
  const allowed = new Set(input.allowedProductIds.filter(Boolean));
  const used = new Set(Array.from(input.usedRedemptionIdentifiers ?? []).filter(Boolean));
  const legacyUsedProductCounts = new Map(
    Object.entries(input.legacyUsedProductCounts ?? {}).filter(([, count]) => Number(count) > 0)
  );
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

  const availablePurchaseCandidates = purchaseCandidates.filter((candidate) => {
    const remainingLegacyUses = legacyUsedProductCounts.get(candidate.productId) ?? 0;
    if (remainingLegacyUses > 0) {
      legacyUsedProductCounts.set(candidate.productId, remainingLegacyUses - 1);
      return false;
    }
    return true;
  });

  const preferredPurchase = preferredProductId
    ? availablePurchaseCandidates.find((candidate) => candidate.productId === preferredProductId)
    : null;
  if (preferredPurchase) {
    return preferredPurchase;
  }
  if (availablePurchaseCandidates.length > 0) {
    return availablePurchaseCandidates[0];
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
