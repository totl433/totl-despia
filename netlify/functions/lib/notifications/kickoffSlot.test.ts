import { describe, expect, it } from 'vitest';
import { buildKickoffSlotEventId, kickoffSlotKey } from './kickoffSlot';

describe('kickoff slot batching', () => {
  it('buckets kickoff times to the UTC minute', () => {
    expect(kickoffSlotKey('2026-09-12T14:00:00.000Z')).toBe('20260912T1400');
    expect(kickoffSlotKey('2026-09-12T14:00:00+00:00')).toBe('20260912T1400');
    expect(kickoffSlotKey('2026-09-12T14:00:45.123Z')).toBe('20260912T1400');
    expect(kickoffSlotKey('2026-09-12T15:00:00.000Z')).toBe('20260912T1500');
    expect(kickoffSlotKey(null)).toBeNull();
  });

  it('builds slot event ids', () => {
    expect(buildKickoffSlotEventId(4, '20260912T1400', 1)).toBe(
      'kickoff:slot:4:20260912T1400:1'
    );
  });
});
