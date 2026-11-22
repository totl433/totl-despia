/**
 * Cards for The Players Shootout, dealt on the server so nobody can see an
 * answer before they play it.
 *
 * Card N of a game follows the daily deck's card N: same appearance band, same
 * Wikipedia-view floor, same distractor rules. After card 10 it starts again at
 * card 1's band, skipping players already used in that game. Sudden death picks a
 * band at random for each card.
 *
 * Shared by the BFF (real Shootouts) and the app's admin sandbox.
 * Keep the tables and rules in step with apps/mobile/src/lib/retroPlayers/buildPuzzle.ts.
 */
export type ShootoutClub = {
    clubCode: string;
    clubName: string;
};
export type ShootoutCard = {
    id: string;
    playerKey: string;
    playerName: string;
    /** Single season clue on the front, e.g. "96/97". */
    questionSeason: string | null;
    /** Full spell(s) on the reveal, e.g. "2006 - 2014 and 2016 - 2020". */
    yearsAtClub: string | null;
    appearances: number;
    difficulty: 'easy' | 'medium' | 'hard' | 'expert';
    correct: ShootoutClub;
    options: ShootoutClub[];
};
type Spell = {
    firstSeason?: string;
    lastSeason?: string;
    appearances: number;
};
export type ShootoutCatalogRow = {
    playerName: string;
    playerKey: string;
    clubCode: string;
    clubName: string;
    appearances: number;
    wikiViews: number;
    firstSeason?: string;
    lastSeason?: string;
    spells: Spell[];
};
export declare const SHOOTOUT_BAND_COUNT: number;
export declare function mulberry32(a: number): () => number;
/**
 * One card for a Shootout game.
 * `band` is 0–9 (the daily deck's card number). Players in `usedPlayerKeys` are
 * skipped; if a band runs dry, the floor drops, then used players come back, so
 * a long game never stalls.
 */
export declare function dealShootoutCard(rows: ShootoutCatalogRow[], input: {
    seed: number;
    band: number;
    usedPlayerKeys: string[];
    cardNumber: number;
}): ShootoutCard;
export {};
//# sourceMappingURL=playersShootoutDeck.d.ts.map