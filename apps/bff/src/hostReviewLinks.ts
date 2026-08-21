const DEFAULT_HOST_REVIEW_SITE_URL = 'https://playtotl.com';

export function buildHostReviewLink(leaderboardId: string, siteUrl?: string | null): string {
  const baseUrl = (siteUrl?.trim() || DEFAULT_HOST_REVIEW_SITE_URL).replace(/\/+$/, '');
  return `${baseUrl}/host/leaderboards/${encodeURIComponent(leaderboardId)}`;
}
