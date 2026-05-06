import { describe, expect, it } from 'vitest';

import { inferUserPlayedGwSequence } from './inferUserPlayedGwSequence';

describe('inferUserPlayedGwSequence', () => {
  const uid = 'AAAA1111-2222-3333-4444-555555555555';
  const other = 'BBBB1111-2222-3333-4444-555555555555';

  it('returns only GWs where the user has rows', () => {
    const rows = [
      { user_id: uid, gw: 30 },
      { user_id: other, gw: 31 },
      { user_id: other, gw: 32 },
      { user_id: uid, gw: 35 },
    ];
    expect(inferUserPlayedGwSequence(rows, uid)).toEqual([30, 35]);
  });

  it('is case-insensitive on user_id', () => {
    const rows = [{ user_id: uid.toUpperCase(), gw: 7 }];
    expect(inferUserPlayedGwSequence(rows, uid.toLowerCase())).toEqual([7]);
  });

  it('dedupes repeated GW rows', () => {
    const rows = [
      { user_id: uid, gw: 10 },
      { user_id: uid, gw: 10 },
    ];
    expect(inferUserPlayedGwSequence(rows, uid)).toEqual([10]);
  });
});
