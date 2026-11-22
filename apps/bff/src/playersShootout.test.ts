import { describe, expect, it } from 'vitest';

import {
  SHOOTOUT_KICK_GRACE_MS,
  SHOOTOUT_KICK_MS,
  SHOOTOUT_TURN_MS,
  answerShootoutCard,
  cancelShootout,
  leaveShootout,
  newShootoutChallenge,
  respondToShootout,
  revealShootoutCard,
  settleShootout,
  shootoutViewFor,
  type ShootoutChallenge,
  type ShootoutDealer,
  dealShootoutCard,
  type ShootoutCatalogRow,
} from '@totl/domain';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const T0 = Date.parse('2026-11-22T12:00:00Z');

/** Every card's right answer is "RIGHT"; "WRONG" is always an option. */
const deal: ShootoutDealer = ({ cardNumber, band, seed }) => ({
  id: `card-${cardNumber}-${band}-${seed}`,
  playerKey: `p-${cardNumber}-${seed}`,
  playerName: `Player ${cardNumber}`,
  questionSeason: '96/97',
  yearsAtClub: '1996 - 1999',
  appearances: 100,
  difficulty: 'easy',
  correct: { clubCode: 'RIGHT', clubName: 'Right FC' },
  options: [
    { clubCode: 'RIGHT', clubName: 'Right FC' },
    { clubCode: 'WRONG', clubName: 'Wrong FC' },
    { clubCode: 'OTHER', clubName: 'Other FC' },
  ],
});

function started(): { c: ShootoutChallenge; t: number } {
  const c = newShootoutChallenge({ id: 'c1', challengerId: A, opponentId: B, now: T0 });
  respondToShootout(c, B, true, T0 + 1000, 42);
  return { c, t: T0 + 2000 };
}

/** The player whose turn it is plays one card. */
function kick(c: ShootoutChallenge, t: number, right: boolean) {
  const userId = c.turnUserId!;
  revealShootoutCard(c, userId, t, deal);
  const card = c.state.games.at(-1)!.rounds.at(-1)!.card;
  return answerShootoutCard(c, userId, { cardId: card.id, pick: right ? 'RIGHT' : 'WRONG' }, t + 2000);
}

