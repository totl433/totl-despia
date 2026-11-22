/**
 * The Players Shootout, as the BFF shows it to one player.
 * Mirrors apps/bff/src/playersShootout.ts (ShootoutView).
 */

export type PlayersShootoutClub = { clubCode: string; clubName: string };

export type PlayersShootoutStatus = 'pending' | 'active' | 'finished' | 'declined' | 'expired' | 'cancelled';

export type PlayersShootoutCard = {
  id: string;
  playerName: string;
  questionSeason: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  options: PlayersShootoutClub[];
  /** Only once you've played this card. */
  correct: PlayersShootoutClub | null;
  yearsAtClub: string | null;
  appearances: number | null;
};

export type PlayersShootoutKick = { played: boolean; correct: boolean | null; timedOut: boolean; pick: string | null };

export type PlayersShootoutRound = {
  number: number;
  /** Null until you've played it. */
  card: PlayersShootoutCard | null;
  me: PlayersShootoutKick;
  them: PlayersShootoutKick;
};

export type PlayersShootoutGame = {
  number: number;
  suddenDeath: boolean;
  iGoFirst: boolean;
  result: 'me' | 'them' | 'draw' | null;
  rounds: PlayersShootoutRound[];
};

export type PlayersShootoutPerson = { id: string; name: string; avatarUrl: string | null };

export type PlayersShootout = {
  id: string;
  status: PlayersShootoutStatus;
  iAmChallenger: boolean;
  me: PlayersShootoutPerson;
  them: PlayersShootoutPerson;
  score: { me: number; them: number };
  nextAction: 'respond' | 'play' | 'waiting' | 'done';
  turnDeadline: string | null;
  result: 'won' | 'lost' | null;
  /** forfeit: someone ran out of time. left: someone quit. */
  endReason: 'played' | 'forfeit' | 'left' | null;
  openCard: { card: PlayersShootoutCard; shownAt: string; msLeft: number } | null;
  games: PlayersShootoutGame[];
  createdAt: string;
  updatedAt: string;
};
