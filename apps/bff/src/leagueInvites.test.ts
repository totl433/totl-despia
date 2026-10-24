import { describe, expect, it } from 'vitest';

import {
  LEAGUE_INVITES_PREF_KEY,
  LEAGUE_INVITES_SENT_PREF_KEY,
  collectLeagueInvitees,
  mergeProtectedPreferences,
  pendingInvites,
  publicPreferences,
  setInviteStatus,
  upsertPendingInvite,
  upsertSentInvite,
} from './leagueInvites';

const invite = {
  id: 'inv-1',
  leagueId: 'lg-1',
  leagueName: 'Easy League',
  leagueCode: 'EASY1',
  leagueAvatar: null,
  invitedById: 'u-1',
  invitedByName: 'Carl',
  createdAt: '2026-10-24T10:00:00.000Z',
  status: 'pending' as const,
};

describe('league invite storage', () => {
  it('hides stored invites from notification toggles', () => {
    expect(
      publicPreferences({
        goals: true,
        [LEAGUE_INVITES_PREF_KEY]: [invite],
        [LEAGUE_INVITES_SENT_PREF_KEY]: [{ id: 's1', leagueId: 'lg-1', inviteeId: 'u-2', inviteeName: 'Carl', createdAt: invite.createdAt }],
      })
    ).toEqual({ goals: true });
  });

  it('keeps stored invites when notification toggles are saved', () => {
    const sent = [{ id: 's1', leagueId: 'lg-1', inviteeId: 'u-2', inviteeName: 'Carl', createdAt: invite.createdAt }];
    const merged = mergeProtectedPreferences(
      { goals: true, [LEAGUE_INVITES_PREF_KEY]: [invite], [LEAGUE_INVITES_SENT_PREF_KEY]: sent },
      {
        goals: false,
        [LEAGUE_INVITES_PREF_KEY]: [],
        [LEAGUE_INVITES_SENT_PREF_KEY]: [],
      }
    );
    expect(merged.goals).toBe(false);
    expect(merged[LEAGUE_INVITES_PREF_KEY]).toEqual([invite]);
    expect(merged[LEAGUE_INVITES_SENT_PREF_KEY]).toEqual(sent);
  });

  it('does not add a second pending invite for the same league', () => {
    const next = upsertPendingInvite([invite], { ...invite, id: 'inv-2', invitedByName: 'Joff' });
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe('inv-1');
  });

  it('reopens a dismissed invite', () => {
    const next = upsertPendingInvite([{ ...invite, status: 'dismissed' }], { ...invite, invitedByName: 'Joff' });
    expect(next).toHaveLength(1);
    expect(next[0]?.status).toBe('pending');
    expect(next[0]?.invitedByName).toBe('Joff');
  });

  it('accepts the oldest pending invite first', () => {
    const later = { ...invite, id: 'inv-2', createdAt: '2026-10-24T12:00:00.000Z' };
    expect(pendingInvites([later, invite]).map((row) => row.id)).toEqual(['inv-1', 'inv-2']);
    expect(setInviteStatus([invite], 'inv-1', 'accepted')[0]?.status).toBe('accepted');
  });

  it('shows invitees as waiting, joined, or declined', () => {
    const sent = upsertSentInvite(
      [],
      { id: 's1', leagueId: 'lg-1', inviteeId: 'u-3', inviteeName: 'Alex', createdAt: invite.createdAt }
    );
    const rows = collectLeagueInvitees({
      leagueId: 'lg-1',
      inbound: [
        { userId: 'u-2', invites: [invite] },
        { userId: 'u-4', invites: [{ ...invite, id: 'inv-2', status: 'dismissed' }] },
      ],
      sent,
      members: ['u-2'],
      profiles: [
        { id: 'u-2', name: 'Carl', avatarUrl: null },
        { id: 'u-3', name: 'Alex', avatarUrl: null },
        { id: 'u-4', name: 'Thomas', avatarUrl: null },
      ],
    });
    expect(rows.map((row) => [row.name, row.status])).toEqual([
      ['Alex', 'waiting'],
      ['Thomas', 'declined'],
      ['Carl', 'joined'],
    ]);
  });
});
