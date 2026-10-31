import { describe, expect, it } from 'vitest';

import {
  chunk,
  isPlayersReminderTime,
  londonClock,
  playersDailyEventId,
  playersDayKey,
  playersReminderRecipients,
  wantsPlayersDaily,
} from './playersDaily';

describe('players daily reminder', () => {
  it('sends at 9:30 London in summer, which is 08:30 UTC', () => {
    expect(londonClock(new Date('2026-07-01T08:30:00Z'))).toEqual({ hour: 9, minute: 30 });
    expect(isPlayersReminderTime(new Date('2026-07-01T08:30:00Z'))).toBe(true);
    expect(isPlayersReminderTime(new Date('2026-07-01T09:30:00Z'))).toBe(false);
  });

  it('sends at 9:30 London in winter, which is 09:30 UTC', () => {
    expect(isPlayersReminderTime(new Date('2026-12-01T09:30:00Z'))).toBe(true);
    expect(isPlayersReminderTime(new Date('2026-12-01T08:30:00Z'))).toBe(false);
  });

  it('allows a late cron run but not a much later one', () => {
    expect(isPlayersReminderTime(new Date('2026-12-01T09:41:00Z'))).toBe(true);
    expect(isPlayersReminderTime(new Date('2026-12-01T09:45:00Z'))).toBe(false);
    expect(isPlayersReminderTime(new Date('2026-12-01T09:29:00Z'))).toBe(false);
  });

  it('keys the send by the UTC Players day', () => {
    expect(playersDailyEventId(playersDayKey(new Date('2026-10-22T08:30:00Z')))).toBe('players_daily:2026-10-22');
  });

  it('is on unless Daily Game Reminders is off', () => {
    expect(wantsPlayersDaily(undefined)).toBe(true);
    expect(wantsPlayersDaily({ 'chat-messages': false })).toBe(true);
    expect(wantsPlayersDaily({ 'daily-game-reminders': true })).toBe(true);
    expect(wantsPlayersDaily({ 'daily-game-reminders': false })).toBe(false);
  });

  it('skips anyone who has already played today, and anyone who switched it off', () => {
    const device = (user_id: string, player_id: string) => ({ user_id, player_id, subscribed: true, invalid: false });
    const result = playersReminderRecipients(
      [device('fresh', 'p1'), device('played', 'p2'), device('played', 'p3'), device('off', 'p4')],
      new Map([['off', { 'daily-game-reminders': false }]]),
      new Set(['played']),
    );
    expect(result.playerIds).toEqual(['p1']);
    expect([...result.userIds]).toEqual(['fresh']);
    expect([...result.alreadyPlayed]).toEqual(['played']);
    expect([...result.optedOut]).toEqual(['off']);
  });

  it('skips dead devices', () => {
    const result = playersReminderRecipients(
      [
        { user_id: 'a', player_id: null, subscribed: true, invalid: false },
        { user_id: 'b', player_id: 'p', subscribed: false, invalid: false },
        { user_id: 'c', player_id: 'q', subscribed: true, invalid: true },
      ],
      new Map(),
      new Set(),
    );
    expect(result.playerIds).toEqual([]);
  });

  it('splits devices into OneSignal-sized batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
