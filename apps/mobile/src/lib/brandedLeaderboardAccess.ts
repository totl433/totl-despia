import type { BrandedLeaderboardDetail } from '@totl/domain';

export type MobileBrandedLeaderboardAccessState =
  | 'loading'
  | 'not_signed_in'
  | 'not_joined'
  | 'free_access'
  | 'paywall_required'
  | 'full_access'
  | 'error';

export function getBrandedLeaderboardAccessState(
  detail: Pick<BrandedLeaderboardDetail, 'leaderboard' | 'membership' | 'hasAccess' | 'requiresPurchase'>
): MobileBrandedLeaderboardAccessState {
  if (detail.leaderboard.price_type === 'paid' && detail.requiresPurchase) {
    return 'paywall_required';
  }

  if (!detail.membership) {
    return 'not_joined';
  }

  if (detail.leaderboard.price_type === 'free') {
    return 'free_access';
  }

  if (detail.hasAccess) {
    return 'full_access';
  }

  return 'not_joined';
}

export function shouldShowPaywallBeforeJoin(
  detail: Pick<BrandedLeaderboardDetail, 'leaderboard' | 'requiresPurchase'>
): boolean {
  return detail.leaderboard.price_type === 'paid' && detail.requiresPurchase;
}
