import { describe, expect, it } from 'vitest';
import { capUnreadCount, formatUnreadBadge } from './unreadBadge';

describe('unreadBadge', () => {
  it('caps at 99 and floors', () => {
    expect(capUnreadCount(0)).toBe(0);
    expect(capUnreadCount(-5)).toBe(0);
    expect(capUnreadCount(1)).toBe(1);
    expect(capUnreadCount(1.9)).toBe(1);
    expect(capUnreadCount(99)).toBe(99);
    expect(capUnreadCount(100)).toBe(99);
    expect(capUnreadCount(9999)).toBe(99);
  });

  it('formats badge label or null', () => {
    expect(formatUnreadBadge(0)).toBeNull();
    expect(formatUnreadBadge(-1)).toBeNull();
    expect(formatUnreadBadge(2)).toBe('2');
    expect(formatUnreadBadge(120)).toBe('99');
  });
});

