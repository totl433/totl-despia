const DEFAULT_SITE_URL = 'https://playtotl.com';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getFinalSubmissionNotifierUrl(siteUrl?: string | null): string {
  return `${trimTrailingSlash(siteUrl?.trim() || DEFAULT_SITE_URL)}/.netlify/functions/notifyFinalSubmission`;
}

export function buildFinalSubmissionNotificationPayload(input: {
  leagueId: string;
  gw: number;
  seasonId: string | null;
}) {
  return {
    leagueId: input.leagueId,
    gw: input.gw,
    seasonId: input.seasonId,
  };
}

export async function notifyFinalSubmissionForLeagues(input: {
  siteUrl?: string | null;
  accessToken?: string | null;
  leagueIds: string[];
  gw: number;
  seasonId: string | null;
}): Promise<void> {
  const notifierUrl = getFinalSubmissionNotifierUrl(input.siteUrl);
  const uniqueLeagueIds = Array.from(new Set(input.leagueIds.filter(Boolean)));

  await Promise.all(
    uniqueLeagueIds.map(async (leagueId) => {
      const response = await fetch(notifierUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
        },
        body: JSON.stringify(
          buildFinalSubmissionNotificationPayload({
            leagueId,
            gw: input.gw,
            seasonId: input.seasonId,
          })
        ),
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(
          `Final submission notification request failed (${response.status}): ${
            bodyText || response.statusText
          }`
        );
      }
    })
  );
}
