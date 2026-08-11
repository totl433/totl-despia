import { describe, expect, it } from 'vitest';

import {
  buildFinalSubmissionEventId,
  resolveFinalSubmissionScope,
} from './finalSubmission';

describe('final submission notification scope', () => {
  it('uses the season submission table and season-specific event ID', () => {
    const scope = resolveFinalSubmissionScope('season-26-27');

    expect(scope).toEqual({
      table: 'app_season_submissions',
      seasonId: 'season-26-27',
    });
    expect(buildFinalSubmissionEventId('league-1', 1, scope.seasonId)).toBe(
      'final_sub:league-1:season-26-27:1'
    );
  });

  it('keeps legacy submissions in an isolated dedupe namespace', () => {
    const scope = resolveFinalSubmissionScope(null);

    expect(scope).toEqual({
      table: 'app_gw_submissions',
      seasonId: null,
    });
    expect(buildFinalSubmissionEventId('league-1', 1, scope.seasonId)).toBe(
      'final_sub:league-1:legacy:1'
    );
  });
});
