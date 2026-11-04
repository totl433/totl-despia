import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/leagueAvatars', () => ({ resolveLeagueAvatarUri: () => null }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import { auditEntries } from './feedAudit';
import { FEED_CARD_CODES, feedCardCode } from './feedCardCodes';

describe('feed card codes', () => {
  it('are unique and follow the family pattern', () => {
    const codes = FEED_CARD_CODES.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[XMDPSRCN]\d{2}$/);
  });

  it('match the audit view: same codes, names and kinds', () => {
    const seen = new Set<string>();
    for (const entry of auditEntries(Date.UTC(2026, 9, 25, 14))) {
      if (entry.type === 'section') continue;
      const code = entry.type === 'missing' ? entry.code : entry.meta.code;
      const name = entry.type === 'missing' ? entry.name : entry.meta.name;
      const registered = feedCardCode(code);
      expect(registered, code).toBeDefined();
      expect(name, code).toBe(registered!.name);
      if (entry.type === 'card') expect(registered!.kinds, code).toContain(entry.item.kind);
      seen.add(code);
    }
    const unseen = FEED_CARD_CODES.filter((entry) => entry.status !== 'removed' && !seen.has(entry.code));
    expect(unseen.map((entry) => entry.code)).toEqual([]);
  });
});
