import { describe, expect, it } from 'vitest';

import { kickoffCopy, pickCopy } from './copyBank';

describe('copy bank', () => {
  it('picks the same option for the same card id', () => {
    const options = kickoffCopy('Arsenal v Coventry');
    expect(pickCopy(options, 'ko:0')).toEqual(pickCopy(options, 'ko:0'));
  });

  it('can pick a different option for a different card', () => {
    const options = kickoffCopy('Arsenal v Coventry');
    const seen = new Set(options.map((_, index) => pickCopy(options, `ko:${index}`).line));
    expect(seen.size).toBeGreaterThan(1);
  });
});
