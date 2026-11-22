import {
  SHOOTOUT_TURN_MS,
  ShootoutError,
  answerShootoutCard,
  cancelShootout,
  leaveShootout,
  dealShootoutCard,
  newShootoutChallenge,
  openKick,
  otherPlayer,
  respondToShootout,
  revealShootoutCard,
  settleShootout,
  shootoutViewFor,
  type ShootoutCatalogRow,
  type ShootoutChallenge,
  type ShootoutPerson,
} from '@totl/domain';
import { ApiError, type PlayersShootout } from '@totl/api-client';

import { loadPlayerClubApps } from './loadPlayerClubApps';
import { markShootoutSeen } from './shootoutSeen';

/**
 * Admin-only Shootout sandbox: the real rules (from @totl/domain, the same code
 * the BFF runs) against an in-memory challenge and a bot opponent.
 * Nothing is saved and nobody is notified. It resets when the app reloads.
 *
 * It has the same methods as the BFF client, so the Shootout screens run on it unchanged.
 */

export const SANDBOX_BOT_ID = '00000000-0000-4000-8000-00000000b07';
const BOT: ShootoutPerson = { id: SANDBOX_BOT_ID, name: 'Test Bot', avatarUrl: null };

/** Pretend opponents for the sample Shootouts. They play their turns like Test Bot, but never accept invites. */
const FAKES: ShootoutPerson[] = [
  { id: '00000000-0000-4000-8000-0000000000c1', name: 'Carl', avatarUrl: null },
  { id: '00000000-0000-4000-8000-0000000000c2', name: 'Sam', avatarUrl: null },
  { id: '00000000-0000-4000-8000-0000000000c3', name: 'Priya', avatarUrl: null },
  { id: '00000000-0000-4000-8000-0000000000c4', name: 'Mo', avatarUrl: null },
  { id: '00000000-0000-4000-8000-0000000000c5', name: 'Dan', avatarUrl: null },
  { id: '00000000-0000-4000-8000-0000000000c6', name: 'Alex', avatarUrl: null },
];
const [CARL, SAM, PRIYA, MO, DAN, ALEX] = FAKES as [
  ShootoutPerson,
  ShootoutPerson,
  ShootoutPerson,
  ShootoutPerson,
  ShootoutPerson,
  ShootoutPerson,
];
/** Opponents who take their time, whatever the sandbox's speed setting: a realistic wait between turns. */
const SLOW_OPPONENT_MS: Record<string, number> = { [ALEX.id]: 30_000 };
let seeded = false;

export type SandboxBotSkill = 'right' | 'coin' | 'wrong';

export type SandboxLogLine = { at: number; text: string };

type Listener = () => void;

const challenges = new Map<string, ShootoutChallenge>();
const log: SandboxLogLine[] = [];
const listeners = new Set<Listener>();
let me: ShootoutPerson = { id: '00000000-0000-4000-8000-0000000000e1', name: 'You', avatarUrl: null };
let botSkill: SandboxBotSkill = 'coin';
let botDelayMs = 1500;
let showAnswers = false;
let rowsPromise: Promise<ShootoutCatalogRow[]> | null = null;
const botTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const l of listeners) l();
}

function note(text: string) {
  log.unshift({ at: Date.now(), text });
  if (log.length > 60) log.length = 60;
}

function rows(): Promise<ShootoutCatalogRow[]> {
  if (!rowsPromise) {
    rowsPromise = loadPlayerClubApps()
      .then((apps) =>
        apps.map((r) => ({
          playerName: r.playerName,
          playerKey: r.playerKey,
          clubCode: r.clubCode,
          clubName: r.clubName,
          appearances: r.appearances,
          wikiViews: r.wikiViews ?? 0,
          firstSeason: r.firstSeason,
          lastSeason: r.lastSeason,
          spells: r.spells,
        }))
      )
      .catch((error) => {
        rowsPromise = null;
        throw error;
      });
  }
  return rowsPromise;
}

function people(): Map<string, ShootoutPerson> {
  return new Map([
    [me.id, me],
    [BOT.id, BOT],
    ...FAKES.map((f) => [f.id, f] as [string, ShootoutPerson]),
  ]);
}

function view(c: ShootoutChallenge): PlayersShootout {
  return shootoutViewFor(c, me.id, people(), Date.now()) as PlayersShootout;
}

function find(id: string): ShootoutChallenge {
  const c = challenges.get(id);
  if (!c) throw new ShootoutError('Challenge not found.', 404);
  return c;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31) + 1;
}

function newId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, hex);
}

/** The opponent in a challenge. */
function them(c: ShootoutChallenge): ShootoutPerson {
  return people().get(otherPlayer(c, me.id)) ?? BOT;
}

