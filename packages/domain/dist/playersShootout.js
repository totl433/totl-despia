/**
 * The Players Shootout: rules.
 *
 * A challenge is three games, then sudden death if it's level.
 *   - Each game is played card by card. The game's first player plays a card,
 *     then the other player plays the same card.
 *   - Both right: next card. One right: they win the game. Both wrong: the game is drawn.
 *   - The challenge ends early once one player can't be caught.
 *   - Level after three games (1–1 with a draw, or three draws): sudden death.
 *     Cards are picked at random from the bands until one player is right and the
 *     other wrong. That player wins the challenge.
 * The challenger goes first on every card, in every round and in sudden death.
 *
 * Timers:
 *   - 10 seconds to answer once a card is shown (plus a little for the network).
 *     Seeing a card and not answering counts as wrong.
 *   - 24 hours to take a turn. Missing it forfeits the challenge to the other player.
 *     An invite not accepted in 24 hours expires.
 *
 * Everything here is pure: the BFF loads a challenge, calls these, and saves it.
 * The app's admin sandbox runs the same functions against an in-memory challenge.
 */
export const SHOOTOUT_TURN_MS = 24 * 60 * 60 * 1000;
export const SHOOTOUT_KICK_MS = 10_000;
/**
 * Allowance on top of the 10 seconds: the app starts its clock once the card has
 * flipped in (up to 1.5s, as in the daily game), plus the answer's trip to the server.
 */
export const SHOOTOUT_KICK_GRACE_MS = 4_000;
export const SHOOTOUT_REGULAR_GAMES = 3;
/** Challenges a player can have waiting or in play at once. */
export const SHOOTOUT_MAX_OPEN = 10;
export class ShootoutError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}
const iso = (ms) => new Date(ms).toISOString();
export function emptyShootoutState() {
    return { v: 1, acceptedAt: null, finishedAt: null, endReason: null, games: [] };
}
export function newShootoutChallenge(input) {
    if (input.challengerId === input.opponentId)
        throw new ShootoutError("You can't challenge yourself.", 400);
    return {
        id: input.id,
        challengerId: input.challengerId,
        opponentId: input.opponentId,
        status: 'pending',
        turnUserId: input.opponentId,
        turnDeadline: iso(input.now + SHOOTOUT_TURN_MS),
        winnerId: null,
        state: emptyShootoutState(),
        version: 0,
        createdAt: iso(input.now),
        updatedAt: iso(input.now),
    };
}
export function otherPlayer(c, userId) {
    return userId === c.challengerId ? c.opponentId : c.challengerId;
}
function isPlayer(c, userId) {
    return userId === c.challengerId || userId === c.opponentId;
}
function currentGame(c) {
    const g = c.state.games[c.state.games.length - 1];
    return g && !g.finished ? g : null;
}
function lastRound(g) {
    return g.rounds[g.rounds.length - 1] ?? null;
}
function roundDone(r) {
    return r.kicks.length === 2 && r.kicks.every((k) => k.answeredAt != null);
}
/** The kick a player has open (card shown, not answered), if any. */
export function openKick(c, userId) {
    const g = currentGame(c);
    const r = g ? lastRound(g) : null;
    if (!r)
        return null;
    const kick = r.kicks.find((k) => k.answeredAt == null && (!userId || k.userId === userId));
    return kick ? { round: r, kick } : null;
}
/** First player of a game: always the challenger. */
function firstPlayerFor(c, _gameNumber) {
    return c.challengerId;
}
function startGame(c, suddenDeath, seed) {
    const number = c.state.games.length + 1;
    const game = {
        number,
        suddenDeath,
        firstUserId: firstPlayerFor(c, number),
        seed,
        rounds: [],
        finished: false,
        winnerId: null,
    };
    c.state.games.push(game);
    return game;
}
export function regularScore(c) {
    let challenger = 0;
    let opponent = 0;
    let played = 0;
    for (const g of c.state.games) {
        if (g.suddenDeath || !g.finished)
            continue;
        played += 1;
        if (g.winnerId === c.challengerId)
            challenger += 1;
        else if (g.winnerId === c.opponentId)
            opponent += 1;
    }
    return { challenger, opponent, played };
}
function finish(c, winnerId, reason, at) {
    c.status = 'finished';
    c.winnerId = winnerId;
    c.turnUserId = null;
    c.turnDeadline = null;
    c.state.endReason = reason;
    c.state.finishedAt = iso(at);
}
/** Seeds for the next game come from the last one, so a challenge is reproducible from its first seed. */
function nextSeed(c) {
    const last = c.state.games[c.state.games.length - 1];
    return ((last?.seed ?? 1) * 1103515245 + 12345) >>> 0;
}
function afterGame(c, game, at) {
    if (game.suddenDeath) {
        finish(c, game.winnerId, 'played', at);
        return;
    }
    const { challenger, opponent, played } = regularScore(c);
    const remaining = SHOOTOUT_REGULAR_GAMES - played;
    const lead = Math.abs(challenger - opponent);
    if (lead > remaining) {
        finish(c, challenger > opponent ? c.challengerId : c.opponentId, 'played', at);
        return;
    }
    const next = startGame(c, remaining === 0, nextSeed(c));
    c.turnUserId = next.firstUserId;
    c.turnDeadline = iso(at + SHOOTOUT_TURN_MS);
}
/** Move the challenge on after a kick has been answered (or timed out) at `at`. */
function advanceAfterKick(c, at) {
    const game = currentGame(c);
    const round = game ? lastRound(game) : null;
    if (!game || !round)
        return;
    if (round.kicks.length === 1) {
        c.turnUserId = otherPlayer(c, round.kicks[0].userId);
        c.turnDeadline = iso(at + SHOOTOUT_TURN_MS);
        return;
    }
    const [a, b] = round.kicks;
    if (a.correct && b.correct) {
        // Both scored: next card, same player first.
    }
    else if (a.correct !== b.correct) {
        game.finished = true;
        game.winnerId = a.correct ? a.userId : b.userId;
    }
    else if (!game.suddenDeath) {
        game.finished = true;
        game.winnerId = null;
    }
    if (game.finished) {
        afterGame(c, game, at);
        return;
    }
    c.turnUserId = game.firstUserId;
    c.turnDeadline = iso(at + SHOOTOUT_TURN_MS);
}
/**
 * Applies anything that has run out by `now`: an unanswered card past its 10
 * seconds, a turn past its 24 hours, an invite nobody accepted.
 * Returns true if the challenge changed.
 */
