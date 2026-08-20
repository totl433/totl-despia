import { describe, expect, it } from 'vitest';

import { hasSqlLikeWildcards, normalizeDisplayName } from './displayName';

describe('display name helpers', () => {
  it('trims and collapses spaces', () => {
    expect(normalizeDisplayName('  Jof   Bird  ')).toBe('Jof Bird');
  });

  it('rejects SQL LIKE wildcards used by the uniqueness check', () => {
    expect(hasSqlLikeWildcards('Jof_Bird')).toBe(true);
    expect(hasSqlLikeWildcards('Jof%Bird')).toBe(true);
    expect(hasSqlLikeWildcards('Jof Bird')).toBe(false);
  });
});