function describeKick(who: string, correct: boolean | null, timedOut: boolean, cardName: string): string {
  return `${who} ${timedOut ? 'ran out of time on' : correct ? 'got' : 'missed'} ${cardName}`;
}

function describeState(c: ShootoutChallenge) {
  if (c.status === 'finished') {
    const winner = c.winnerId === me.id ? 'You' : them(c).name;
    note(`${winner} won the Shootout${c.state.endReason === 'forfeit' ? ' (the other side ran out of time)' : ''}.`);
    return;
  }
  const game = c.state.games[c.state.games.length - 1];
  const prev = c.state.games[c.state.games.length - 2];
  if (game && game.rounds.length === 0 && prev?.finished) {
    const res = prev.winnerId == null ? 'drawn' : prev.winnerId === me.id ? 'won by you' : `won by ${them(c).name}`;
    note(`Round ${prev.number} ${res}. ${game.suddenDeath ? 'Sudden death!' : `Round ${game.number} next.`}`);
  }
}

/** The Shootout with this opponent that's still waiting or in play, if any. */
function openWithBot(opponentId: string = BOT.id): ShootoutChallenge | null {
  for (const c of challenges.values()) {
    settleShootout(c, Date.now());
    if (otherPlayer(c, me.id) !== opponentId) continue;
    if (c.status === 'pending' || c.status === 'active') return c;
  }
  return null;
}

/** If it's the bot's move, it takes it after a short pause. */
function scheduleBot(id: string) {
  const existing = botTimers.get(id);
  if (existing) clearTimeout(existing);
  const c = challenges.get(id);
  if (!c) return;
  // Test Bot accepts invites; any opponent plays their turns.
  const botsMove =
    (c.status === 'pending' && c.opponentId === BOT.id) ||
    (c.status === 'active' && !!c.turnUserId && c.turnUserId !== me.id);
  if (!botsMove) return;
  botTimers.set(
    id,
    setTimeout(() => {
      botTimers.delete(id);
      void botMove(id).catch((error) => note(`Bot error: ${error instanceof Error ? error.message : String(error)}`));
    }, SLOW_OPPONENT_MS[otherPlayer(c, me.id)] ?? botDelayMs)
  );
}

async function botMove(id: string) {
  const c = challenges.get(id);
  if (!c) return;
  if (c.status === 'pending' && c.opponentId === BOT.id) {
    respondToShootout(c, BOT.id, true, Date.now(), randomSeed());
    note(`${BOT.name} accepted.`);
  } else if (c.status === 'active' && c.turnUserId && c.turnUserId !== me.id) {
    const botId = c.turnUserId;
    const catalog = await rows();
    const kick = revealShootoutCard(c, botId, Date.now(), (input) => dealShootoutCard(catalog, input));
    const open = openKick(c, botId);
    if (!open) return;
    const card = open.round.card;
    const right = botSkill === 'right' || (botSkill === 'coin' && Math.random() < 0.5);
    const wrong = card.options.find((o) => o.clubCode !== card.correct.clubCode) ?? card.correct;
    const pick = right ? card.correct.clubCode : wrong.clubCode;
    const res = answerShootoutCard(c, botId, { cardId: card.id, pick }, Date.parse(kick.shownAt) + 2500);
    note(describeKick(them(c).name, res.correct, res.timedOut, card.playerName));
    describeState(c);
  }
  emit();
  scheduleBot(id);
}

// ── Sample Shootouts ───────────────────────────────────────────────────────

const HOUR = 3_600_000;

/**
 * Plays a script of answers through the real rules, starting `hoursAgo` hours ago.
 * Each entry is whether the player whose turn it is gets the card right.
 */
async function samplePlay(opts: {
  opponent: ShootoutPerson;
  iChallenge: boolean;
  hoursAgo: number;
  accept?: boolean;
  kicks?: boolean[];
  /** Let the clock run out on whoever's turn it is at the end. */
  forfeit?: boolean;
}): Promise<void> {
  const catalog = await rows();
  let t = Date.now() - opts.hoursAgo * HOUR;
  const c = newShootoutChallenge({
    id: newId(),
    challengerId: opts.iChallenge ? me.id : opts.opponent.id,
    opponentId: opts.iChallenge ? opts.opponent.id : me.id,
    now: t,
  });
  if (opts.accept !== false) {
    t += 20 * 60_000;
    respondToShootout(c, c.opponentId, true, t, randomSeed());
    for (const right of opts.kicks ?? []) {
      const who = c.turnUserId;
      if (!who || c.status !== 'active') break;
      t += 12 * 60_000;
      revealShootoutCard(c, who, t, (input) => dealShootoutCard(catalog, input));
      const card = openKick(c, who)?.round.card;
      if (!card) break;
      const wrong = card.options.find((o) => o.clubCode !== card.correct.clubCode) ?? card.correct;
      answerShootoutCard(c, who, { cardId: card.id, pick: right ? card.correct.clubCode : wrong.clubCode }, t + 4000);
    }
    if (opts.forfeit) settleShootout(c, t + SHOOTOUT_TURN_MS + 60_000);
  }
  challenges.set(c.id, c);
  // Results that already happened: no result moments for them when you open these.
  // Only for what's finished, so a sample still in play still gets its full-time card.
  const done = c.state.games.filter((g) => g.finished).map((g) => `g${g.number}`);
  markShootoutSeen(c.id, true, c.status === 'finished' ? ['final', ...done] : done);
}

