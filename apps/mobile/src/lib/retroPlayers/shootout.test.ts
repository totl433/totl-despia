import { describe, expect, it } from 'vitest';
import type { PlayersShootout, PlayersShootoutGame } from '@totl/api-client';

import {
  buildShootoutLink,
  groupShootouts,
  nextShootoutMoment,
  shootoutCardNumber,
  shootoutCardSpec,
  shootoutHeadToHead,
  shootoutClubName,
  shootoutShareMessage,
  shootoutStatusLine,
  shootoutTimeLeft,
  shootoutsNeedingYou,
} from './shootout';

const NOW = Date.parse('2026-11-22T12:00:00Z');
const kick = (played: boolean, correct: boolean | null = null) => ({ played, correct, timedOut: false, pick: null });

function challenge(over: Partial<PlayersShootout> = {}): PlayersShootout {
  return {
    id: 'abc',
    status: 'active',
    iAmChallenger: true,
    me: { id: 'me', name: 'Jof', avatarUrl: null },
    them: { id: 'them', name: 'Carl', avatarUrl: null },
    score: { me: 0, them: 0 },
    nextAction: 'play',
    turnDeadline: new Date(NOW + 5 * 3_600_000 + 1000).toISOString(),
    result: null,
    endReason: null,
    openCard: null,
    games: [],
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

const game = (over: Partial<PlayersShootoutGame> = {}): PlayersShootoutGame => ({
  number: 1,
  suddenDeath: false,
  iGoFirst: false,
  result: null,
  rounds: [],
  ...over,
});

describe('shootout helpers', () => {
  it('builds the link the push and WhatsApp share use', () => {
    expect(buildShootoutLink('abc')).toBe('https://playtotl.com/players/shootout/abc');
    expect(shootoutShareMessage(challenge({ status: 'pending' }))).toContain('https://playtotl.com/players/shootout/abc');
  });

  it('formats time left', () => {
    expect(shootoutTimeLeft(new Date(NOW + 5 * 3_600_000 + 1000).toISOString(), NOW)).toBe('5h left');
    expect(shootoutTimeLeft(new Date(NOW + 20 * 60_000).toISOString(), NOW)).toBe('20m left');
    expect(shootoutTimeLeft(new Date(NOW + 10_000).toISOString(), NOW)).toBe('Less than a minute left');
    expect(shootoutTimeLeft(null, NOW)).toBeNull();
  });

  it('says which round it is when it is your go', () => {
    expect(shootoutStatusLine(challenge({ games: [game({ number: 2 })] }), NOW)).toBe('Round 2 of 3 · 5h left');
    expect(shootoutStatusLine(challenge({ games: [game({ number: 4, suddenDeath: true })] }), NOW)).toBe('Sudden death · 5h left');
  });

  it('describes finished challenges, including forfeits', () => {
    expect(shootoutStatusLine(challenge({ status: 'finished', nextAction: 'done', result: 'won', score: { me: 2, them: 1 }, endReason: 'played' }), NOW)).toBe(
      'You won 2–1'
    );
    expect(shootoutStatusLine(challenge({ status: 'finished', nextAction: 'done', result: 'lost', endReason: 'forfeit' }), NOW)).toBe(
      'You lost · you ran out of time'
    );
    expect(
      shootoutStatusLine(
        challenge({ status: 'finished', nextAction: 'done', result: 'won', endReason: 'played', games: [game({ number: 4, suddenDeath: true, result: 'me' })] }),
        NOW
      )
    ).toBe('You won in sudden death');
  });

  it('groups your move first and counts them', () => {
    const list = [
      challenge({ id: '1', nextAction: 'waiting' }),
      challenge({ id: '2', nextAction: 'respond', status: 'pending' }),
      challenge({ id: '3', nextAction: 'done', status: 'finished' }),
      challenge({ id: '4', nextAction: 'play' }),
    ];
    const g = groupShootouts(list);
    expect(g.yourMove.map((c) => c.id)).toEqual(['2', '4']);
    expect(g.waiting.map((c) => c.id)).toEqual(['1']);
    expect(g.finished.map((c) => c.id)).toEqual(['3']);
    expect(shootoutsNeedingYou(list)).toBe(2);
  });

  it('shows each finished game once, then the Shootout result', () => {
    const won1 = game({ number: 1, result: 'me' });
    const live = challenge({ games: [won1, game({ number: 2 })] });
    expect(nextShootoutMoment(live, new Set())).toMatchObject({ kind: 'game', keys: ['g1'] });
    expect(nextShootoutMoment(live, new Set(['g1']))).toBeNull();
    const done = challenge({ status: 'finished', result: 'won', games: [won1, game({ number: 2, result: 'me' })] });
    expect(nextShootoutMoment(done, new Set(['g1']))).toMatchObject({ kind: 'final', keys: ['final', 'g1', 'g2'] });
    expect(nextShootoutMoment(done, new Set(['final']))).toBeNull();
  });

  it('names picks from the card options', () => {
    const card = {
      id: 'c',
      playerName: 'Gary Neville',
      questionSeason: '93/94',
      difficulty: 'easy' as const,
      options: [
        { clubCode: 'MUN', clubName: 'Man United' },
        { clubCode: 'HUL', clubName: 'Hull' },
      ],
      correct: null,
      yearsAtClub: null,
      appearances: null,
    };
    expect(shootoutClubName(card, 'HUL')).toBe('Hull');
    expect(shootoutClubName(card, null)).toBeNull();
  });

  it('counts the card you are on within the game', () => {
    expect(shootoutCardNumber(game())).toBe(1);
    expect(shootoutCardNumber(game({ rounds: [{ number: 1, card: null, me: kick(false), them: kick(true, true) }] }))).toBe(1);
    expect(shootoutCardNumber(game({ rounds: [{ number: 1, card: null, me: kick(true, true), them: kick(true, true) }] }))).toBe(2);
  });

  it('shows the challenger and the challenged player different cards for the same invite', () => {
    const sent = shootoutCardSpec(challenge({ status: 'pending', nextAction: 'waiting', iAmChallenger: true }), NOW);
    expect(sent).toMatchObject({ title: 'Challenge sent', primary: null, link: { action: 'whatsapp' } });
    const got = shootoutCardSpec(challenge({ status: 'pending', nextAction: 'respond', iAmChallenger: false }), NOW);
    expect(got).toMatchObject({
      title: "You've been challenged",
      headerLabel: '5h left to accept',
      primary: { label: 'Accept', action: 'accept' },
      link: { label: 'No thanks', action: 'decline' },
    });
    expect(got.subtitle).toContain('Carl goes first.');
  });

  it("tells the player who isn't first that they're waiting", () => {
    const start = challenge({ nextAction: 'waiting', iAmChallenger: false, games: [game()] });
    expect(shootoutCardSpec(start, NOW)).toMatchObject({ title: 'Challenge accepted', primary: null, note: 'Carl goes first.' });
    const mine = challenge({ nextAction: 'play', games: [game()] });
    expect(shootoutCardSpec(mine, NOW).primary).toEqual({ label: 'Play', action: 'play' });
  });

  it('between rounds: score in the header, whose turn on the card, the next round on the button', () => {
    const r1 = game({ number: 1, result: 'me', rounds: [{ number: 1, card: null, me: kick(true, true), them: kick(true, false) }] });
    const mine = challenge({ nextAction: 'play', score: { me: 1, them: 0 }, games: [r1, game({ number: 2 })] });
    expect(shootoutCardSpec(mine, NOW)).toMatchObject({
      headerLine: 'Jof 1–0 Carl',
      headerLabel: 'After 1 round',
      body: 'turn',
      title: 'Your turn',
      lines: ['You start Round 2.', 'Over to you…'],
      primary: { label: 'Play Round 2' },
    });
    const theirs = challenge({ nextAction: 'waiting', games: [r1, game({ number: 2 })] });
    expect(shootoutCardSpec(theirs, NOW)).toMatchObject({ title: "Carl's turn", primary: null, link: { action: 'whatsapp' } });
    expect(shootoutCardSpec(theirs, NOW).lines[0]).toBe('Carl starts Round 2.');
  });

  it('words a declined or expired challenge for each side', () => {
    expect(shootoutCardSpec(challenge({ status: 'declined', nextAction: 'done', iAmChallenger: true }), NOW).subtitle).toBe(
      'Carl said no this time.'
    );
    expect(shootoutCardSpec(challenge({ status: 'expired', nextAction: 'done', iAmChallenger: false }), NOW).subtitle).toBe(
      "You didn't accept in time."
    );
    expect(shootoutCardSpec(challenge({ status: 'cancelled', nextAction: 'done', iAmChallenger: false }), NOW)).toMatchObject({
      subtitle: 'Carl cancelled this challenge.',
      primary: { label: 'Challenge Carl', action: 'challenge' },
    });
  });

  it('tells the second player on a card that the other player has already taken it', () => {
    const r = { number: 1, card: null, me: kick(false), them: kick(true, true) };
    const challenged = challenge({ iAmChallenger: false, nextAction: 'play', games: [game({ rounds: [r] })] });
    expect(shootoutCardSpec(challenged, NOW)).toMatchObject({
      title: 'Your turn',
      lines: ['Carl has played card 1.', 'Over to you…'],
      primary: { label: 'Play', action: 'play' },
    });
    const waiting = challenge({
      nextAction: 'waiting',
      games: [game({ rounds: [{ number: 1, card: null, me: kick(true, true), them: kick(false) }] })],
    });
    expect(shootoutCardSpec(waiting, NOW).lines[0]).toBe("You've played card 1.");
  });


  it('counts whole Shootouts won against the same player, newest first', () => {
    const fin = (id: string, result: 'won' | 'lost', at: string, themId = 'them') =>
      challenge({ id, status: 'finished', nextAction: 'done', result, updatedAt: at, them: { id: themId, name: 'Carl', avatarUrl: null } });
    const list = [
      fin('a', 'won', '2026-11-01T00:00:00Z'),
      fin('b', 'lost', '2026-11-05T00:00:00Z'),
      fin('c', 'won', '2026-11-03T00:00:00Z', 'someone-else'),
      challenge({ id: 'd', status: 'active' }),
    ];
    const current = fin('e', 'won', '2026-11-10T00:00:00Z');
    expect(shootoutHeadToHead(list, current)).toEqual({ me: 2, them: 1, played: 3, form: ['W', 'L', 'W'] });
  });
});
