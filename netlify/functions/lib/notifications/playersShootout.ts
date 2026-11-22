/**
 * The Players Shootout push: who gets it and what it says.
 * The challenge row is the truth; the event from the BFF only says which kind of
 * move just happened. Anything the row doesn't back up sends nothing.
 */

export type ShootoutPushEvent = 'invite' | 'accepted' | 'your-turn' | 'finished';

export type ShootoutPushRow = {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status: string;
  turn_user_id: string | null;
  winner_id: string | null;
  version: number;
  state: {
    endReason?: string | null;
    games?: Array<{
      suddenDeath?: boolean;
      finished?: boolean;
      winnerId?: string | null;
      rounds?: Array<{ kicks?: Array<{ userId: string; correct: boolean | null; answeredAt: string | null }> }>;
    }>;
  } | null;
};

export type ShootoutPush = { recipientId: string; title: string; body: string };

export function buildShootoutPublicUrl(challengeId: string): string {
  return `https://playtotl.com/players/shootout/${encodeURIComponent(challengeId)}`;
}

function regularScore(row: ShootoutPushRow, userId: string): { me: number; them: number } {
  let me = 0;
  let them = 0;
  for (const g of row.state?.games ?? []) {
    if (g.suddenDeath || !g.finished || !g.winnerId) continue;
    if (g.winnerId === userId) me += 1;
    else them += 1;
  }
  return { me, them };
}

/**
 * The push for `event`, sent by `actorId`, or null if the challenge doesn't back it up.
 * `actorName` is the sender's display name.
 */
export function buildShootoutPush(
  row: ShootoutPushRow,
  event: ShootoutPushEvent,
  actorId: string,
  actorName: string
): ShootoutPush | null {
  if (actorId !== row.challenger_id && actorId !== row.opponent_id) return null;
  const recipientId = actorId === row.challenger_id ? row.opponent_id : row.challenger_id;
  const name = actorName.trim() || 'Someone';

  if (event === 'invite') {
    if (row.status !== 'pending' || actorId !== row.challenger_id) return null;
    return {
      recipientId,
      title: `${name} wants a Shootout`,
      body: "The Players, head to head. You've got 24 hours to accept.",
    };
  }

  if (event === 'accepted') {
    if (row.status !== 'active' || actorId !== row.opponent_id || row.turn_user_id !== recipientId) return null;
    return {
      recipientId,
      title: `${name} accepted your Shootout`,
      body: "You're up first. You've got 24 hours to play your card.",
    };
  }

  if (event === 'your-turn') {
    if (row.status !== 'active' || row.turn_user_id !== recipientId) return null;
    const game = row.state?.games?.[row.state.games.length - 1];
    const round = game?.rounds?.[game.rounds.length - 1];
    const kicks = round?.kicks ?? [];
    // Mid-card: the actor has just played and the recipient plays the same card.
    const actorKick = kicks.length === 1 && kicks[0]?.userId === actorId && kicks[0]?.answeredAt ? kicks[0] : null;
    let body = 'Your card is ready.';
    if (actorKick?.correct === true) body = `${name} scored. Match it to stay in.`;
    else if (actorKick?.correct === false) body = `${name} missed. Score to win the round.`;
    if (game?.suddenDeath && actorKick) {
      body = actorKick.correct ? `Sudden death. ${name} scored. Match it to stay in.` : `Sudden death. ${name} missed. Score to win it.`;
    }
    return { recipientId, title: `Your turn vs ${name}`, body };
  }

  if (event === 'finished') {
    if (row.status !== 'finished' || !row.winner_id) return null;
    if (row.state?.endReason === 'left' && row.winner_id === recipientId) {
      return { recipientId, title: `${name} left the Shootout`, body: 'You win. Fancy another?' };
    }
    const score = regularScore(row, recipientId);
    const sudden = (row.state?.games ?? []).some((g) => g.suddenDeath);
    const scoreLine = `${score.me}–${score.them}${sudden ? ', decided in sudden death' : ''}`;
    return row.winner_id === recipientId
      ? { recipientId, title: `You beat ${name} in the Shootout`, body: `Final score ${scoreLine}.` }
      : { recipientId, title: `${name} won the Shootout`, body: `Final score ${scoreLine}. Fancy a rematch?` };
  }

  return null;
}
