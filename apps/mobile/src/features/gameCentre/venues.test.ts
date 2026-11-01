import { describe, expect, it } from 'vitest';

import { homeGround, matchDateVenueLine } from './venues';

describe('match venue line', () => {
  it('uses the home side’s ground', () => {
    expect(homeGround('mun')).toBe('Old Trafford, Manchester');
    expect(homeGround('XYZ')).toBeNull();
  });

  it('joins the date and ground, leaving out what is missing', () => {
    expect(matchDateVenueLine('2026-10-24T14:00:00Z', 'MUN')).toMatch(/^Sat 24 Oct 2026 · Old Trafford, Manchester$/);
    expect(matchDateVenueLine(null, 'MUN')).toBe('Old Trafford, Manchester');
    expect(matchDateVenueLine(null, null)).toBeNull();
  });
});
