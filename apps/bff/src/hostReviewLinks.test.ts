import { describe, expect, it } from 'vitest';
import { buildHostReviewLink } from './hostReviewLinks';

describe('buildHostReviewLink', () => {
  it('always defaults host review emails to the production website', () => {
    expect(buildHostReviewLink('campaign-id')).toBe(
      'https://playtotl.com/host/leaderboards/campaign-id'
    );
  });

  it('supports an isolated preview origin without using the shared SITE_URL', () => {
    expect(buildHostReviewLink('campaign/id', 'https://preview.example.com/')).toBe(
      'https://preview.example.com/host/leaderboards/campaign%2Fid'
    );
  });
});
