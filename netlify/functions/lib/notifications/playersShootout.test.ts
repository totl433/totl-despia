import { describe, expect, it } from 'vitest';

import { buildShootoutPush, type ShootoutPushRow } from './playersShootout';

const A = 'aaaaaaaa-0000-0000-0000-000000000000';
const B = 'bbbbbbbb-0000-0000-0000-000000000000';

const row = (over: Partial<ShootoutPushRow>): ShootoutPushRow => ({
  id: 'c',
  challenger_id: A,
  opponent_id: B,
  status: 'pending',
  turn_user_id: B,
  winner_id: null,
  version: 0,
  state: { games: [] },
  ...over,
});

describe('players shootout push', () => {
  it('sends the invite to the challenged player only when it is pending', () => {
    expect(buildShootoutPush(row({}), 'invite', A, 'Carl')).toMatchObject({ recipientId: B, title: 'Carl wants a Shootout' });
    expect(buildShootoutPush(row({ status: 'active' }), 'invite', A, 'Carl')).toBeNull();
    expect(buildShootoutPush(row({}), 'invite', B, 'Jof')).toBeNull();
  });

  it('ignores callers who are not in the challenge', () => {
    expect(buildShootoutPush(row({}), 'invite', 'someone-else', 'X')).toBeNull();
  });

  it("says whether the other player's kick went in", () => {
    const scored = row({
      status: 'active',
      turn_user_id: B,
      state: { games: [{ rounds: [{ kicks: [{ userId: A, correct: true, answeredAt: 'x' }] }] }] },
    });
    expect(buildShootoutPush(scored, 'your-turn', A, 'Carl')?.body).toBe('Carl scored. Match it to stay in.');
    // Not their turn: nothing.
    expect(buildShootoutPush({ ...scored, turn_user_id: A }, 'your-turn', A, 'Carl')).toBeNull();
  });

  it('tells each side the result from their point of view', () => {
    const done = row({
      status: 'finished',
      turn_user_id: null,
      winner_id: A,
      state: { games: [{ finished: true, winnerId: A }, { finished: true, winnerId: A }] },
    });
    expect(buildShootoutPush(done, 'finished', A, 'Carl')).toMatchObject({
      recipientId: B,
      title: 'Carl won the Shootout',
      body: 'Final score 0–2. Fancy a rematch?',
    });
    expect(buildShootoutPush({ ...done, winner_id: B }, 'finished', A, 'Carl')?.title).toBe('You beat Carl in the Shootout');
  });

  it('tells the other player when someone leaves', () => {
    const left = row({ status: 'finished', turn_user_id: null, winner_id: B, state: { endReason: 'left', games: [] } });
    expect(buildShootoutPush(left, 'finished', A, 'Carl')).toEqual({
      recipientId: B,
      title: 'Carl left the Shootout',
      body: 'You win. Fancy another?',
    });
  });
});