/** In play and finished Shootouts against the sample players, to see the home and list. */
async function seedSampleShootouts(): Promise<void> {
  // In play
  await samplePlay({ opponent: CARL, iChallenge: true, hoursAgo: 3, kicks: [true, false] }); // 1–0 up, Carl's turn
  await samplePlay({ opponent: PRIYA, iChallenge: true, hoursAgo: 5, kicks: [true, false, true, false] }); // 1–1, round 3 to you
  await samplePlay({ opponent: SAM, iChallenge: false, hoursAgo: 1, accept: false }); // Sam's invite to you
  await samplePlay({ opponent: MO, iChallenge: true, hoursAgo: 2, accept: false }); // your invite to Mo
  await samplePlay({ opponent: DAN, iChallenge: false, hoursAgo: 4, kicks: [true] }); // Dan got card 1, your go
  await samplePlay({ opponent: ALEX, iChallenge: false, hoursAgo: 0.5, accept: false }); // Alex's invite to you; Alex takes 30s a turn
  // Finished
  await samplePlay({ opponent: CARL, iChallenge: true, hoursAgo: 26, kicks: [true, false, true, false, false, true] }); // Carl 2–1
  await samplePlay({ opponent: SAM, iChallenge: true, hoursAgo: 50, kicks: [true, false, false, true] }); // you 2–0
  await samplePlay({
    opponent: PRIYA,
    iChallenge: true,
    hoursAgo: 74,
    kicks: [false, false, false, false, false, false, true, true, false, true],
  }); // you, in sudden death
  await samplePlay({ opponent: MO, iChallenge: true, hoursAgo: 120, kicks: [true, false, true], forfeit: true }); // you ran out of time
  await samplePlay({ opponent: DAN, iChallenge: false, hoursAgo: 150, kicks: [true, false, false, true] }); // Dan 2–0
  note('Added sample Shootouts with Carl, Sam, Priya, Mo, Dan and Alex (Alex takes 30 seconds a turn).');
}

/** The BFF client's Shootout methods, played out in memory. */
export const shootoutSandboxClient = {
  async listPlayersShootouts(): Promise<{ challenges: PlayersShootout[] }> {
    // First visit: fill the sandbox with sample Shootouts to look at.
    if (!seeded) {
      seeded = true;
      await seedSampleShootouts().catch((error) => note(`Couldn't add samples: ${error instanceof Error ? error.message : String(error)}`));
    }
    const list = Array.from(challenges.values());
    for (const c of list) settleShootout(c, Date.now());
    list.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return { challenges: list.map(view) };
  },

  async getPlayersShootout(id: string): Promise<{ challenge: PlayersShootout }> {
    const c = find(id);
    if (settleShootout(c, Date.now())) describeState(c);
    scheduleBot(id);
    return { challenge: view(c) };
  },

  async createPlayersShootout(opponentId: string): Promise<{ challenge: PlayersShootout }> {
    if (!people().has(opponentId) || opponentId === me.id) {
      throw new ShootoutError('In the sandbox you can only challenge Test Bot or the sample players.', 400);
    }
    // Same rule as the BFF: one open Shootout per opponent. The pick screen opens the existing one.
    const existing = openWithBot(opponentId);
    if (existing) {
      throw new ApiError('You already have a Shootout going with this player.', {
        status: 409,
        body: { message: 'You already have a Shootout going with this player.', challengeId: existing.id },
      });
    }
    const c = newShootoutChallenge({ id: newId(), challengerId: me.id, opponentId, now: Date.now() });
    challenges.set(c.id, c);
    note(`You challenged ${them(c).name}.`);
    emit();
    scheduleBot(c.id);
    return { challenge: view(c) };
  },

  async respondToPlayersShootout(id: string, accept: boolean): Promise<{ challenge: PlayersShootout }> {
    const c = find(id);
    respondToShootout(c, me.id, accept, Date.now(), randomSeed());
    note(accept ? 'You accepted.' : 'You said no.');
    emit();
    scheduleBot(id);
    return { challenge: view(c) };
  },

  async cancelPlayersShootout(id: string): Promise<{ challenge: PlayersShootout }> {
    const c = find(id);
    cancelShootout(c, me.id, Date.now());
    note('You cancelled the challenge.');
    emit();
    return { challenge: view(c) };
  },

  async leavePlayersShootout(id: string): Promise<{ challenge: PlayersShootout }> {
    const c = find(id);
    const wasActive = c.status === 'active';
    leaveShootout(c, me.id, Date.now());
    note(wasActive ? `You left. ${them(c).name} wins the Shootout.` : 'You left before it started.');
    emit();
    return { challenge: view(c) };
  },

  async revealPlayersShootoutCard(id: string): Promise<{ challenge: PlayersShootout }> {
    const c = find(id);
    const catalog = await rows();
    revealShootoutCard(c, me.id, Date.now(), (input) => dealShootoutCard(catalog, input));
    emit();
    return { challenge: view(c) };
  },

  async answerPlayersShootoutCard(
    id: string,
    input: { cardId: string; pick: string | null }
  ): Promise<{ correct: boolean; timedOut: boolean; challenge: PlayersShootout }> {
    const c = find(id);
    const open = openKick(c, me.id);
    const res = answerShootoutCard(c, me.id, input, Date.now());
    note(describeKick('You', res.correct, res.timedOut, open?.round.card.playerName ?? 'the card'));
    describeState(c);
    emit();
    scheduleBot(id);
    return { ...res, challenge: view(c) };
  },
};

