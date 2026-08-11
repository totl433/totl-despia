import { describe, expect, it } from 'vitest';

import {
  buildFinalSubmissionNotificationPayload,
  getFinalSubmissionNotifierUrl,
} from './finalSubmissionNotifications';

describe('final submission notification requests', () => {
  it('targets the production function without duplicate slashes', () => {
    expect(getFinalSubmissionNotifierUrl('https://playtotl.com/')).toBe(
      'https://playtotl.com/.netlify/functions/notifyFinalSubmission'
    );
    expect(getFinalSubmissionNotifierUrl()).toBe(
      'https://playtotl.com/.netlify/functions/notifyFinalSubmission'
    );
  });

  it('passes season context so the function checks the correct submission table', () => {
    expect(
      buildFinalSubmissionNotificationPayload({
        leagueId: 'league-1',
        gw: 1,
        seasonId: 'season-26-27',
      })
    ).toEqual({
      leagueId: 'league-1',
      gw: 1,
      seasonId: 'season-26-27',
    });
  });
});