describe('players shootout', () => {
  it('waits for the challenged player, then the challenger goes first', () => {
    const c = newShootoutChallenge({ id: 'c1', challengerId: A, opponentId: B, now: T0 });
    expect(c.status).toBe('pending');
    expect(() => respondToShootout(c, A, true, T0, 1)).toThrow();
    respondToShootout(c, B, true, T0 + 1, 1);
    expect(c.status).toBe('active');
    expect(c.turnUserId).toBe(A);
  });

  it('a card both get right deals another; one miss loses the game', () => {
    const { c, t } = started();
    kick(c, t, true); // A
    expect(c.turnUserId).toBe(B);
    kick(c, t + 10_000, true); // B
    expect(c.state.games[0]!.finished).toBe(false);
    expect(c.turnUserId).toBe(A);
    kick(c, t + 20_000, true); // A
    kick(c, t + 30_000, false); // B misses
    expect(c.state.games[0]).toMatchObject({ finished: true, winnerId: A });
    // Game 2: the challenger goes first again.
    expect(c.turnUserId).toBe(A);
    expect(c.state.games[1]!.firstUserId).toBe(A);
  });

  it('wins 2–0 without a third game', () => {
    const { c, t } = started();
    kick(c, t, true);
    kick(c, t + 1e4, false); // A wins game 1
    kick(c, t + 2e4, true); // A (first again) scores
    kick(c, t + 3e4, false); // B misses: A wins game 2
    expect(c.status).toBe('finished');
    expect(c.winnerId).toBe(A);
    expect(c.state.games).toHaveLength(2);
  });

  it('goes to sudden death when level after three games, and plays on through double misses', () => {
    const { c, t } = started();
    kick(c, t, false);
    kick(c, t + 1e4, false); // game 1 drawn
    kick(c, t + 2e4, false);
    kick(c, t + 3e4, false); // game 2 drawn
    kick(c, t + 4e4, false);
    kick(c, t + 5e4, false); // game 3 drawn
    const sd = c.state.games[3]!;
    expect(sd.suddenDeath).toBe(true);
    expect(c.status).toBe('active');
    kick(c, t + 6e4, false);
    kick(c, t + 7e4, false); // both miss: carries on
    expect(sd.finished).toBe(false);
    kick(c, t + 8e4, true);
    kick(c, t + 9e4, true); // both score: carries on
    expect(sd.finished).toBe(false);
    const first = c.turnUserId!;
    kick(c, t + 10e4, true);
    kick(c, t + 11e4, false);
    expect(c.status).toBe('finished');
    expect(c.winnerId).toBe(first);
  });

  it('counts a card left unanswered past 10 seconds as wrong', () => {
    const { c, t } = started();
    revealShootoutCard(c, A, t, deal);
    expect(settleShootout(c, t + SHOOTOUT_KICK_MS)).toBe(false);
    expect(settleShootout(c, t + SHOOTOUT_KICK_MS + SHOOTOUT_KICK_GRACE_MS + 1)).toBe(true);
    const k = c.state.games[0]!.rounds[0]!.kicks[0]!;
    expect(k).toMatchObject({ correct: false, timedOut: true });
    expect(c.turnUserId).toBe(B);
  });

  it('rejects a late answer', () => {
    const { c, t } = started();
    revealShootoutCard(c, A, t, deal);
    const card = c.state.games[0]!.rounds[0]!.card;
    const late = answerShootoutCard(c, A, { cardId: card.id, pick: 'RIGHT' }, t + 20_000);
    expect(late).toEqual({ correct: false, timedOut: true });
  });

  it('takes a pick of null as the clock running out', () => {
    const { c, t } = started();
    revealShootoutCard(c, A, t, deal);
    const card = c.state.games[0]!.rounds[0]!.card;
    expect(answerShootoutCard(c, A, { cardId: card.id, pick: null }, t + 10_000)).toEqual({ correct: false, timedOut: true });
    expect(c.turnUserId).toBe(B);
  });

  it('reopening a card keeps the same card and clock', () => {
    const { c, t } = started();
    const first = revealShootoutCard(c, A, t, deal);
    const again = revealShootoutCard(c, A, t + 3000, deal);
    expect(again.shownAt).toBe(first.shownAt);
    expect(c.state.games[0]!.rounds).toHaveLength(1);
  });

  it('forfeits to the other player after 24 hours without a move', () => {
    const { c, t } = started();
    kick(c, t, true);
    settleShootout(c, t + 2000 + SHOOTOUT_TURN_MS + 1);
    expect(c.status).toBe('finished');
    expect(c.winnerId).toBe(A);
    expect(c.state.endReason).toBe('forfeit');
  });

  it('leaving mid-match hands the Shootout to the other player', () => {
    const { c, t } = started();
    kick(c, t, true);
    leaveShootout(c, B, t + 5000);
    expect(c).toMatchObject({ status: 'finished', winnerId: A, turnUserId: null });
    expect(c.state.endReason).toBe('left');
  });

  it('leaving before the start cancels or declines', () => {
    const a = newShootoutChallenge({ id: 'a', challengerId: A, opponentId: B, now: T0 });
    leaveShootout(a, A, T0);
    expect(a.status).toBe('cancelled');
    const b = newShootoutChallenge({ id: 'b', challengerId: A, opponentId: B, now: T0 });
    leaveShootout(b, B, T0);
    expect(b.status).toBe('declined');
  });

  it('expires an invite nobody answers, and lets the challenger cancel one', () => {
    const c = newShootoutChallenge({ id: 'c1', challengerId: A, opponentId: B, now: T0 });
    settleShootout(c, T0 + SHOOTOUT_TURN_MS + 1);
    expect(c.status).toBe('expired');
    const d = newShootoutChallenge({ id: 'c2', challengerId: A, opponentId: B, now: T0 });
    expect(() => cancelShootout(d, B, T0)).toThrow();
    cancelShootout(d, A, T0);
    expect(d.status).toBe('cancelled');
  });

  it("hides a card from the second player until they've played it", () => {
    const { c, t } = started();
    kick(c, t, true);
    const people = new Map();
    const bView = shootoutViewFor(c, B, people, t + 5000);
    const round = bView.games[0]!.rounds[0]!;
    expect(round.card).toBeNull();
    expect(round.them).toMatchObject({ played: true, correct: true, pick: null });
    expect(bView.nextAction).toBe('play');

    revealShootoutCard(c, B, t + 6000, deal);
    const open = shootoutViewFor(c, B, people, t + 7000).openCard!;
    expect(open.card.correct).toBeNull();
    expect(open.msLeft).toBe(SHOOTOUT_KICK_MS - 1000);

    const aView = shootoutViewFor(c, A, people, t + 7000);
    expect(aView.games[0]!.rounds[0]!.card?.correct?.clubCode).toBe('RIGHT');
    expect(aView.nextAction).toBe('waiting');
  });
});

describe('players shootout deck', () => {
  const rows: ShootoutCatalogRow[] = Array.from({ length: 60 }, (_, i) => ({
    playerName: `Player ${i}`,
    playerKey: `p${i}`,
    clubCode: `C${i % 8}`,
    clubName: `Club ${i % 8}`,
    appearances: [250, 170, 120, 90, 70, 50, 35, 25, 15, 5][i % 10]!,
    wikiViews: 3_000_000,
    firstSeason: '1996/97',
    lastSeason: '1999/00',
    spells: [],
  }));

  it('deals from the right band and skips used players, looping after card 10', () => {
    const card0 = dealShootoutCard(rows, { seed: 1, band: 0, usedPlayerKeys: [], cardNumber: 0 });
    expect(card0.appearances).toBeGreaterThanOrEqual(200);
    expect(card0.options).toHaveLength(3);
    expect(card0.options.map((o) => o.clubCode)).toContain(card0.correct.clubCode);
    const card10 = dealShootoutCard(rows, { seed: 2, band: 10, usedPlayerKeys: [card0.playerKey], cardNumber: 10 });
    expect(card10.appearances).toBeGreaterThanOrEqual(200);
    expect(card10.playerKey).not.toBe(card0.playerKey);
  });

  it('still deals when every player in a band has been used', () => {
    const used = rows.filter((r) => r.appearances >= 200).map((r) => r.playerKey);
    const card = dealShootoutCard(rows, { seed: 3, band: 0, usedPlayerKeys: used, cardNumber: 11 });
    expect(card.playerName).toBeTruthy();
  });
});
