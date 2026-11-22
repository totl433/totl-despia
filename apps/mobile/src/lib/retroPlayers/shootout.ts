import type { PlayersShootout, PlayersShootoutCard, PlayersShootoutGame } from '@totl/api-client';

import type { PlayersCard } from './buildPuzzle';
import { APP_LINK_BASE_URL } from '../deepLinks';

/** The Players Shootout: copy and small helpers shared by its screens. Rules live in the BFF. */

/** React Query key for your list of Shootouts. */
export const SHOOTOUTS_QUERY_KEY = ['players-shootouts'] as const;

export function buildShootoutLink(id: string): string {
  return `${APP_LINK_BASE_URL}/players/shootout/${encodeURIComponent(id)}`;
}

/**
 * Home and away: the challenger is always home (left), the challenged player away (right),
 * wherever both players or the score are shown together.
 */
export function shootoutSides(c: PlayersShootout) {
  const meHome = c.iAmChallenger;
  return {
    home: meHome ? c.me : c.them,
    away: meHome ? c.them : c.me,
    homeIsMe: meHome,
    homeScore: meHome ? c.score.me : c.score.them,
    awayScore: meHome ? c.score.them : c.score.me,
  };
}

/** "Jof 1–0 Sam", home side first. */
export function shootoutScoreLine(c: PlayersShootout): string {
  const s = shootoutSides(c);
  return `${s.home.name} ${s.homeScore}–${s.awayScore} ${s.away.name}`;
}

/** WhatsApp / share-sheet text, for people who won't see a push. */
export function shootoutShareMessage(c: PlayersShootout): string {
  const link = buildShootoutLink(c.id);
  if (c.status === 'pending' && c.iAmChallenger) {
    return `I've challenged you to a Shootout on The Players. Best of three, 10 seconds a card. Accept here: ${link}`;
  }
  if (c.status === 'finished' && c.result === 'won') {
    return `I beat ${c.them.name} ${c.score.me}–${c.score.them} in a Shootout on The Players. ${link}`;
  }
  if (c.status === 'finished') {
    return `${c.them.name} beat me in a Shootout on The Players. Rematch incoming. ${link}`;
  }
  return `Your turn in our Shootout on The Players: ${link}`;
}