export function settleShootout(c, now) {
    let changed = false;
    for (let guard = 0; guard < 8; guard++) {
        if (c.status === 'pending') {
            if (c.turnDeadline && Date.parse(c.turnDeadline) < now) {
                c.status = 'expired';
                c.turnUserId = null;
                c.turnDeadline = null;
                changed = true;
            }
            break;
        }
        if (c.status !== 'active')
            break;
        const open = openKick(c);
        if (open) {
            const shownAt = Date.parse(open.kick.shownAt);
            if (now <= shownAt + SHOOTOUT_KICK_MS + SHOOTOUT_KICK_GRACE_MS)
                break;
            open.kick.answeredAt = iso(shownAt + SHOOTOUT_KICK_MS);
            open.kick.pick = null;
            open.kick.correct = false;
            open.kick.timedOut = true;
            advanceAfterKick(c, shownAt + SHOOTOUT_KICK_MS);
            changed = true;
            continue;
        }
        if (c.turnUserId && c.turnDeadline && Date.parse(c.turnDeadline) < now) {
            finish(c, otherPlayer(c, c.turnUserId), 'forfeit', Date.parse(c.turnDeadline));
            changed = true;
        }
        break;
    }
    if (changed)
        c.updatedAt = iso(now);
    return changed;
}
export function respondToShootout(c, userId, accept, now, seed) {
    settleShootout(c, now);
    if (c.status !== 'pending')
        throw new ShootoutError('This challenge is no longer waiting for an answer.', 409);
    if (userId !== c.opponentId)
        throw new ShootoutError('Only the player who was challenged can answer.', 403);
    if (!accept) {
        c.status = 'declined';
        c.turnUserId = null;
        c.turnDeadline = null;
    }
    else {
        c.status = 'active';
        c.state.acceptedAt = iso(now);
        const game = startGame(c, false, seed >>> 0);
        c.turnUserId = game.firstUserId;
        c.turnDeadline = iso(now + SHOOTOUT_TURN_MS);
    }
    c.updatedAt = iso(now);
}
export function cancelShootout(c, userId, now) {
    settleShootout(c, now);
    if (c.status !== 'pending')
        throw new ShootoutError('This challenge has already started.', 409);
    if (userId !== c.challengerId)
        throw new ShootoutError('Only the challenger can cancel.', 403);
    c.status = 'cancelled';
    c.turnUserId = null;
    c.turnDeadline = null;
    c.updatedAt = iso(now);
}
/**
 * A player quits with the X. In play: the other player wins. Not yet accepted:
 * the challenger's invite is cancelled, or the challenged player declines.
 * Anything already over is left as it is.
 */
export function leaveShootout(c, userId, now) {
    settleShootout(c, now);
    if (!isPlayer(c, userId))
        throw new ShootoutError('Challenge not found.', 404);
    if (c.status === 'pending') {
        c.status = userId === c.challengerId ? 'cancelled' : 'declined';
        c.turnUserId = null;
        c.turnDeadline = null;
    }
    else if (c.status === 'active') {
        finish(c, otherPlayer(c, userId), 'left', now);
    }
    else {
        return;
    }
    c.updatedAt = iso(now);
}
function usedPlayerKeys(c) {
    return c.state.games.flatMap((g) => g.rounds.map((r) => r.card.playerKey));
}
/**
 * Shows the player their card and starts their 10 seconds. Opening it again
 * while the 10 seconds are running returns the same card; the clock keeps going.
 */