export type ShootoutClient = typeof shootoutSandboxClient;

// ── Admin controls ─────────────────────────────────────────────────────────

export const shootoutSandbox = {
  bot: BOT,
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setMe(person: ShootoutPerson) {
    const previous = me.id;
    me = person;
    if (previous === person.id) return;
    // Games made before your id loaded (the samples) move over to you.
    const swap = (id: string | null) => (id === previous ? person.id : id);
    for (const c of challenges.values()) {
      c.challengerId = swap(c.challengerId)!;
      c.opponentId = swap(c.opponentId)!;
      c.turnUserId = swap(c.turnUserId);
      c.winnerId = swap(c.winnerId);
      for (const g of c.state.games) {
        g.firstUserId = swap(g.firstUserId)!;
        g.winnerId = swap(g.winnerId);
        for (const r of g.rounds) for (const k of r.kicks) k.userId = swap(k.userId)!;
      }
    }
    emit();
  },
  getSettings() {
    return { botSkill, botDelayMs, showAnswers };
  },
  setBotSkill(skill: SandboxBotSkill) {
    botSkill = skill;
    emit();
  },
  setBotDelay(ms: number) {
    botDelayMs = ms;
    emit();
  },
  setShowAnswers(on: boolean) {
    showAnswers = on;
    emit();
  },
  /** The right club for your open card, when "Show answers" is on. */
  answerFor(id: string): string | null {
    if (!showAnswers) return null;
    const c = challenges.get(id);
    const open = c ? openKick(c, me.id) : null;
    return open?.round.card.correct.clubName ?? null;
  },
  log(): SandboxLogLine[] {
    return log;
  },
  /** Test Bot challenges you, so you can see the invite side. */
  botChallengesYou(): string {
    const existing = openWithBot();
    if (existing) {
      note('You already have a Shootout going with Test Bot. Finish or reset it first.');
      emit();
      return existing.id;
    }
    const c = newShootoutChallenge({ id: newId(), challengerId: BOT.id, opponentId: me.id, now: Date.now() });
    challenges.set(c.id, c);
    note(`${BOT.name} challenged you.`);
    emit();
    return c.id;
  },
  /** Moves every open challenge's clock on, to see expiries and forfeits. */
  skipTime(ms: number = SHOOTOUT_TURN_MS + 60_000) {
    for (const c of challenges.values()) {
      if (c.turnDeadline) c.turnDeadline = new Date(Date.parse(c.turnDeadline) - ms).toISOString();
      const open = openKick(c);
      if (open) open.kick.shownAt = new Date(Date.parse(open.kick.shownAt) - ms).toISOString();
      if (settleShootout(c, Date.now())) {
        note(c.status === 'expired' ? 'An invite expired.' : 'Time ran out on a turn.');
        describeState(c);
      }
      scheduleBot(c.id);
    }
    emit();
  },
  /** Adds the sample in-play and finished Shootouts. */
  async addSamples() {
    seeded = true;
    await seedSampleShootouts();
    emit();
  },
  reset() {
    seeded = true;
    for (const t of botTimers.values()) clearTimeout(t);
    botTimers.clear();
    challenges.clear();
    log.length = 0;
    note('Sandbox reset.');
    emit();
  },
};
