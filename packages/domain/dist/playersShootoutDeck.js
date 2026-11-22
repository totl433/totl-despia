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
const CARD_MIN_WIKI_VIEWS = [2_000_000, 1_000_000, 1_000_000, 500_000, 500_000, 250_000, 250_000, 0, 0, 0];
const CARD_APPEARANCE_BANDS = [
    { min: 200, max: Infinity },
    { min: 150, max: 199 },
    { min: 100, max: 149 },
    { min: 80, max: 99 },
    { min: 60, max: 79 },
    { min: 40, max: 59 },
    { min: 30, max: 39 },
    { min: 20, max: 29 },
    { min: 10, max: 19 },
    { min: 1, max: 9 },
];
export const SHOOTOUT_BAND_COUNT = CARD_APPEARANCE_BANDS.length;
export function mulberry32(a) {
    return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function shuffle(arr, rng) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function difficultyForApps(apps) {
    if (apps >= 100)
        return 'easy';
    if (apps >= 40)
        return 'medium';
    if (apps >= 15)
        return 'hard';
    return 'expert';
}
function parseSeasonStartYear(season) {
    const m = String(season || '')
        .trim()
        .match(/^(\d{2,4})\s*\/\s*(\d{2})$/);
    if (!m)
        return null;
    let y = Number(m[1]);
    if (Number.isNaN(y))
        return null;
    if (y < 100)
        y += y >= 50 ? 1900 : 2000;
    return y;
}
function parseSeasonEndYear(season) {
    const start = parseSeasonStartYear(season);
    if (start == null)
        return null;
    const m = String(season)
        .trim()
        .match(/^(\d{2,4})\s*\/\s*(\d{2})$/);
    if (!m)
        return null;
    let end = Math.floor(start / 100) * 100 + Number(m[2]);
    if (end < start)
        end += 100;
    return end;
}
function formatQuestionSeason(season) {
    const start = parseSeasonStartYear(season);
    const end = parseSeasonEndYear(season);
    if (start == null || end == null)
        return null;
    return `${String(start % 100).padStart(2, '0')}/${String(end % 100).padStart(2, '0')}`;
}
function formatSpellYears(first, last) {
    const a = (first || last || '').trim();
    const b = (last || first || '').trim();
    if (!a)
        return null;
    const start = parseSeasonStartYear(a);
    const end = parseSeasonEndYear(b);
    if (start == null || end == null)
        return null;
    if (start === end)
        return String(start);
    return `${start} - ${end}`;
}
function formatYearsAtClub(spells) {
    const parts = spells.map((s) => formatSpellYears(s.firstSeason, s.lastSeason)).filter((x) => Boolean(x));
    if (!parts.length)
        return null;
    if (parts.length === 1)
        return parts[0];
    return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
function seasonsBetween(first, last) {
    const a = (first || last || '').trim();
    const b = (last || first || '').trim();
    if (!a)
        return [];
    const start = parseSeasonStartYear(a);
    const endStart = parseSeasonStartYear(b);
    if (start == null || endStart == null)
        return [a];
    const out = [];
    for (let y = start; y <= endStart; y++)
        out.push(`${y}/${String((y + 1) % 100).padStart(2, '0')}`);
    return out.length ? out : [a];
}
function otherClubsForPlayer(rows, playerKey, correctCode) {
    const seen = new Set();
    const out = [];
    for (const r of rows) {
        if (r.playerKey !== playerKey || r.clubCode === correctCode || seen.has(r.clubCode))
            continue;
        seen.add(r.clubCode);
        out.push({ clubCode: r.clubCode, clubName: r.clubName });
    }
    return out;
}
function pickDistractors(allClubs, careerClubs, banned, rng, preferCareerClub) {
    const picked = [];
    const used = new Set();
    if (preferCareerClub && careerClubs.length > 0) {
        const fromCareer = shuffle(careerClubs, rng)[0];
        picked.push(fromCareer);
        used.add(fromCareer.clubCode);
    }
    for (const c of shuffle(allClubs.filter((c) => !banned.has(c.clubCode) && !used.has(c.clubCode)), rng)) {
        if (picked.length >= 2)
            break;
        picked.push(c);
        used.add(c.clubCode);
    }
    if (picked.length < 2) {
        for (const c of shuffle(careerClubs.filter((c) => !used.has(c.clubCode)), rng)) {
            if (picked.length >= 2)
                break;
            picked.push(c);
            used.add(c.clubCode);
        }
    }
    return picked.slice(0, 2);
}
/**
 * One card for a Shootout game.
 * `band` is 0–9 (the daily deck's card number). Players in `usedPlayerKeys` are
 * skipped; if a band runs dry, the floor drops, then used players come back, so
 * a long game never stalls.
 */
export function dealShootoutCard(rows, input) {
    const rng = mulberry32(input.seed >>> 0);
    const bandIndex = ((input.band % SHOOTOUT_BAND_COUNT) + SHOOTOUT_BAND_COUNT) % SHOOTOUT_BAND_COUNT;
    const band = CARD_APPEARANCE_BANDS[bandIndex];
    const harderHalf = bandIndex >= 5;
    const wholePot = bandIndex === SHOOTOUT_BAND_COUNT - 1;
    const minViews = CARD_MIN_WIKI_VIEWS[bandIndex] ?? 0;
    const used = new Set(input.usedPlayerKeys);
    const inBandWith = (skipUsed, floor) => rows.filter((r) => (!skipUsed || !used.has(r.playerKey)) &&
        r.appearances >= band.min &&
        r.appearances <= band.max &&
        r.wikiViews >= floor);
    let inBand = inBandWith(true, minViews);
    if (!inBand.length)
        inBand = inBandWith(true, 0);
    if (!inBand.length)
        inBand = inBandWith(false, 0);
    if (!inBand.length)
        inBand = rows.filter((r) => !used.has(r.playerKey));
    if (!inBand.length)
        inBand = rows;
    const multiClub = inBand.filter((r) => otherClubsForPlayer(rows, r.playerKey, r.clubCode).length > 0);
    const pick = shuffle(harderHalf && !wholePot && multiClub.length ? multiClub : inBand, rng)[0];
    if (!pick)
        throw new Error('The Players catalogue is empty');
    const clubMap = new Map();
    for (const r of rows)
        if (!clubMap.has(r.clubCode))
            clubMap.set(r.clubCode, { clubCode: r.clubCode, clubName: r.clubName });
    const correct = { clubCode: pick.clubCode, clubName: pick.clubName };
    const banned = new Set(rows.filter((r) => r.playerKey === pick.playerKey).map((r) => r.clubCode));
    const careerOthers = otherClubsForPlayer(rows, pick.playerKey, pick.clubCode);
    const distractors = pickDistractors(Array.from(clubMap.values()), careerOthers, banned, rng, harderHalf);
    const options = shuffle([correct, ...distractors], rng);
    const spells = pick.spells.length
        ? pick.spells
        : [{ firstSeason: pick.firstSeason, lastSeason: pick.lastSeason, appearances: pick.appearances }];
    const seasonPool = spells.flatMap((s) => seasonsBetween(s.firstSeason, s.lastSeason));
    const rawQuestion = seasonPool[Math.floor(rng() * Math.max(1, seasonPool.length))] ?? pick.firstSeason ?? pick.lastSeason;
    return {
        id: `${pick.playerKey}-${pick.clubCode}-${input.cardNumber}`,
        playerKey: pick.playerKey,
        playerName: pick.playerName,
        questionSeason: rawQuestion ? formatQuestionSeason(rawQuestion) : null,
        yearsAtClub: formatYearsAtClub(spells),
        appearances: pick.appearances,
        difficulty: difficultyForApps(pick.appearances),
        correct,
        options,
    };
}
