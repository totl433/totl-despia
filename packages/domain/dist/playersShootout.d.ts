import type { ShootoutCard, ShootoutClub } from './playersShootoutDeck.js';
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
export declare const SHOOTOUT_TURN_MS: number;
export declare const SHOOTOUT_KICK_MS = 10000;
/**
 * Allowance on top of the 10 seconds: the app starts its clock once the card has
 * flipped in (up to 1.5s, as in the daily game), plus the answer's trip to the server.
 */
export declare const SHOOTOUT_KICK_GRACE_MS = 4000;
export declare const SHOOTOUT_REGULAR_GAMES = 3;
/** Challenges a player can have waiting or in play at once. */
export declare const SHOOTOUT_MAX_OPEN = 10;
export type ShootoutStatus = 'pending' | 'active' | 'finished' | 'declined' | 'expired' | 'cancelled';
export type ShootoutKick = {
    userId: string;
    shownAt: string;
    answeredAt: string | null;
    pick: string | null;
    correct: boolean | null;
    timedOut: boolean;
};
export type ShootoutRound = {
    card: ShootoutCard;
    kicks: ShootoutKick[];
};
export type ShootoutGame = {
    number: number;
    suddenDeath: boolean;
    firstUserId: string;
    seed: number;
    rounds: ShootoutRound[];
    finished: boolean;
    /** Null with `finished` means drawn. */
    winnerId: string | null;
};
export type ShootoutState = {
    v: 1;
    acceptedAt: string | null;
    finishedAt: string | null;
    /** forfeit: someone ran out of time. left: someone quit with the X. */
    endReason: 'played' | 'forfeit' | 'left' | null;
    games: ShootoutGame[];
};
export type ShootoutChallenge = {
    id: string;
    challengerId: string;
    opponentId: string;
    status: ShootoutStatus;
    turnUserId: string | null;
    turnDeadline: string | null;
    winnerId: string | null;
    state: ShootoutState;
    version: number;
    createdAt: string;
    updatedAt: string;
};
/** What the routes give the engine to deal a card. */
export type ShootoutDealer = (input: {
    seed: number;
    band: number;
    usedPlayerKeys: string[];
    cardNumber: number;
}) => ShootoutCard;
export declare class ShootoutError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number);
}
export declare function emptyShootoutState(): ShootoutState;
export declare function newShootoutChallenge(input: {
    id: string;
    challengerId: string;
    opponentId: string;
    now: number;
}): ShootoutChallenge;
export declare function otherPlayer(c: ShootoutChallenge, userId: string): string;
/** The kick a player has open (card shown, not answered), if any. */
export declare function openKick(c: ShootoutChallenge, userId?: string): {
    round: ShootoutRound;
    kick: ShootoutKick;
} | null;
export declare function regularScore(c: ShootoutChallenge): {
    challenger: number;
    opponent: number;
    played: number;
};
/**
 * Applies anything that has run out by `now`: an unanswered card past its 10
 * seconds, a turn past its 24 hours, an invite nobody accepted.
 * Returns true if the challenge changed.
 */
export declare function settleShootout(c: ShootoutChallenge, now: number): boolean;
export declare function respondToShootout(c: ShootoutChallenge, userId: string, accept: boolean, now: number, seed: number): void;
export declare function cancelShootout(c: ShootoutChallenge, userId: string, now: number): void;
/**
 * A player quits with the X. In play: the other player wins. Not yet accepted:
 * the challenger's invite is cancelled, or the challenged player declines.
 * Anything already over is left as it is.
 */
export declare function leaveShootout(c: ShootoutChallenge, userId: string, now: number): void;
/**
 * Shows the player their card and starts their 10 seconds. Opening it again
 * while the 10 seconds are running returns the same card; the clock keeps going.
 */
export declare function revealShootoutCard(c: ShootoutChallenge, userId: string, now: number, deal: ShootoutDealer): ShootoutKick;
export declare function answerShootoutCard(c: ShootoutChallenge, userId: string, 
/** `pick: null` is the app saying the clock ran out. */
input: {
    cardId: string;
    pick: string | null;
}, now: number): {
    correct: boolean;
    timedOut: boolean;
};
export type ShootoutPerson = {
    id: string;
    name: string;
    avatarUrl: string | null;
};
export type ShootoutCardView = {
    id: string;
    playerName: string;
    questionSeason: string | null;
    difficulty: ShootoutCard['difficulty'];
    options: ShootoutClub[];
    /** Only once the viewer has played this card. */
    correct: ShootoutClub | null;
    yearsAtClub: string | null;
    appearances: number | null;
};
export type ShootoutKickView = {
    played: boolean;
    correct: boolean | null;
    timedOut: boolean;
    pick: string | null;
};
export type ShootoutRoundView = {
    number: number;
    /** Null until the viewer has played it (so the other player's turn can't be looked up). */
    card: ShootoutCardView | null;
    me: ShootoutKickView;
    them: ShootoutKickView;
};
export type ShootoutGameView = {
    number: number;
    suddenDeath: boolean;
    iGoFirst: boolean;
    result: 'me' | 'them' | 'draw' | null;
    rounds: ShootoutRoundView[];
};
export type ShootoutView = {
    id: string;
    status: ShootoutStatus;
    iAmChallenger: boolean;
    me: ShootoutPerson;
    them: ShootoutPerson;
    /** Games won in the three regular games. */
    score: {
        me: number;
        them: number;
    };
    /** respond: accept or decline. play: your card. waiting: their move. done: over. */
    nextAction: 'respond' | 'play' | 'waiting' | 'done';
    turnDeadline: string | null;
    result: 'won' | 'lost' | null;
    endReason: 'played' | 'forfeit' | 'left' | null;
    /** The card the viewer has open right now, without its answer. */
    openCard: {
        card: ShootoutCardView;
        shownAt: string;
        msLeft: number;
    } | null;
    games: ShootoutGameView[];
    createdAt: string;
    updatedAt: string;
};
export declare function shootoutViewFor(c: ShootoutChallenge, viewerId: string, people: Map<string, ShootoutPerson>, now: number): ShootoutView;
//# sourceMappingURL=playersShootout.d.ts.map