/** "23h left", "45m left", "Less than a minute left". */
export function shootoutTimeLeft(deadline: string | null, now: number): string | null {
  if (!deadline) return null;
  const ms = Date.parse(deadline) - now;
  if (!Number.isFinite(ms)) return null;
  if (ms <= 60_000) return 'Less than a minute left';
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h left`;
  return `${Math.ceil(ms / 60_000)}m left`;
}

export function currentShootoutGame(c: PlayersShootout): PlayersShootoutGame | null {
  return c.games[c.games.length - 1] ?? null;
}

/** The card of this game you're on: the one being played, or the next one to be dealt. */
export function shootoutCardNumber(game: PlayersShootoutGame | null): number {
  if (!game) return 1;
  const last = game.rounds[game.rounds.length - 1];
  return !last || (last.me.played && last.them.played) ? game.rounds.length + 1 : game.rounds.length;
}

export function shootoutGameLabel(game: PlayersShootoutGame | null): string {
  if (!game) return 'Best of three';
  return game.suddenDeath ? 'Sudden death' : `Round ${game.number} of 3`;
}

/** One line for a list row or the match header. */
export function shootoutStatusLine(c: PlayersShootout, now: number): string {
  const left = shootoutTimeLeft(c.turnDeadline, now);
  const withLeft = (s: string) => (left ? `${s} · ${left}` : s);
  switch (c.status) {
    case 'pending':
      return c.iAmChallenger ? withLeft(`Waiting for ${c.them.name} to accept`) : withLeft(`${c.them.name} challenged you`);
    case 'active': {
      if (c.nextAction === 'play') return withLeft(shootoutGameLabel(currentShootoutGame(c)));
      return withLeft(`Waiting for ${c.them.name}`);
    }
    case 'finished':
      if (c.endReason === 'left') {
        return c.result === 'won' ? `You won · ${c.them.name} left` : 'You lost · you left';
      }
      if (c.endReason === 'forfeit') {
        return c.result === 'won' ? `You won · ${c.them.name} ran out of time` : `You lost · you ran out of time`;
      }
      // Level after three rounds: the score alone (say 1–1) doesn't show who won.
      if (c.games.some((g) => g.suddenDeath)) {
        return c.result === 'won' ? 'You won in sudden death' : 'You lost in sudden death';
      }
      return c.result === 'won' ? `You won ${c.score.me}–${c.score.them}` : `You lost ${c.score.me}–${c.score.them}`;
    case 'declined':
      return c.iAmChallenger ? `${c.them.name} said no` : 'You said no';
    case 'expired':
      return 'Nobody accepted in time';
    case 'cancelled':
      return 'Cancelled';
    default:
      return '';
  }
}

/** The daily game's card faces want a full PlayersCard; fill the gaps a hidden answer leaves. */
export function shootoutCardAsPlayersCard(card: PlayersShootoutCard, index = 0): PlayersCard {
  const correct = card.correct ?? card.options[0] ?? { clubCode: '', clubName: '' };
  return {
    id: card.id,
    index,
    playerName: card.playerName,
    playerKey: card.id,
    correct,
    appearances: card.appearances ?? 0,
    questionSeason: card.questionSeason,
    yearsAtClub: card.yearsAtClub,
    difficulty: card.difficulty,
    options: card.options,
  };
}

/** Challenges sorted for the Shootout home: your move first, then waiting, then finished. */
export function groupShootouts(list: PlayersShootout[]): {
  yourMove: PlayersShootout[];
  waiting: PlayersShootout[];
  finished: PlayersShootout[];
} {
  const yourMove: PlayersShootout[] = [];
  const waiting: PlayersShootout[] = [];
  const finished: PlayersShootout[] = [];
  for (const c of list) {
    if (c.nextAction === 'play' || c.nextAction === 'respond') yourMove.push(c);
    else if (c.nextAction === 'waiting') waiting.push(c);
    else finished.push(c);
  }
  return { yourMove, waiting, finished };
}

/** How many Shootouts are waiting on you (for the badge on The Players). */
export function shootoutsNeedingYou(list: PlayersShootout[] | undefined): number {
  return (list ?? []).filter((c) => c.nextAction === 'play' || c.nextAction === 'respond').length;
}

/** A club's name from one of the card's options, by code. */
export function shootoutClubName(card: PlayersShootoutCard | null, code: string | null): string | null {
  if (!card || !code) return null;
  return card.options.find((o) => o.clubCode === code)?.clubName ?? code;
}

export type ShootoutMomentKind =
  | { kind: 'game'; game: PlayersShootoutGame; keys: string[] }
  | { kind: 'final'; game: PlayersShootoutGame | null; keys: string[] };

/**
 * The result moment to show next, if any: the Shootout result once it's over,
 * otherwise the earliest finished game not yet shown.
 */
export function nextShootoutMoment(c: PlayersShootout, seen: Set<string>): ShootoutMomentKind | null {
  const finished = c.games.filter((g) => g.result != null);
  if (c.status === 'finished') {
    if (seen.has('final')) return null;
    return {
      kind: 'final',
      game: finished[finished.length - 1] ?? null,
      keys: ['final', ...finished.map((g) => `g${g.number}`)],
    };
  }
  if (c.status !== 'active') return null;
  const game = finished.find((g) => !seen.has(`g${g.number}`));
  return game ? { kind: 'game', game, keys: [`g${game.number}`] } : null;
}

/**
 * What the navy card between cards says, for whoever is looking at it. The same
 * Shootout reads differently to the challenger and the challenged player.
 * Actions are named here and wired up by the screen.
 */
export type ShootoutCardSpec = {
  /** The big top line: "Best of three", or the score once cards have been played ("Jof 1–0 Sam"). */
  headerLine: string;
  /** The small Tourney line under it. */
  headerLabel: string;
  /** Big text on the card: gold on a versus card, white on a turn card. */
  title: string;
  /**
   * versus: the two players with "v" (invites, Challenge accepted, ended).
   * turn: whose turn it is, as the daily game's intro card.
   */
  body: 'versus' | 'turn';
  /** Under the players on a versus card. */
  subtitle: string | null;
  /** Under the title on a turn card. */
  lines: string[];
  /** The big button under the card. */
  primary: { label: string; action: 'play' | 'accept' | 'challenge' } | null;
  /** A line under the card when there's no button. */
  note: string | null;
  /** The text link under the button or note. */
  link: { label: string; action: 'whatsapp' | 'decline' | 'home' } | null;
};

const RULES_LINE = 'Best of three. Same card each,\n10 seconds to answer.';

export function shootoutCardSpec(c: PlayersShootout, now: number): ShootoutCardSpec {
  const them = c.them.name;
  const left = shootoutTimeLeft(c.turnDeadline, now);
  const game = currentShootoutGame(c);
  const myTurn = c.nextAction === 'play';
  const nudge = { label: 'Nudge on WhatsApp', action: 'whatsapp' as const };
  const versus = { headerLine: 'Best of three', body: 'versus' as const, lines: [] };

  if (c.status === 'pending' && c.iAmChallenger) {
    return {
      ...versus,
      headerLabel: `Waiting for ${them}`,
      title: 'Challenge sent',
      subtitle: `Waiting for ${them} to accept.${left ? `\n${left}.` : ''}`,
      primary: null,
      note: null,
      link: { label: 'Share via WhatsApp', action: 'whatsapp' },
    };
  }
  if (c.status === 'pending') {
    return {
      ...versus,
      headerLabel: left ? `${left} to accept` : 'New challenge',
      title: "You've been challenged",
      subtitle: `${them} goes first. Same card each,\n10 seconds to answer.`,
      primary: { label: 'Accept', action: 'accept' },
      note: null,
      link: { label: 'No thanks', action: 'decline' },
    };
  }
  if (c.status === 'declined' || c.status === 'expired' || c.status === 'cancelled') {
    const subtitle =
      c.status === 'declined'
        ? c.iAmChallenger
          ? `${them} said no this time.`
          : 'You said no to this one.'
        : c.status === 'expired'
          ? c.iAmChallenger
            ? `${them} didn't accept in time.`
            : "You didn't accept in time."
          : c.iAmChallenger
            ? 'You cancelled this challenge.'
            : `${them} cancelled this challenge.`;
    return {
      ...versus,
      headerLabel: 'Shootout',
      title: c.status === 'declined' ? 'Declined' : c.status === 'expired' ? 'Expired' : 'Cancelled',
      subtitle,
      primary: { label: `Challenge ${them}`, action: 'challenge' },
      note: null,
      link: { label: 'Back to Shootouts', action: 'home' },
    };
  }

  // In play.
  const atStart = c.games.length === 1 && (game?.rounds.length ?? 0) === 0;
  if (atStart) {
    return {
      ...versus,
      headerLabel: shootoutGameLabel(game),
      title: 'Challenge accepted',
      subtitle: RULES_LINE,
      primary: myTurn ? { label: 'Play', action: 'play' } : null,
      note: myTurn ? null : `${them} goes first.`,
      link: myTurn ? null : nudge,
    };
  }

  // Whose turn, as the daily game's intro card. The score sits in the header, as when playing.
  const turn = {
    headerLine: shootoutScoreLine(c),
    title: myTurn ? 'Your turn' : `${them}'s turn`,
    body: 'turn' as const,
    subtitle: null,
    note: null,
    link: myTurn ? null : nudge,
  };
  const howLong = myTurn ? 'Over to you…' : "We'll tell you when it's your go.";

  // A new round with no cards played yet.
  if (game && game.rounds.length === 0) {
    const played = c.games.length - 1;
    const next = game.suddenDeath ? 'sudden death' : `Round ${game.number}`;
    return {
      ...turn,
      headerLabel: `After ${played} round${played === 1 ? '' : 's'}`,
      lines: [myTurn ? `You start ${next}.` : `${them} starts ${next}.`, howLong],
      primary: myTurn ? { label: `Play ${next}`, action: 'play' } : null,
    };
  }

  // Mid-round. Second on a card (always the challenged player in round 1): say they've taken it.
  const n = shootoutCardNumber(game);
  const round = game?.rounds[game.rounds.length - 1];
  const theyWentFirst = !!round && round.them.played && !round.me.played;
  const iWentFirst = !!round && round.me.played && !round.them.played;
  const first = myTurn
    ? theyWentFirst
      ? `${them} has played card ${n}.`
      : `You go first on card ${n}.`
    : iWentFirst
      ? `You've played card ${n}.`
      : `${them} goes first on card ${n}.`;
  return {
    ...turn,
    headerLabel: `${shootoutGameLabel(game)} · Card ${n}`,
    lines: [first, howLong],
    primary: myTurn ? { label: 'Play', action: 'play' } : null,
  };
}

export type ShootoutHeadToHead = {
  /** Shootouts won against this player, all time. */
  me: number;
  them: number;
  played: number;
  /** Results from your side, newest first, up to five. */
  form: Array<'W' | 'L'>;
};

/**
 * Your running Shootout record against one player: whole Shootouts won, not rounds.
 * `current` is counted even if the list hasn't caught up with it yet.
 */
export function shootoutHeadToHead(list: PlayersShootout[], current: PlayersShootout): ShootoutHeadToHead {
  const byId = new Map<string, PlayersShootout>();
  for (const c of list) byId.set(c.id, c);
  byId.set(current.id, current);
  const results = Array.from(byId.values())
    .filter((c) => c.them.id === current.them.id && c.status === 'finished' && c.result)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const me = results.filter((c) => c.result === 'won').length;
  return {
    me,
    them: results.length - me,
    played: results.length,
    form: results.slice(0, 5).map((c) => (c.result === 'won' ? 'W' : 'L')),
  };
}
