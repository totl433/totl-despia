/** Static season packs for Metro (dynamic require is unsupported). */
import type { RetroSeasonPack } from '../buildPuzzle';
import { displayNameForCode } from '../teamNameMap';

import season9394 from './seasons/9394.json';
import season9495 from './seasons/9495.json';
import season9596 from './seasons/9596.json';
import season9697 from './seasons/9697.json';
import season9798 from './seasons/9798.json';
import season9899 from './seasons/9899.json';
import season9900 from './seasons/9900.json';
import season0001 from './seasons/0001.json';
import season0102 from './seasons/0102.json';
import season0203 from './seasons/0203.json';
import season0304 from './seasons/0304.json';
import season0405 from './seasons/0405.json';
import season0506 from './seasons/0506.json';
import season0607 from './seasons/0607.json';
import season0708 from './seasons/0708.json';
import season0809 from './seasons/0809.json';
import season0910 from './seasons/0910.json';
import season1011 from './seasons/1011.json';
import season1112 from './seasons/1112.json';
import season1213 from './seasons/1213.json';
import season1314 from './seasons/1314.json';
import season1415 from './seasons/1415.json';
import season1516 from './seasons/1516.json';
import season1617 from './seasons/1617.json';
import season1718 from './seasons/1718.json';
import season1819 from './seasons/1819.json';
import season1920 from './seasons/1920.json';
import season2021 from './seasons/2021.json';
import season2122 from './seasons/2122.json';
import season2223 from './seasons/2223.json';
import season2324 from './seasons/2324.json';
import season2425 from './seasons/2425.json';
import season2526 from './seasons/2526.json';

type RawSeason = {
  seasonKey: string;
  seasonLabel: string;
  fixtures: Array<{
    id: string;
    seasonLabel: string;
    seasonKey: string;
    matchDate: string;
    homeCode: string;
    awayCode: string;
    homeName: string;
    awayName: string;
    homeScore: number;
    awayScore: number;
    result: string;
    htHome: number | null;
    htAway: number | null;
    source: string;
  }>;
  table?: RetroSeasonPack['table'];
};

function toPack(raw: RawSeason): RetroSeasonPack {
  return {
    seasonKey: raw.seasonKey,
    seasonLabel: raw.seasonLabel,
    fixtures: raw.fixtures.map((f) => ({
      ...f,
      homeName: displayNameForCode(f.homeCode, f.homeName),
      awayName: displayNameForCode(f.awayCode, f.awayName),
      result: f.result as RetroSeasonPack['fixtures'][number]['result'],
    })),
    table: raw.table,
  };
}

export const RETRO_SEASON_PACKS: RetroSeasonPack[] = [
  toPack(season9394 as RawSeason),
  toPack(season9495 as RawSeason),
  toPack(season9596 as RawSeason),
  toPack(season9697 as RawSeason),
  toPack(season9798 as RawSeason),
  toPack(season9899 as RawSeason),
  toPack(season9900 as RawSeason),
  toPack(season0001 as RawSeason),
  toPack(season0102 as RawSeason),
  toPack(season0203 as RawSeason),
  toPack(season0304 as RawSeason),
  toPack(season0405 as RawSeason),
  toPack(season0506 as RawSeason),
  toPack(season0607 as RawSeason),
  toPack(season0708 as RawSeason),
  toPack(season0809 as RawSeason),
  toPack(season0910 as RawSeason),
  toPack(season1011 as RawSeason),
  toPack(season1112 as RawSeason),
  toPack(season1213 as RawSeason),
  toPack(season1314 as RawSeason),
  toPack(season1415 as RawSeason),
  toPack(season1516 as RawSeason),
  toPack(season1617 as RawSeason),
  toPack(season1718 as RawSeason),
  toPack(season1819 as RawSeason),
  toPack(season1920 as RawSeason),
  toPack(season2021 as RawSeason),
  toPack(season2122 as RawSeason),
  toPack(season2223 as RawSeason),
  toPack(season2324 as RawSeason),
  toPack(season2425 as RawSeason),
  toPack(season2526 as RawSeason),
];

export const RETRO_SEASON_KEYS = RETRO_SEASON_PACKS.map((p) => p.seasonKey);