export function revealShootoutCard(c, userId, now, deal) {
    settleShootout(c, now);
    if (!isPlayer(c, userId))
        throw new ShootoutError('Challenge not found.', 404);
    if (c.status !== 'active')
        throw new ShootoutError('This challenge is over.', 409);
    const open = openKick(c, userId);
    if (open)
        return open.kick;
    if (c.turnUserId !== userId)
        throw new ShootoutError("It's not your turn.", 409);
    const game = currentGame(c);
    if (!game)
        throw new ShootoutError('This challenge is over.', 409);
    const kick = {
        userId,
        shownAt: iso(now),
        answeredAt: null,
        pick: null,
        correct: null,
        timedOut: false,
    };
    const round = lastRound(game);
    if (!round || roundDone(round)) {
        const roundIndex = game.rounds.length;
        const cardSeed = (game.seed + Math.imul(roundIndex + 1, 0x9e3779b1)) >>> 0;
        // Sudden death: a band at random. Otherwise card N follows the daily deck's card N, looping after 10.
        const band = game.suddenDeath ? Math.floor(((cardSeed % 1000) / 1000) * 10) : roundIndex;
        const card = deal({ seed: cardSeed, band, usedPlayerKeys: usedPlayerKeys(c), cardNumber: roundIndex });
        game.rounds.push({ card, kicks: [kick] });
    }
    else {
        round.kicks.push(kick);
    }
    c.updatedAt = iso(now);
    return kick;
}
export function answerShootoutCard(c, userId, 
/** `pick: null` is the app saying the clock ran out. */
input, now) {
    const open = openKick(c, userId);
    settleShootout(c, now);
    if (open && open.kick.timedOut)
        return { correct: false, timedOut: true };
    if (!open || open.round.card.id !== input.cardId) {
        throw new ShootoutError('That card is no longer open.', 409);
    }
    const timedOut = input.pick == null;
    const correct = !timedOut && input.pick === open.round.card.correct.clubCode;
    open.kick.answeredAt = iso(now);
    open.kick.pick = input.pick;
    open.kick.correct = correct;
    open.kick.timedOut = timedOut;
    advanceAfterKick(c, now);
    c.updatedAt = iso(now);
    return { correct, timedOut };
}
function cardView(card, withAnswer) {
    return {
        id: card.id,
        playerName: card.playerName,
        questionSeason: card.questionSeason,
        difficulty: card.difficulty,
        options: card.options,
        correct: withAnswer ? card.correct : null,
        yearsAtClub: withAnswer ? card.yearsAtClub : null,
        appearances: withAnswer ? card.appearances : null,
    };
}
const NO_KICK = { played: false, correct: null, timedOut: false, pick: null };
export function shootoutViewFor(c, viewerId, people, now) {
    const themId = otherPlayer(c, viewerId);
    const over = c.status !== 'active' && c.status !== 'pending';
    const person = (id) => people.get(id) ?? { id, name: 'A player', avatarUrl: null };
    const regular = regularScore(c);
    const iAmChallenger = viewerId === c.challengerId;
    const games = c.state.games.map((g) => ({
        number: g.number,
        suddenDeath: g.suddenDeath,
        iGoFirst: g.firstUserId === viewerId,
        result: !g.finished ? null : g.winnerId == null ? 'draw' : g.winnerId === viewerId ? 'me' : 'them',
        rounds: g.rounds.map((r, i) => {
            const mine = r.kicks.find((k) => k.userId === viewerId);
            const theirs = r.kicks.find((k) => k.userId === themId);
            const iPlayed = !!mine?.answeredAt;
            const showCard = iPlayed || over;
            return {
                number: i + 1,
                card: showCard ? cardView(r.card, true) : null,
                me: mine?.answeredAt
                    ? { played: true, correct: mine.correct, timedOut: mine.timedOut, pick: mine.pick }
                    : NO_KICK,
                // Like a penalty: you know whether their kick went in, not where they put it, until you've taken yours.
                them: theirs?.answeredAt
                    ? { played: true, correct: theirs.correct, timedOut: theirs.timedOut, pick: showCard ? theirs.pick : null }
                    : NO_KICK,
            };
        }),
    }));
    const open = c.status === 'active' ? openKick(c, viewerId) : null;
    let nextAction = 'done';
    if (c.status === 'pending')
        nextAction = iAmChallenger ? 'waiting' : 'respond';
    else if (c.status === 'active')
        nextAction = c.turnUserId === viewerId || open ? 'play' : 'waiting';
    return {
        id: c.id,
        status: c.status,
        iAmChallenger,
        me: person(viewerId),
        them: person(themId),
        score: iAmChallenger
            ? { me: regular.challenger, them: regular.opponent }
            : { me: regular.opponent, them: regular.challenger },
        nextAction,
        turnDeadline: c.turnDeadline,
        result: c.status === 'finished' && c.winnerId ? (c.winnerId === viewerId ? 'won' : 'lost') : null,
        endReason: c.state.endReason,
        openCard: open
            ? {
                card: cardView(open.round.card, false),
                shownAt: open.kick.shownAt,
                msLeft: Math.max(0, Date.parse(open.kick.shownAt) + SHOOTOUT_KICK_MS - now),
            }
            : null,
        games,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
    };
}
