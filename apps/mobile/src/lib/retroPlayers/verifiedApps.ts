/**
 * Premier League appearances checked against at least two published sources.
 * A player is listed here only when every club spell below is agreed.
 * Checked players replace the starter-pack rows for that name.
 * Seasons are Premier League seasons only. A gap (loan, or years abroad)
 * is a separate spell so the question does not name a season he was not there.
 */

export type VerifiedClubSpell = {
  playerName: string;
  clubCode: string;
  clubName: string;
  appearances: number;
  firstSeason: string;
  lastSeason: string;
  sources: readonly string[];
};

const MFF_300 =
  'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/all-time-300-or-more-players-premier-league-appearances/';

function spell(
  playerName: string,
  clubCode: string,
  clubName: string,
  appearances: number,
  firstSeason: string,
  lastSeason: string,
  sources: readonly string[]
): VerifiedClubSpell {
  return { playerName, clubCode, clubName, appearances, firstSeason, lastSeason, sources };
}

const GIGGS = [
  'https://www.bbc.com/sport/football/articles/c4ng0l55r2ro',
  'https://www.premierleague.com/en/news/3972366',
] as const;

const ONE_CLUB_PL = [
  'https://www.premierleague.com/en/news/3972366',
  'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/all-time-300-or-more-players-premier-league-appearances/',
] as const;

const BARRY = [
  'https://en.wikipedia.org/wiki/Gareth_Barry',
  'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/all-time-300-or-more-players-premier-league-appearances/',
] as const;

const MILNER_PL = ['https://www.premierleague.com/en/news/4562466'] as const;
const MILNER_BBC = ['https://www.bbc.com/sport/football/articles/c152jqz1dwzo'] as const;

const LAMPARD = [
  'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/all-time-300-or-more-players-premier-league-appearances/',
  'https://en.wikipedia.org/wiki/Frank_Lampard',
] as const;

const SHEARER = [
  'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/all-time-300-or-more-players-premier-league-appearances/',
  'https://en.wikipedia.org/wiki/Alan_Shearer',
] as const;

const ROONEY = [
  'https://www.statmuse.com/fc/ask/wayne-rooney-stats-with-everton',
  'https://fbref.com/en/players/f07be45a/Wayne-Rooney',
] as const;

const CAMPBELL = [
  'https://en.wikipedia.org/wiki/Sol_Campbell',
  'https://www.transfermarkt.us/sol-campbell/leistungsdatenverein/spieler/3198',
  'https://www.statmuse.com/fc/ask/sol-campbell-in-premier-league',
] as const;

const JAMES = [
  'https://en.wikipedia.org/wiki/David_James_(footballer,_born_1970)',
  'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/all-time-300-or-more-players-premier-league-appearances/',
] as const;

const PHIL_NEVILLE = [
  'https://en.wikipedia.org/wiki/Phil_Neville',
  'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/all-time-300-or-more-players-premier-league-appearances/',
] as const;

const GARY_NEVILLE = [
  'https://www.bbc.com/sport/football/14774972',
  'https://vitalfootball.co.uk/united-neville-hits-400-mark/',
  'https://www.mufcinfo.com/manupag/a-z_player_archive/a-z_player_archive_pages/neville_gary.html',
] as const;

const CECH = [
  'https://www.skysports.com/football/news/11661/11608012/petr-cechs-premier-league-career-in-numbers',
  'https://fbref.com/en/players/71672fa0/Petr-Cech',
  'https://www.premierleague.com/en/events/hall-of-fame/inductees/petr-cech',
] as const;

const AGUERO = [
  'https://www.premierleague.com/players/4328',
  'https://www.statmuse.com/fc/ask/sergio-aguero-all-time-man-city-stats',
  'https://www.transfermarkt.com/sergio-aguero/leistungsdatenverein/spieler/26399',
] as const;

const SILVA = [
  'https://www.premierleague.com/en/events/hall-of-fame/nominees/david-silva',
  'https://www.statmuse.com/fc/ask/premier-league-appearances-for-man-city-david-silva',
] as const;

const HENRY = [
  'https://www.premierleague.com/players/1659',
  'https://goalometer.com/striker_stats/P25/P25_summary.php',
  'https://www.statmuse.com/fc/ask/thierry-henry-stats-with-arsenal',
] as const;

const CARRICK = [
  'https://www.transfermarkt.co.uk/michael-carrick/leistungsdatenverein/spieler/3878',
  'https://www.sporting-heroes.net/football/manchester-united-fc/michael-carrick-8899/premiership-appearances_a25896/',
  'https://www.statmuse.com/fc/ask/carrick-premier-league-appearances-for-manchester-united',
] as const;

const DE_GEA = [
  'https://www.bbc.com/sport/articles/c4n0427p88qo',
  'https://www.statmuse.com/fc/ask/david-de-gea-manchester-united-appearences',
] as const;

const LLORIS = [
  'https://www.tottenhamhotspur.com/the-club/history/legends/hugo-lloris',
  'https://www.statmuse.com/fc/ask/lloris-premier-league-appearances',
] as const;

const HESKEY = [
  'https://goalometer.com/striker_stats/P120/P120_teams.php',
  'https://www.transfermarkt.com/emile-heskey/leistungsdatenverein/spieler/3142',
  'https://www.lfchistory.net/Players/Player/GamesPerCompetition/318-12',
] as const;

const FERDINAND = [
  'https://www.statmuse.com/fc/ask/rio-ferdinand-appearances-by-club',
  'https://www.transfermarkt.com/rio-ferdinand/leistungsdatendetails/spieler/3235',
] as const;

const ASHLEY_COLE = [
  'https://www.statmuse.com/fc/ask/premier-league-appearances-ashley-cole',
  'https://en.wikipedia.org/wiki/Ashley_Cole',
] as const;

const BERGKAMP = [
  'http://www.arsenal.com/news/features/dennis-bergkamp',
  'https://web.archive.org/web/20150405043617/http:/www.premierleague.com/en-gb/players/profile.career-history.html/dennis-bergkamp',
] as const;

const VIDIC = [
  'https://www.premierleague.com/en/news/1653924',
  'https://www.mufcinfo.com/manupag/a-z_player_archive/a-z_player_archive_pages/vidic_nemanja.html',
] as const;

const VIEIRA = [
  'https://www.transfermarkt.co.uk/patrick-vieira/detaillierteleistungsdaten/spieler/3183',
  'https://www.premierleague.com/players/1132',
] as const;

const OSMAN = [
  'https://www.statmuse.com/fc/ask/how-many-premier-league-appearances-did-leon-osman-make-fo-everton',
  'https://www.11v11.com/teams/everton/tab/stats/option/appearances/',
] as const;

export const VERIFIED_PLAYER_CLUB_SPELLS: readonly VerifiedClubSpell[] = [
  spell('Ryan Giggs', 'MUN', 'Man United', 632, '1992/93', '2013/14', GIGGS),

  spell('Gareth Barry', 'AVL', 'Aston Villa', 365, '1997/98', '2008/09', BARRY),
  spell('Gareth Barry', 'MCI', 'Man City', 132, '2009/10', '2012/13', BARRY),
  spell('Gareth Barry', 'EVE', 'Everton', 131, '2013/14', '2016/17', BARRY),
  spell('Gareth Barry', 'WBA', 'West Brom', 25, '2017/18', '2017/18', BARRY),

  // Leeds, Newcastle, City and Liverpool are in the Premier League article at appearance 654.
  // Villa is the loan (27) plus the later spell (73). Brighton is 658 minus those finished clubs.
  spell('James Milner', 'LEE', 'Leeds', 48, '2002/03', '2003/04', [...MILNER_PL, ...MILNER_BBC]),
  spell('James Milner', 'NEW', 'Newcastle', 94, '2004/05', '2007/08', [...MILNER_PL, ...MILNER_BBC]),
  spell('James Milner', 'AVL', 'Aston Villa', 27, '2005/06', '2005/06', [...MILNER_PL, ...MILNER_BBC]),
  spell('James Milner', 'AVL', 'Aston Villa', 73, '2008/09', '2009/10', [...MILNER_PL, ...MILNER_BBC]),
  spell('James Milner', 'MCI', 'Man City', 147, '2010/11', '2014/15', [...MILNER_PL, ...MILNER_BBC]),
  spell('James Milner', 'LIV', 'Liverpool', 230, '2015/16', '2022/23', [...MILNER_PL, ...MILNER_BBC]),
  spell('James Milner', 'BHA', 'Brighton', 39, '2023/24', '2025/26', [...MILNER_PL, ...MILNER_BBC]),

  spell('Frank Lampard', 'WHU', 'West Ham', 148, '1995/96', '2000/01', LAMPARD),
  spell('Frank Lampard', 'CHE', 'Chelsea', 429, '2001/02', '2013/14', LAMPARD),
  spell('Frank Lampard', 'MCI', 'Man City', 32, '2014/15', '2014/15', LAMPARD),

  spell('Steven Gerrard', 'LIV', 'Liverpool', 504, '1998/99', '2014/15', ONE_CLUB_PL),
  spell('Jamie Carragher', 'LIV', 'Liverpool', 508, '1996/97', '2012/13', ONE_CLUB_PL),
  spell('John Terry', 'CHE', 'Chelsea', 492, '1998/99', '2016/17', ONE_CLUB_PL),
  spell('Paul Scholes', 'MUN', 'Man United', 499, '1994/95', '2012/13', ONE_CLUB_PL),

  spell('Alan Shearer', 'BLA', 'Blackburn', 138, '1992/93', '1995/96', SHEARER),
  spell('Alan Shearer', 'NEW', 'Newcastle', 303, '1996/97', '2005/06', SHEARER),

  // Everton 33+34 in the first spell and 31 on the return. United is the 393 in the career total of 491.
  spell('Wayne Rooney', 'EVE', 'Everton', 67, '2002/03', '2003/04', ROONEY),
  spell('Wayne Rooney', 'MUN', 'Man United', 393, '2004/05', '2016/17', ROONEY),
  spell('Wayne Rooney', 'EVE', 'Everton', 31, '2017/18', '2017/18', ROONEY),

  // Arsenal is 135, then Portsmouth, then 11 on the return. Newcastle is the last season.
  spell('Sol Campbell', 'TOT', 'Spurs', 255, '1992/93', '2000/01', CAMPBELL),
  spell('Sol Campbell', 'ARS', 'Arsenal', 135, '2001/02', '2005/06', CAMPBELL),
  spell('Sol Campbell', 'POR', 'Portsmouth', 95, '2006/07', '2008/09', CAMPBELL),
  spell('Sol Campbell', 'ARS', 'Arsenal', 11, '2009/10', '2009/10', CAMPBELL),
  spell('Sol Campbell', 'NEW', 'Newcastle', 7, '2010/11', '2010/11', CAMPBELL),

  spell('David James', 'LIV', 'Liverpool', 214, '1992/93', '1998/99', JAMES),
  spell('David James', 'AVL', 'Aston Villa', 67, '1999/00', '2000/01', JAMES),
  spell('David James', 'WHU', 'West Ham', 64, '2001/02', '2002/03', JAMES),
  spell('David James', 'MCI', 'Man City', 93, '2003/04', '2005/06', JAMES),
  spell('David James', 'POR', 'Portsmouth', 134, '2006/07', '2009/10', JAMES),

  spell('Phil Neville', 'MUN', 'Man United', 263, '1994/95', '2004/05', PHIL_NEVILLE),
  spell('Phil Neville', 'EVE', 'Everton', 242, '2005/06', '2012/13', PHIL_NEVILLE),

  // One league appearance on 8 May 1994, then through the last match on 1 January 2011.
  spell('Gary Neville', 'MUN', 'Man United', 400, '1993/94', '2010/11', GARY_NEVILLE),

  spell('Petr Cech', 'CHE', 'Chelsea', 333, '2004/05', '2014/15', CECH),
  spell('Petr Cech', 'ARS', 'Arsenal', 110, '2015/16', '2018/19', CECH),

  spell('Sergio Aguero', 'MCI', 'Man City', 275, '2011/12', '2020/21', AGUERO),
  spell('David Silva', 'MCI', 'Man City', 309, '2010/11', '2019/20', SILVA),

  // 258 at Arsenal includes four appearances on loan in 2011/12. The years between are not Arsenal.
  spell('Thierry Henry', 'ARS', 'Arsenal', 254, '1999/00', '2006/07', HENRY),
  spell('Thierry Henry', 'ARS', 'Arsenal', 4, '2011/12', '2011/12', HENRY),

  // West Ham 2003/04 was the Championship, so it is not in the 101.
  spell('Michael Carrick', 'WHU', 'West Ham', 101, '1999/00', '2002/03', CARRICK),
  spell('Michael Carrick', 'TOT', 'Spurs', 64, '2004/05', '2005/06', CARRICK),
  spell('Michael Carrick', 'MUN', 'Man United', 316, '2006/07', '2017/18', CARRICK),

  spell('David de Gea', 'MUN', 'Man United', 415, '2011/12', '2022/23', DE_GEA),
  spell('Hugo Lloris', 'TOT', 'Spurs', 361, '2012/13', '2022/23', LLORIS),

  // Leicester 1995/96 was the Championship. One appearance in 1994/95, then 123 after promotion.
  spell('Emile Heskey', 'LEI', 'Leicester', 1, '1994/95', '1994/95', HESKEY),
  spell('Emile Heskey', 'LEI', 'Leicester', 123, '1996/97', '1999/00', HESKEY),
  spell('Emile Heskey', 'LIV', 'Liverpool', 150, '1999/00', '2003/04', HESKEY),
  spell('Emile Heskey', 'BIR', 'Birmingham', 68, '2004/05', '2005/06', HESKEY),
  spell('Emile Heskey', 'WIG', 'Wigan', 82, '2006/07', '2008/09', HESKEY),
  spell('Emile Heskey', 'AVL', 'Aston Villa', 92, '2008/09', '2011/12', HESKEY),

  spell('Rio Ferdinand', 'WHU', 'West Ham', 127, '1995/96', '2000/01', FERDINAND),
  spell('Rio Ferdinand', 'LEE', 'Leeds', 54, '2000/01', '2001/02', FERDINAND),
  spell('Rio Ferdinand', 'MUN', 'Man United', 312, '2002/03', '2013/14', FERDINAND),
  spell('Rio Ferdinand', 'QPR', 'QPR', 11, '2014/15', '2014/15', FERDINAND),

  // 228 at Arsenal is all competitions. Premier League appearances are 156.
  spell('Ashley Cole', 'ARS', 'Arsenal', 156, '1999/00', '2005/06', ASHLEY_COLE),
  spell('Ashley Cole', 'CHE', 'Chelsea', 229, '2006/07', '2013/14', ASHLEY_COLE),

  spell('Dennis Bergkamp', 'ARS', 'Arsenal', 315, '1995/96', '2005/06', BERGKAMP),
  spell('Nemanja Vidic', 'MUN', 'Man United', 211, '2005/06', '2013/14', VIDIC),

  spell('Patrick Vieira', 'ARS', 'Arsenal', 279, '1996/97', '2004/05', VIEIRA),
  spell('Patrick Vieira', 'MCI', 'Man City', 28, '2009/10', '2010/11', VIEIRA),

  spell('Leon Osman', 'EVE', 'Everton', 352, '2002/03', '2015/16', OSMAN),

  // Gary Speed
  spell('Gary Speed', 'LEE', 'Leeds', 143, '1992/93', '1995/96', ['https://en.wikipedia.org/wiki/Gary_Speed', MFF_300]),
  spell('Gary Speed', 'EVE', 'Everton', 58, '1996/97', '1997/98', ['https://en.wikipedia.org/wiki/Gary_Speed', MFF_300]),
  spell('Gary Speed', 'NEW', 'Newcastle', 213, '1997/98', '2003/04', ['https://en.wikipedia.org/wiki/Gary_Speed', MFF_300]),
  spell('Gary Speed', 'BOL', 'Bolton', 121, '2004/05', '2007/08', ['https://en.wikipedia.org/wiki/Gary_Speed', MFF_300]),

  // Mark Schwarzer
  spell('Mark Schwarzer', 'MID', 'Middlesbrough', 7, '1996/97', '1996/97', ['https://en.wikipedia.org/wiki/Mark_Schwarzer', MFF_300]),
  spell('Mark Schwarzer', 'MID', 'Middlesbrough', 325, '1998/99', '2007/08', ['https://en.wikipedia.org/wiki/Mark_Schwarzer', MFF_300]),
  spell('Mark Schwarzer', 'FUL', 'Fulham', 172, '2008/09', '2012/13', ['https://en.wikipedia.org/wiki/Mark_Schwarzer', MFF_300]),
  spell('Mark Schwarzer', 'CHE', 'Chelsea', 4, '2013/14', '2014/15', ['https://en.wikipedia.org/wiki/Mark_Schwarzer', MFF_300]),
  spell('Mark Schwarzer', 'LEI', 'Leicester', 6, '2014/15', '2015/16', ['https://en.wikipedia.org/wiki/Mark_Schwarzer', MFF_300]),

  // Jermain Defoe
  spell('Jermain Defoe', 'WHU', 'West Ham', 74, '1999/00', '2002/03', ['https://en.wikipedia.org/wiki/Jermain_Defoe', MFF_300]),
  spell('Jermain Defoe', 'TOT', 'Spurs', 276, '2003/04', '2013/14', ['https://en.wikipedia.org/wiki/Jermain_Defoe', MFF_300]),
  spell('Jermain Defoe', 'POR', 'Portsmouth', 31, '2007/08', '2008/09', ['https://en.wikipedia.org/wiki/Jermain_Defoe', MFF_300]),
  spell('Jermain Defoe', 'SUN', 'Sunderland', 87, '2014/15', '2016/17', ['https://en.wikipedia.org/wiki/Jermain_Defoe', MFF_300]),
  spell('Jermain Defoe', 'BOU', 'Bournemouth', 28, '2017/18', '2018/19', ['https://en.wikipedia.org/wiki/Jermain_Defoe', MFF_300]),

  // Sylvain Distin
  spell('Sylvain Distin', 'NEW', 'Newcastle', 28, '2001/02', '2001/02', ['https://en.wikipedia.org/wiki/Sylvain_Distin', MFF_300]),
  spell('Sylvain Distin', 'MCI', 'Man City', 178, '2002/03', '2006/07', ['https://en.wikipedia.org/wiki/Sylvain_Distin', MFF_300]),
  spell('Sylvain Distin', 'POR', 'Portsmouth', 77, '2007/08', '2009/10', ['https://en.wikipedia.org/wiki/Sylvain_Distin', MFF_300]),
  spell('Sylvain Distin', 'EVE', 'Everton', 174, '2009/10', '2014/15', ['https://en.wikipedia.org/wiki/Sylvain_Distin', MFF_300]),
  spell('Sylvain Distin', 'BOU', 'Bournemouth', 12, '2015/16', '2015/16', ['https://en.wikipedia.org/wiki/Sylvain_Distin', MFF_300]),

  // Peter Crouch
  spell('Peter Crouch', 'TOT', 'Spurs', 73, '2009/10', '2011/12', ['https://en.wikipedia.org/wiki/Peter_Crouch', MFF_300]),
  spell('Peter Crouch', 'AVL', 'Aston Villa', 37, '2001/02', '2003/04', ['https://en.wikipedia.org/wiki/Peter_Crouch', MFF_300]),
  spell('Peter Crouch', 'SOU', 'Southampton', 27, '2004/05', '2004/05', ['https://en.wikipedia.org/wiki/Peter_Crouch', MFF_300]),
  spell('Peter Crouch', 'LIV', 'Liverpool', 85, '2005/06', '2007/08', ['https://en.wikipedia.org/wiki/Peter_Crouch', MFF_300]),
  spell('Peter Crouch', 'POR', 'Portsmouth', 38, '2008/09', '2008/09', ['https://en.wikipedia.org/wiki/Peter_Crouch', MFF_300]),
  spell('Peter Crouch', 'STK', 'Stoke', 202, '2011/12', '2017/18', ['https://en.wikipedia.org/wiki/Peter_Crouch', MFF_300]),
  spell('Peter Crouch', 'BUR', 'Burnley', 6, '2018/19', '2018/19', ['https://en.wikipedia.org/wiki/Peter_Crouch', MFF_300]),

  // Aaron Hughes
  spell('Aaron Hughes', 'NEW', 'Newcastle', 205, '1996/97', '2004/05', ['https://en.wikipedia.org/wiki/Aaron_Hughes', MFF_300]),
  spell('Aaron Hughes', 'AVL', 'Aston Villa', 54, '2005/06', '2006/07', ['https://en.wikipedia.org/wiki/Aaron_Hughes', MFF_300]),
  spell('Aaron Hughes', 'FUL', 'Fulham', 196, '2007/08', '2013/14', ['https://en.wikipedia.org/wiki/Aaron_Hughes', MFF_300]),

  // Shay Given
  spell('Shay Given', 'BLA', 'Blackburn', 2, '1996/97', '1996/97', ['https://en.wikipedia.org/wiki/Shay_Given', MFF_300]),
  spell('Shay Given', 'NEW', 'Newcastle', 354, '1997/98', '2008/09', ['https://en.wikipedia.org/wiki/Shay_Given', MFF_300]),
  spell('Shay Given', 'MCI', 'Man City', 50, '2008/09', '2010/11', ['https://en.wikipedia.org/wiki/Shay_Given', MFF_300]),
  spell('Shay Given', 'AVL', 'Aston Villa', 37, '2011/12', '2014/15', ['https://en.wikipedia.org/wiki/Shay_Given', MFF_300]),
  spell('Shay Given', 'STK', 'Stoke', 8, '2015/16', '2016/17', ['https://en.wikipedia.org/wiki/Shay_Given', MFF_300]),

  // Brad Friedel
  spell('Brad Friedel', 'LIV', 'Liverpool', 25, '1997/98', '1999/00', ['https://en.wikipedia.org/wiki/Brad_Friedel', MFF_300]),
  spell('Brad Friedel', 'BLA', 'Blackburn', 261, '2001/02', '2007/08', ['https://en.wikipedia.org/wiki/Brad_Friedel', MFF_300]),
  spell('Brad Friedel', 'AVL', 'Aston Villa', 114, '2008/09', '2010/11', ['https://en.wikipedia.org/wiki/Brad_Friedel', MFF_300]),
  spell('Brad Friedel', 'TOT', 'Spurs', 50, '2011/12', '2014/15', ['https://en.wikipedia.org/wiki/Brad_Friedel', MFF_300]),

  // John O'Shea
  spell('John O\'Shea', 'MUN', 'Man United', 256, '1999/00', '2010/11', ['https://en.wikipedia.org/wiki/John_O%27Shea', MFF_300]),
  spell('John O\'Shea', 'SUN', 'Sunderland', 189, '2011/12', '2016/17', ['https://en.wikipedia.org/wiki/John_O%27Shea', MFF_300]),

  // Kevin Davies
  spell('Kevin Davies', 'SOU', 'Southampton', 25, '1997/98', '1997/98', ['https://en.wikipedia.org/wiki/Kevin_Davies', MFF_300]),
  spell('Kevin Davies', 'SOU', 'Southampton', 82, '1999/00', '2002/03', ['https://en.wikipedia.org/wiki/Kevin_Davies', MFF_300]),
  spell('Kevin Davies', 'BLA', 'Blackburn', 21, '1998/99', '1998/99', ['https://en.wikipedia.org/wiki/Kevin_Davies', MFF_300]),
  spell('Kevin Davies', 'BOL', 'Bolton', 316, '2003/04', '2011/12', ['https://en.wikipedia.org/wiki/Kevin_Davies', MFF_300]),

  // Richard Dunne
  spell('Richard Dunne', 'EVE', 'Everton', 60, '1996/97', '2000/01', ['https://en.wikipedia.org/wiki/Richard_Dunne', MFF_300]),
  spell('Richard Dunne', 'MCI', 'Man City', 25, '2000/01', '2000/01', ['https://en.wikipedia.org/wiki/Richard_Dunne', MFF_300]),
  spell('Richard Dunne', 'MCI', 'Man City', 228, '2002/03', '2009/10', ['https://en.wikipedia.org/wiki/Richard_Dunne', MFF_300]),
  spell('Richard Dunne', 'AVL', 'Aston Villa', 95, '2009/10', '2012/13', ['https://en.wikipedia.org/wiki/Richard_Dunne', MFF_300]),
  spell('Richard Dunne', 'QPR', 'QPR', 23, '2014/15', '2014/15', ['https://en.wikipedia.org/wiki/Richard_Dunne', MFF_300]),

  // Gareth Southgate
  spell('Gareth Southgate', 'CRY', 'Palace', 33, '1992/93', '1992/93', ['https://en.wikipedia.org/wiki/Gareth_Southgate', MFF_300]),
  spell('Gareth Southgate', 'CRY', 'Palace', 42, '1994/95', '1994/95', ['https://en.wikipedia.org/wiki/Gareth_Southgate', MFF_300]),
  spell('Gareth Southgate', 'AVL', 'Aston Villa', 191, '1995/96', '2000/01', ['https://en.wikipedia.org/wiki/Gareth_Southgate', MFF_300]),
  spell('Gareth Southgate', 'MID', 'Middlesbrough', 160, '2001/02', '2005/06', ['https://en.wikipedia.org/wiki/Gareth_Southgate', MFF_300]),

  // Leighton Baines
  spell('Leighton Baines', 'WIG', 'Wigan', 72, '2005/06', '2006/07', ['https://en.wikipedia.org/wiki/Leighton_Baines', MFF_300]),
  spell('Leighton Baines', 'EVE', 'Everton', 348, '2007/08', '2019/20', ['https://en.wikipedia.org/wiki/Leighton_Baines', MFF_300]),

  // Teddy Sheringham
  spell('Teddy Sheringham', 'NFO', 'Forest', 3, '1992/93', '1992/93', ['https://en.wikipedia.org/wiki/Teddy_Sheringham', MFF_300]),
  spell('Teddy Sheringham', 'TOT', 'Spurs', 166, '1992/93', '1996/97', ['https://en.wikipedia.org/wiki/Teddy_Sheringham', MFF_300]),
  spell('Teddy Sheringham', 'TOT', 'Spurs', 70, '2001/02', '2002/03', ['https://en.wikipedia.org/wiki/Teddy_Sheringham', MFF_300]),
  spell('Teddy Sheringham', 'MUN', 'Man United', 104, '1997/98', '2000/01', ['https://en.wikipedia.org/wiki/Teddy_Sheringham', MFF_300]),
  spell('Teddy Sheringham', 'POR', 'Portsmouth', 32, '2003/04', '2003/04', ['https://en.wikipedia.org/wiki/Teddy_Sheringham', MFF_300]),
  spell('Teddy Sheringham', 'WHU', 'West Ham', 43, '2005/06', '2006/07', ['https://en.wikipedia.org/wiki/Teddy_Sheringham', MFF_300]),

  // Aaron Lennon
  spell('Aaron Lennon', 'LEE', 'Leeds', 11, '2003/04', '2003/04', ['https://en.wikipedia.org/wiki/Aaron_Lennon', MFF_300]),
  spell('Aaron Lennon', 'TOT', 'Spurs', 266, '2005/06', '2014/15', ['https://en.wikipedia.org/wiki/Aaron_Lennon', MFF_300]),
  spell('Aaron Lennon', 'EVE', 'Everton', 65, '2014/15', '2017/18', ['https://en.wikipedia.org/wiki/Aaron_Lennon', MFF_300]),
  spell('Aaron Lennon', 'BUR', 'Burnley', 46, '2017/18', '2019/20', ['https://en.wikipedia.org/wiki/Aaron_Lennon', MFF_300]),
  spell('Aaron Lennon', 'BUR', 'Burnley', 28, '2021/22', '2021/22', ['https://en.wikipedia.org/wiki/Aaron_Lennon', MFF_300]),

  // Andy Cole
  spell('Andy Cole', 'NEW', 'Newcastle', 58, '1993/94', '1994/95', ['https://en.wikipedia.org/wiki/Andy_Cole', MFF_300]),
  spell('Andy Cole', 'MUN', 'Man United', 195, '1994/95', '2001/02', ['https://en.wikipedia.org/wiki/Andy_Cole', MFF_300]),
  spell('Andy Cole', 'BLA', 'Blackburn', 83, '2001/02', '2003/04', ['https://en.wikipedia.org/wiki/Andy_Cole', MFF_300]),
  spell('Andy Cole', 'FUL', 'Fulham', 31, '2004/05', '2004/05', ['https://en.wikipedia.org/wiki/Andy_Cole', MFF_300]),
  spell('Andy Cole', 'MCI', 'Man City', 22, '2005/06', '2005/06', ['https://en.wikipedia.org/wiki/Andy_Cole', MFF_300]),
  spell('Andy Cole', 'POR', 'Portsmouth', 18, '2006/07', '2006/07', ['https://en.wikipedia.org/wiki/Andy_Cole', MFF_300]),
  spell('Andy Cole', 'SUN', 'Sunderland', 7, '2007/08', '2007/08', ['https://en.wikipedia.org/wiki/Andy_Cole', MFF_300]),

  // Mark Noble
  spell('Mark Noble', 'WHU', 'West Ham', 128, '2005/06', '2010/11', ['https://en.wikipedia.org/wiki/Mark_Noble', MFF_300]),
  spell('Mark Noble', 'WHU', 'West Ham', 286, '2012/13', '2021/22', ['https://en.wikipedia.org/wiki/Mark_Noble', MFF_300]),

  // Nicky Butt
  spell('Nicky Butt', 'MUN', 'Man United', 270, '1992/93', '2003/04', ['https://en.wikipedia.org/wiki/Nicky_Butt', MFF_300]),
  spell('Nicky Butt', 'NEW', 'Newcastle', 117, '2004/05', '2008/09', ['https://en.wikipedia.org/wiki/Nicky_Butt', MFF_300]),
  spell('Nicky Butt', 'BIR', 'Birmingham', 24, '2005/06', '2005/06', ['https://en.wikipedia.org/wiki/Nicky_Butt', MFF_300]),

  // Stewart Downing
  spell('Stewart Downing', 'MID', 'Middlesbrough', 181, '2001/02', '2008/09', ['https://en.wikipedia.org/wiki/Stewart_Downing', MFF_300]),
  spell('Stewart Downing', 'MID', 'Middlesbrough', 30, '2016/17', '2016/17', ['https://en.wikipedia.org/wiki/Stewart_Downing', MFF_300]),
  spell('Stewart Downing', 'AVL', 'Aston Villa', 63, '2009/10', '2010/11', ['https://en.wikipedia.org/wiki/Stewart_Downing', MFF_300]),
  spell('Stewart Downing', 'LIV', 'Liverpool', 65, '2011/12', '2012/13', ['https://en.wikipedia.org/wiki/Stewart_Downing', MFF_300]),
  spell('Stewart Downing', 'WHU', 'West Ham', 69, '2013/14', '2014/15', ['https://en.wikipedia.org/wiki/Stewart_Downing', MFF_300]),

  // Kevin Nolan
  spell('Kevin Nolan', 'BOL', 'Bolton', 261, '2001/02', '2008/09', ['https://en.wikipedia.org/wiki/Kevin_Nolan', MFF_300]),
  spell('Kevin Nolan', 'NEW', 'Newcastle', 11, '2008/09', '2008/09', ['https://en.wikipedia.org/wiki/Kevin_Nolan', MFF_300]),
  spell('Kevin Nolan', 'NEW', 'Newcastle', 30, '2010/11', '2010/11', ['https://en.wikipedia.org/wiki/Kevin_Nolan', MFF_300]),
  spell('Kevin Nolan', 'WHU', 'West Ham', 99, '2012/13', '2015/16', ['https://en.wikipedia.org/wiki/Kevin_Nolan', MFF_300]),

  // Tim Howard
  spell('Tim Howard', 'MUN', 'Man United', 45, '2003/04', '2006/07', ['https://en.wikipedia.org/wiki/Tim_Howard', MFF_300]),
  spell('Tim Howard', 'EVE', 'Everton', 354, '2006/07', '2015/16', ['https://en.wikipedia.org/wiki/Tim_Howard', MFF_300]),

  // Theo Walcott
  spell('Theo Walcott', 'ARS', 'Arsenal', 270, '2005/06', '2017/18', ['https://en.wikipedia.org/wiki/Theo_Walcott', MFF_300]),
  spell('Theo Walcott', 'EVE', 'Everton', 77, '2017/18', '2020/21', ['https://en.wikipedia.org/wiki/Theo_Walcott', MFF_300]),
  spell('Theo Walcott', 'SOU', 'Southampton', 50, '2020/21', '2022/23', ['https://en.wikipedia.org/wiki/Theo_Walcott', MFF_300]),

  // Raheem Sterling
  spell('Raheem Sterling', 'LIV', 'Liverpool', 95, '2011/12', '2014/15', ['https://en.wikipedia.org/wiki/Raheem_Sterling', MFF_300]),
  spell('Raheem Sterling', 'MCI', 'Man City', 225, '2015/16', '2021/22', ['https://en.wikipedia.org/wiki/Raheem_Sterling', MFF_300]),
  spell('Raheem Sterling', 'CHE', 'Chelsea', 59, '2022/23', '2023/24', ['https://en.wikipedia.org/wiki/Raheem_Sterling', MFF_300]),
  spell('Raheem Sterling', 'ARS', 'Arsenal', 17, '2024/25', '2024/25', ['https://en.wikipedia.org/wiki/Raheem_Sterling', MFF_300]),

  // Damien Duff
  spell('Damien Duff', 'BLA', 'Blackburn', 55, '1996/97', '1998/99', ['https://en.wikipedia.org/wiki/Damien_Duff', MFF_300]),
  spell('Damien Duff', 'BLA', 'Blackburn', 58, '2001/02', '2002/03', ['https://en.wikipedia.org/wiki/Damien_Duff', MFF_300]),
  spell('Damien Duff', 'CHE', 'Chelsea', 81, '2003/04', '2005/06', ['https://en.wikipedia.org/wiki/Damien_Duff', MFF_300]),
  spell('Damien Duff', 'NEW', 'Newcastle', 68, '2006/07', '2008/09', ['https://en.wikipedia.org/wiki/Damien_Duff', MFF_300]),
  spell('Damien Duff', 'FUL', 'Fulham', 130, '2009/10', '2013/14', ['https://en.wikipedia.org/wiki/Damien_Duff', MFF_300]),

  // Ben Foster
  spell('Ben Foster', 'MUN', 'Man United', 12, '2007/08', '2009/10', ['https://en.wikipedia.org/wiki/Ben_Foster_(footballer)', MFF_300]),
  spell('Ben Foster', 'WAT', 'Watford', 29, '2006/07', '2006/07', ['https://en.wikipedia.org/wiki/Ben_Foster_(footballer)', MFF_300]),
  spell('Ben Foster', 'WAT', 'Watford', 76, '2018/19', '2019/20', ['https://en.wikipedia.org/wiki/Ben_Foster_(footballer)', MFF_300]),
  spell('Ben Foster', 'WAT', 'Watford', 26, '2021/22', '2021/22', ['https://en.wikipedia.org/wiki/Ben_Foster_(footballer)', MFF_300]),
  spell('Ben Foster', 'BIR', 'Birmingham', 38, '2010/11', '2010/11', ['https://en.wikipedia.org/wiki/Ben_Foster_(footballer)', MFF_300]),
  spell('Ben Foster', 'WBA', 'West Brom', 209, '2011/12', '2017/18', ['https://en.wikipedia.org/wiki/Ben_Foster_(footballer)', MFF_300]),

  // Jonny Evans
  spell('Jonny Evans', 'MUN', 'Man United', 131, '2006/07', '2014/15', ['https://en.wikipedia.org/wiki/Jonny_Evans', MFF_300]),
  spell('Jonny Evans', 'MUN', 'Man United', 30, '2023/24', '2024/25', ['https://en.wikipedia.org/wiki/Jonny_Evans', MFF_300]),
  spell('Jonny Evans', 'SUN', 'Sunderland', 15, '2007/08', '2007/08', ['https://en.wikipedia.org/wiki/Jonny_Evans', MFF_300]),
  spell('Jonny Evans', 'WBA', 'West Brom', 89, '2015/16', '2017/18', ['https://en.wikipedia.org/wiki/Jonny_Evans', MFF_300]),
  spell('Jonny Evans', 'LEI', 'Leicester', 121, '2018/19', '2022/23', ['https://en.wikipedia.org/wiki/Jonny_Evans', MFF_300]),

  // Ray Parlour
  spell('Ray Parlour', 'ARS', 'Arsenal', 333, '1992/93', '2003/04', ['https://en.wikipedia.org/wiki/Ray_Parlour', MFF_300]),
  spell('Ray Parlour', 'MID', 'Middlesbrough', 46, '2004/05', '2006/07', ['https://en.wikipedia.org/wiki/Ray_Parlour', MFF_300]),

  // Joe Cole
  spell('Joe Cole', 'WHU', 'West Ham', 126, '1998/99', '2002/03', ['https://en.wikipedia.org/wiki/Joe_Cole', MFF_300]),
  spell('Joe Cole', 'WHU', 'West Ham', 31, '2012/13', '2013/14', ['https://en.wikipedia.org/wiki/Joe_Cole', MFF_300]),
  spell('Joe Cole', 'CHE', 'Chelsea', 183, '2003/04', '2009/10', ['https://en.wikipedia.org/wiki/Joe_Cole', MFF_300]),
  spell('Joe Cole', 'LIV', 'Liverpool', 20, '2010/11', '2010/11', ['https://en.wikipedia.org/wiki/Joe_Cole', MFF_300]),
  spell('Joe Cole', 'LIV', 'Liverpool', 6, '2012/13', '2012/13', ['https://en.wikipedia.org/wiki/Joe_Cole', MFF_300]),
  spell('Joe Cole', 'AVL', 'Aston Villa', 12, '2014/15', '2015/16', ['https://en.wikipedia.org/wiki/Joe_Cole', MFF_300]),

  // Stephen Carr
  spell('Stephen Carr', 'TOT', 'Spurs', 226, '1993/94', '2003/04', ['https://en.wikipedia.org/wiki/Stephen_Carr', MFF_300]),
  spell('Stephen Carr', 'NEW', 'Newcastle', 78, '2004/05', '2007/08', ['https://en.wikipedia.org/wiki/Stephen_Carr', MFF_300]),
  spell('Stephen Carr', 'BIR', 'Birmingham', 73, '2009/10', '2010/11', ['https://en.wikipedia.org/wiki/Stephen_Carr', MFF_300]),

  // Dwight Yorke
  spell('Dwight Yorke', 'AVL', 'Aston Villa', 179, '1992/93', '1998/99', ['https://en.wikipedia.org/wiki/Dwight_Yorke', MFF_300]),
  spell('Dwight Yorke', 'MUN', 'Man United', 96, '1998/99', '2001/02', ['https://en.wikipedia.org/wiki/Dwight_Yorke', MFF_300]),
  spell('Dwight Yorke', 'BLA', 'Blackburn', 60, '2002/03', '2004/05', ['https://en.wikipedia.org/wiki/Dwight_Yorke', MFF_300]),
  spell('Dwight Yorke', 'BIR', 'Birmingham', 13, '2004/05', '2004/05', ['https://en.wikipedia.org/wiki/Dwight_Yorke', MFF_300]),
  spell('Dwight Yorke', 'SUN', 'Sunderland', 27, '2007/08', '2008/09', ['https://en.wikipedia.org/wiki/Dwight_Yorke', MFF_300]),

  // Nigel Martyn
  spell('Nigel Martyn', 'CRY', 'Palace', 42, '1992/93', '1992/93', ['https://en.wikipedia.org/wiki/Nigel_Martyn', MFF_300]),
  spell('Nigel Martyn', 'CRY', 'Palace', 37, '1994/95', '1994/95', ['https://en.wikipedia.org/wiki/Nigel_Martyn', MFF_300]),
  spell('Nigel Martyn', 'LEE', 'Leeds', 207, '1996/97', '2002/03', ['https://en.wikipedia.org/wiki/Nigel_Martyn', MFF_300]),
  spell('Nigel Martyn', 'EVE', 'Everton', 86, '2003/04', '2005/06', ['https://en.wikipedia.org/wiki/Nigel_Martyn', MFF_300]),

  // Scott Parker
  spell('Scott Parker', 'CHA', 'Charlton', 4, '1998/99', '1998/99', ['https://en.wikipedia.org/wiki/Scott_Parker', MFF_300]),
  spell('Scott Parker', 'CHA', 'Charlton', 106, '2000/01', '2003/04', ['https://en.wikipedia.org/wiki/Scott_Parker', MFF_300]),
  spell('Scott Parker', 'CHE', 'Chelsea', 15, '2003/04', '2004/05', ['https://en.wikipedia.org/wiki/Scott_Parker', MFF_300]),
  spell('Scott Parker', 'NEW', 'Newcastle', 55, '2005/06', '2006/07', ['https://en.wikipedia.org/wiki/Scott_Parker', MFF_300]),
  spell('Scott Parker', 'WHU', 'West Ham', 109, '2007/08', '2010/11', ['https://en.wikipedia.org/wiki/Scott_Parker', MFF_300]),
  spell('Scott Parker', 'TOT', 'Spurs', 50, '2011/12', '2012/13', ['https://en.wikipedia.org/wiki/Scott_Parker', MFF_300]),
  spell('Scott Parker', 'FUL', 'Fulham', 29, '2013/14', '2013/14', ['https://en.wikipedia.org/wiki/Scott_Parker', MFF_300]),

  // Roy Keane
  spell('Roy Keane', 'NFO', 'Forest', 40, '1992/93', '1992/93', ['https://en.wikipedia.org/wiki/Roy_Keane', MFF_300]),
  spell('Roy Keane', 'MUN', 'Man United', 326, '1993/94', '2005/06', ['https://en.wikipedia.org/wiki/Roy_Keane', MFF_300]),

  // Nicolas Anelka
  spell('Nicolas Anelka', 'ARS', 'Arsenal', 65, '1996/97', '1998/99', ['https://en.wikipedia.org/wiki/Nicolas_Anelka', MFF_300]),
  spell('Nicolas Anelka', 'LIV', 'Liverpool', 20, '2001/02', '2001/02', ['https://en.wikipedia.org/wiki/Nicolas_Anelka', MFF_300]),
  spell('Nicolas Anelka', 'MCI', 'Man City', 89, '2002/03', '2004/05', ['https://en.wikipedia.org/wiki/Nicolas_Anelka', MFF_300]),
  spell('Nicolas Anelka', 'BOL', 'Bolton', 53, '2006/07', '2007/08', ['https://en.wikipedia.org/wiki/Nicolas_Anelka', MFF_300]),
  spell('Nicolas Anelka', 'CHE', 'Chelsea', 125, '2007/08', '2011/12', ['https://en.wikipedia.org/wiki/Nicolas_Anelka', MFF_300]),
  spell('Nicolas Anelka', 'WBA', 'West Brom', 12, '2013/14', '2013/14', ['https://en.wikipedia.org/wiki/Nicolas_Anelka', MFF_300]),

  // Thomas Sørensen
  spell('Thomas Sørensen', 'SUN', 'Sunderland', 126, '1999/00', '2002/03', ['https://en.wikipedia.org/wiki/Thomas_Sørensen', MFF_300]),
  spell('Thomas Sørensen', 'AVL', 'Aston Villa', 139, '2003/04', '2007/08', ['https://en.wikipedia.org/wiki/Thomas_Sørensen', MFF_300]),
  spell('Thomas Sørensen', 'STK', 'Stoke', 99, '2008/09', '2014/15', ['https://en.wikipedia.org/wiki/Thomas_Sørensen', MFF_300]),

  // Trevor Sinclair
  spell('Trevor Sinclair', 'QPR', 'QPR', 102, '1993/94', '1995/96', ['https://en.wikipedia.org/wiki/Trevor_Sinclair', MFF_300]),
  spell('Trevor Sinclair', 'WHU', 'West Ham', 177, '1997/98', '2002/03', ['https://en.wikipedia.org/wiki/Trevor_Sinclair', MFF_300]),
  spell('Trevor Sinclair', 'MCI', 'Man City', 82, '2003/04', '2006/07', ['https://en.wikipedia.org/wiki/Trevor_Sinclair', MFF_300]),

  // Rory Delap
  spell('Rory Delap', 'DER', 'Derby', 103, '1997/98', '2000/01', ['https://en.wikipedia.org/wiki/Rory_Delap', MFF_300]),
  spell('Rory Delap', 'SOU', 'Southampton', 116, '2001/02', '2004/05', ['https://en.wikipedia.org/wiki/Rory_Delap', MFF_300]),
  spell('Rory Delap', 'SUN', 'Sunderland', 6, '2005/06', '2005/06', ['https://en.wikipedia.org/wiki/Rory_Delap', MFF_300]),
  spell('Rory Delap', 'STK', 'Stoke', 134, '2008/09', '2012/13', ['https://en.wikipedia.org/wiki/Rory_Delap', MFF_300]),

  // Glen Johnson
  spell('Glen Johnson', 'WHU', 'West Ham', 15, '2002/03', '2002/03', ['https://en.wikipedia.org/wiki/Glen_Johnson', MFF_300]),
  spell('Glen Johnson', 'CHE', 'Chelsea', 40, '2003/04', '2005/06', ['https://en.wikipedia.org/wiki/Glen_Johnson', MFF_300]),
  spell('Glen Johnson', 'CHE', 'Chelsea', 2, '2007/08', '2007/08', ['https://en.wikipedia.org/wiki/Glen_Johnson', MFF_300]),
  spell('Glen Johnson', 'POR', 'Portsmouth', 84, '2006/07', '2008/09', ['https://en.wikipedia.org/wiki/Glen_Johnson', MFF_300]),
  spell('Glen Johnson', 'LIV', 'Liverpool', 160, '2009/10', '2014/15', ['https://en.wikipedia.org/wiki/Glen_Johnson', MFF_300]),
  spell('Glen Johnson', 'STK', 'Stoke', 57, '2015/16', '2017/18', ['https://en.wikipedia.org/wiki/Glen_Johnson', MFF_300]),

  // Ugo Ehiogu
  spell('Ugo Ehiogu', 'AVL', 'Aston Villa', 229, '1992/93', '2000/01', ['https://en.wikipedia.org/wiki/Ugo_Ehiogu', MFF_300]),
  spell('Ugo Ehiogu', 'MID', 'Middlesbrough', 126, '2000/01', '2006/07', ['https://en.wikipedia.org/wiki/Ugo_Ehiogu', MFF_300]),

  // Kolo Toure
  spell('Kolo Toure', 'ARS', 'Arsenal', 225, '2001/02', '2008/09', ['https://en.wikipedia.org/wiki/Kolo_Touré', MFF_300]),
  spell('Kolo Toure', 'MCI', 'Man City', 82, '2009/10', '2012/13', ['https://en.wikipedia.org/wiki/Kolo_Touré', MFF_300]),
  spell('Kolo Toure', 'LIV', 'Liverpool', 46, '2013/14', '2015/16', ['https://en.wikipedia.org/wiki/Kolo_Touré', MFF_300]),

  // Les Ferdinand
  spell('Les Ferdinand', 'QPR', 'QPR', 110, '1992/93', '1994/95', ['https://en.wikipedia.org/wiki/Les_Ferdinand', MFF_300]),
  spell('Les Ferdinand', 'NEW', 'Newcastle', 68, '1995/96', '1996/97', ['https://en.wikipedia.org/wiki/Les_Ferdinand', MFF_300]),
  spell('Les Ferdinand', 'TOT', 'Spurs', 118, '1997/98', '2002/03', ['https://en.wikipedia.org/wiki/Les_Ferdinand', MFF_300]),
  spell('Les Ferdinand', 'WHU', 'West Ham', 14, '2002/03', '2002/03', ['https://en.wikipedia.org/wiki/Les_Ferdinand', MFF_300]),
  spell('Les Ferdinand', 'LEI', 'Leicester', 29, '2003/04', '2003/04', ['https://en.wikipedia.org/wiki/Les_Ferdinand', MFF_300]),
  spell('Les Ferdinand', 'BOL', 'Bolton', 12, '2004/05', '2004/05', ['https://en.wikipedia.org/wiki/Les_Ferdinand', MFF_300]),

  // Steve Watson
  spell('Steve Watson', 'NEW', 'Newcastle', 154, '1993/94', '1998/99', ['https://en.wikipedia.org/wiki/Steve_Watson', MFF_300]),
  spell('Steve Watson', 'AVL', 'Aston Villa', 41, '1998/99', '1999/00', ['https://en.wikipedia.org/wiki/Steve_Watson', MFF_300]),
  spell('Steve Watson', 'EVE', 'Everton', 126, '2000/01', '2004/05', ['https://en.wikipedia.org/wiki/Steve_Watson', MFF_300]),
  spell('Steve Watson', 'WBA', 'West Brom', 30, '2005/06', '2005/06', ['https://en.wikipedia.org/wiki/Steve_Watson', MFF_300]),

  // Cesc Fabregas
  spell('Cesc Fabregas', 'ARS', 'Arsenal', 212, '2003/04', '2010/11', ['https://en.wikipedia.org/wiki/Cesc_Fàbregas', MFF_300]),
  spell('Cesc Fabregas', 'CHE', 'Chelsea', 138, '2014/15', '2018/19', ['https://en.wikipedia.org/wiki/Cesc_Fàbregas', MFF_300]),

  // Cesar Azpilicueta
  spell('Cesar Azpilicueta', 'CHE', 'Chelsea', 349, '2012/13', '2022/23', ['https://en.wikipedia.org/wiki/César_Azpilicueta', MFF_300]),

  // Robbie Keane
  spell('Robbie Keane', 'COV', 'Coventry', 31, '1999/00', '1999/00', ['https://en.wikipedia.org/wiki/Robbie_Keane', MFF_300]),
  spell('Robbie Keane', 'LEE', 'Leeds', 46, '2000/01', '2002/03', ['https://en.wikipedia.org/wiki/Robbie_Keane', MFF_300]),
  spell('Robbie Keane', 'TOT', 'Spurs', 238, '2002/03', '2010/11', ['https://en.wikipedia.org/wiki/Robbie_Keane', MFF_300]),
  spell('Robbie Keane', 'LIV', 'Liverpool', 19, '2008/09', '2008/09', ['https://en.wikipedia.org/wiki/Robbie_Keane', MFF_300]),
  spell('Robbie Keane', 'WHU', 'West Ham', 9, '2010/11', '2010/11', ['https://en.wikipedia.org/wiki/Robbie_Keane', MFF_300]),
  spell('Robbie Keane', 'AVL', 'Aston Villa', 6, '2011/12', '2011/12', ['https://en.wikipedia.org/wiki/Robbie_Keane', MFF_300]),

  // Paul Konchesky
  spell('Paul Konchesky', 'CHA', 'Charlton', 2, '1998/99', '1998/99', ['https://en.wikipedia.org/wiki/Paul_Konchesky', MFF_300]),
  spell('Paul Konchesky', 'CHA', 'Charlton', 136, '2000/01', '2004/05', ['https://en.wikipedia.org/wiki/Paul_Konchesky', MFF_300]),
  spell('Paul Konchesky', 'TOT', 'Spurs', 12, '2003/04', '2003/04', ['https://en.wikipedia.org/wiki/Paul_Konchesky', MFF_300]),
  spell('Paul Konchesky', 'WHU', 'West Ham', 59, '2005/06', '2006/07', ['https://en.wikipedia.org/wiki/Paul_Konchesky', MFF_300]),
  spell('Paul Konchesky', 'FUL', 'Fulham', 97, '2007/08', '2010/11', ['https://en.wikipedia.org/wiki/Paul_Konchesky', MFF_300]),
  spell('Paul Konchesky', 'LIV', 'Liverpool', 15, '2010/11', '2010/11', ['https://en.wikipedia.org/wiki/Paul_Konchesky', MFF_300]),
  spell('Paul Konchesky', 'LEI', 'Leicester', 26, '2014/15', '2014/15', ['https://en.wikipedia.org/wiki/Paul_Konchesky', MFF_300]),

  // Robbie Savage
  spell('Robbie Savage', 'LEI', 'Leicester', 172, '1997/98', '2001/02', ['https://en.wikipedia.org/wiki/Robbie_Savage', MFF_300]),
  spell('Robbie Savage', 'BIR', 'Birmingham', 82, '2002/03', '2004/05', ['https://en.wikipedia.org/wiki/Robbie_Savage', MFF_300]),
  spell('Robbie Savage', 'BLA', 'Blackburn', 76, '2004/05', '2007/08', ['https://en.wikipedia.org/wiki/Robbie_Savage', MFF_300]),
  spell('Robbie Savage', 'DER', 'Derby', 16, '2007/08', '2007/08', ['https://en.wikipedia.org/wiki/Robbie_Savage', MFF_300]),

  // Shane Long
  spell('Shane Long', 'REA', 'Reading', 50, '2006/07', '2007/08', ['https://en.wikipedia.org/wiki/Shane_Long', MFF_300]),
  spell('Shane Long', 'WBA', 'West Brom', 81, '2011/12', '2013/14', ['https://en.wikipedia.org/wiki/Shane_Long', MFF_300]),
  spell('Shane Long', 'HUL', 'Hull', 15, '2013/14', '2014/15', ['https://en.wikipedia.org/wiki/Shane_Long', MFF_300]),
  spell('Shane Long', 'SOU', 'Southampton', 198, '2014/15', '2021/22', ['https://en.wikipedia.org/wiki/Shane_Long', MFF_300]),

  // Nick Barmby
  spell('Nick Barmby', 'TOT', 'Spurs', 87, '1992/93', '1994/95', ['https://en.wikipedia.org/wiki/Nick_Barmby', MFF_300]),
  spell('Nick Barmby', 'MID', 'Middlesbrough', 42, '1995/96', '1996/97', ['https://en.wikipedia.org/wiki/Nick_Barmby', MFF_300]),
  spell('Nick Barmby', 'EVE', 'Everton', 116, '1996/97', '1999/00', ['https://en.wikipedia.org/wiki/Nick_Barmby', MFF_300]),
  spell('Nick Barmby', 'LIV', 'Liverpool', 32, '2000/01', '2001/02', ['https://en.wikipedia.org/wiki/Nick_Barmby', MFF_300]),
  spell('Nick Barmby', 'LEE', 'Leeds', 25, '2002/03', '2003/04', ['https://en.wikipedia.org/wiki/Nick_Barmby', MFF_300]),
  spell('Nick Barmby', 'HUL', 'Hull', 41, '2008/09', '2009/10', ['https://en.wikipedia.org/wiki/Nick_Barmby', MFF_300]),

  // Jamie Vardy
  spell('Jamie Vardy', 'LEI', 'Leicester', 307, '2014/15', '2022/23', ['https://en.wikipedia.org/wiki/Jamie_Vardy', MFF_300]),
  spell('Jamie Vardy', 'LEI', 'Leicester', 35, '2024/25', '2024/25', ['https://en.wikipedia.org/wiki/Jamie_Vardy', MFF_300]),

  // Tim Sherwood
  spell('Tim Sherwood', 'BLA', 'Blackburn', 235, '1992/93', '1998/99', ['https://en.wikipedia.org/wiki/Tim_Sherwood', MFF_300]),
  spell('Tim Sherwood', 'TOT', 'Spurs', 93, '1998/99', '2002/03', ['https://en.wikipedia.org/wiki/Tim_Sherwood', MFF_300]),
  spell('Tim Sherwood', 'POR', 'Portsmouth', 13, '2003/04', '2003/04', ['https://en.wikipedia.org/wiki/Tim_Sherwood', MFF_300]),

  // Darren Fletcher
  spell('Darren Fletcher', 'MUN', 'Man United', 223, '2002/03', '2014/15', ['https://en.wikipedia.org/wiki/Darren_Fletcher', MFF_300]),
  spell('Darren Fletcher', 'WBA', 'West Brom', 91, '2014/15', '2016/17', ['https://en.wikipedia.org/wiki/Darren_Fletcher', MFF_300]),
  spell('Darren Fletcher', 'STK', 'Stoke', 27, '2017/18', '2017/18', ['https://en.wikipedia.org/wiki/Darren_Fletcher', MFF_300]),

  // Joe Hart
  spell('Joe Hart', 'MCI', 'Man City', 50, '2006/07', '2008/09', ['https://en.wikipedia.org/wiki/Joe_Hart', MFF_300]),
  spell('Joe Hart', 'MCI', 'Man City', 216, '2010/11', '2016/17', ['https://en.wikipedia.org/wiki/Joe_Hart', MFF_300]),
  spell('Joe Hart', 'BIR', 'Birmingham', 36, '2009/10', '2009/10', ['https://en.wikipedia.org/wiki/Joe_Hart', MFF_300]),
  spell('Joe Hart', 'WHU', 'West Ham', 19, '2017/18', '2017/18', ['https://en.wikipedia.org/wiki/Joe_Hart', MFF_300]),
  spell('Joe Hart', 'BUR', 'Burnley', 19, '2018/19', '2019/20', ['https://en.wikipedia.org/wiki/Joe_Hart', MFF_300]),

  // Steed Malbranque
  spell('Steed Malbranque', 'FUL', 'Fulham', 172, '2001/02', '2005/06', ['https://en.wikipedia.org/wiki/Steed_Malbranque', MFF_300]),
  spell('Steed Malbranque', 'TOT', 'Spurs', 62, '2006/07', '2007/08', ['https://en.wikipedia.org/wiki/Steed_Malbranque', MFF_300]),
  spell('Steed Malbranque', 'SUN', 'Sunderland', 102, '2008/09', '2010/11', ['https://en.wikipedia.org/wiki/Steed_Malbranque', MFF_300]),

  // Kenny Cunningham
  spell('Kenny Cunningham', 'WIM', 'Wimbledon', 201, '1994/95', '1999/00', ['https://en.wikipedia.org/wiki/Kenny_Cunningham', MFF_300]),
  spell('Kenny Cunningham', 'BIR', 'Birmingham', 134, '2002/03', '2005/06', ['https://en.wikipedia.org/wiki/Kenny_Cunningham', MFF_300]),

  // Son Heung-min
  spell('Son Heung-min', 'TOT', 'Spurs', 333, '2015/16', '2024/25', ['https://en.wikipedia.org/wiki/Son_Heung-min', MFF_300]),

  // James Beattie
  spell('James Beattie', 'BLA', 'Blackburn', 4, '1996/97', '1997/98', ['https://en.wikipedia.org/wiki/James_Beattie_(footballer)', MFF_300]),
  spell('James Beattie', 'SOU', 'Southampton', 204, '1998/99', '2004/05', ['https://en.wikipedia.org/wiki/James_Beattie_(footballer)', MFF_300]),
  spell('James Beattie', 'EVE', 'Everton', 76, '2004/05', '2006/07', ['https://en.wikipedia.org/wiki/James_Beattie_(footballer)', MFF_300]),
  spell('James Beattie', 'STK', 'Stoke', 38, '2008/09', '2009/10', ['https://en.wikipedia.org/wiki/James_Beattie_(footballer)', MFF_300]),
  spell('James Beattie', 'BLP', 'Blackpool', 9, '2010/11', '2010/11', ['https://en.wikipedia.org/wiki/James_Beattie_(footballer)', MFF_300]),

  // Jason Dodd
  spell('Jason Dodd', 'SOU', 'Southampton', 329, '1992/93', '2004/05', ['https://en.wikipedia.org/wiki/Jason_Dodd', MFF_300]),

  // Denis Irwin
  spell('Denis Irwin', 'MUN', 'Man United', 296, '1992/93', '2001/02', ['https://en.wikipedia.org/wiki/Denis_Irwin', MFF_300]),
  spell('Denis Irwin', 'WOL', 'Wolves', 32, '2003/04', '2003/04', ['https://en.wikipedia.org/wiki/Denis_Irwin', MFF_300]),

  // Graeme Le Saux
  spell('Graeme Le Saux', 'CHE', 'Chelsea', 14, '1992/93', '1992/93', ['https://en.wikipedia.org/wiki/Graeme_Le_Saux', MFF_300]),
  spell('Graeme Le Saux', 'CHE', 'Chelsea', 140, '1997/98', '2002/03', ['https://en.wikipedia.org/wiki/Graeme_Le_Saux', MFF_300]),
  spell('Graeme Le Saux', 'BLA', 'Blackburn', 129, '1992/93', '1996/97', ['https://en.wikipedia.org/wiki/Graeme_Le_Saux', MFF_300]),
  spell('Graeme Le Saux', 'SOU', 'Southampton', 44, '2003/04', '2004/05', ['https://en.wikipedia.org/wiki/Graeme_Le_Saux', MFF_300]),

  // Michael Owen
  spell('Michael Owen', 'LIV', 'Liverpool', 216, '1996/97', '2003/04', ['https://en.wikipedia.org/wiki/Michael_Owen', MFF_300]),
  spell('Michael Owen', 'NEW', 'Newcastle', 71, '2005/06', '2008/09', ['https://en.wikipedia.org/wiki/Michael_Owen', MFF_300]),
  spell('Michael Owen', 'MUN', 'Man United', 31, '2009/10', '2011/12', ['https://en.wikipedia.org/wiki/Michael_Owen', MFF_300]),
  spell('Michael Owen', 'STK', 'Stoke', 8, '2012/13', '2012/13', ['https://en.wikipedia.org/wiki/Michael_Owen', MFF_300]),

  // Gael Clichy
  spell('Gael Clichy', 'ARS', 'Arsenal', 187, '2003/04', '2010/11', ['https://en.wikipedia.org/wiki/Gaël_Clichy', MFF_300]),
  spell('Gael Clichy', 'MCI', 'Man City', 138, '2011/12', '2016/17', ['https://en.wikipedia.org/wiki/Gaël_Clichy', MFF_300]),

  // Martin Keown
  spell('Martin Keown', 'EVE', 'Everton', 13, '1992/93', '1992/93', ['https://en.wikipedia.org/wiki/Martin_Keown', MFF_300]),
  spell('Martin Keown', 'ARS', 'Arsenal', 310, '1992/93', '2003/04', ['https://en.wikipedia.org/wiki/Martin_Keown', MFF_300]),

  // Gabriel Agbonlahor
  spell('Gabriel Agbonlahor', 'AVL', 'Aston Villa', 322, '2005/06', '2015/16', ['https://en.wikipedia.org/wiki/Gabriel_Agbonlahor', MFF_300]),

  // William Gallas
  spell('William Gallas', 'CHE', 'Chelsea', 159, '2001/02', '2005/06', ['https://en.wikipedia.org/wiki/William_Gallas', MFF_300]),
  spell('William Gallas', 'ARS', 'Arsenal', 101, '2006/07', '2009/10', ['https://en.wikipedia.org/wiki/William_Gallas', MFF_300]),
  spell('William Gallas', 'TOT', 'Spurs', 61, '2010/11', '2012/13', ['https://en.wikipedia.org/wiki/William_Gallas', MFF_300]),

  // John Arne Riise
  spell('John Arne Riise', 'LIV', 'Liverpool', 234, '2001/02', '2007/08', ['https://en.wikipedia.org/wiki/John_Arne_Riise', MFF_300]),
  spell('John Arne Riise', 'FUL', 'Fulham', 87, '2011/12', '2013/14', ['https://en.wikipedia.org/wiki/John_Arne_Riise', MFF_300]),

  // Harry Kane
  spell('Harry Kane', 'TOT', 'Spurs', 317, '2010/11', '2022/23', ['https://en.wikipedia.org/wiki/Harry_Kane', MFF_300]),
  spell('Harry Kane', 'NOR', 'Norwich', 3, '2012/13', '2012/13', ['https://en.wikipedia.org/wiki/Harry_Kane', MFF_300]),

  // Darren Anderton
  spell('Darren Anderton', 'TOT', 'Spurs', 299, '1992/93', '2003/04', ['https://en.wikipedia.org/wiki/Darren_Anderton', MFF_300]),
  spell('Darren Anderton', 'BIR', 'Birmingham', 20, '2004/05', '2004/05', ['https://en.wikipedia.org/wiki/Darren_Anderton', MFF_300]),

  // Gylfi Sigurðsson
  spell('Gylfi Sigurðsson', 'SWA', 'Swansea', 18, '2011/12', '2011/12', ['https://en.wikipedia.org/wiki/Gylfi_Sigurðsson', MFF_300]),
  spell('Gylfi Sigurðsson', 'SWA', 'Swansea', 106, '2014/15', '2016/17', ['https://en.wikipedia.org/wiki/Gylfi_Sigurðsson', MFF_300]),
  spell('Gylfi Sigurðsson', 'TOT', 'Spurs', 58, '2012/13', '2013/14', ['https://en.wikipedia.org/wiki/Gylfi_Sigurðsson', MFF_300]),
  spell('Gylfi Sigurðsson', 'EVE', 'Everton', 136, '2017/18', '2021/22', ['https://en.wikipedia.org/wiki/Gylfi_Sigurðsson', MFF_300]),

  // Sami Hyypia
  spell('Sami Hyypia', 'LIV', 'Liverpool', 318, '1999/00', '2008/09', ['https://en.wikipedia.org/wiki/Sami_Hyypiä', MFF_300]),

  // Ryan Shawcross
  spell('Ryan Shawcross', 'STK', 'Stoke', 317, '2008/09', '2017/18', ['https://en.wikipedia.org/wiki/Ryan_Shawcross', MFF_300]),

  // Shaun Wright-Phillips
  spell('Shaun Wright-Phillips', 'MCI', 'Man City', 15, '2000/01', '2000/01', ['https://en.wikipedia.org/wiki/Shaun_Wright-Phillips', MFF_300]),
  spell('Shaun Wright-Phillips', 'MCI', 'Man City', 99, '2002/03', '2004/05', ['https://en.wikipedia.org/wiki/Shaun_Wright-Phillips', MFF_300]),
  spell('Shaun Wright-Phillips', 'MCI', 'Man City', 64, '2008/09', '2011/12', ['https://en.wikipedia.org/wiki/Shaun_Wright-Phillips', MFF_300]),
  spell('Shaun Wright-Phillips', 'CHE', 'Chelsea', 82, '2005/06', '2008/09', ['https://en.wikipedia.org/wiki/Shaun_Wright-Phillips', MFF_300]),
  spell('Shaun Wright-Phillips', 'QPR', 'QPR', 52, '2011/12', '2012/13', ['https://en.wikipedia.org/wiki/Shaun_Wright-Phillips', MFF_300]),
  spell('Shaun Wright-Phillips', 'QPR', 'QPR', 4, '2014/15', '2014/15', ['https://en.wikipedia.org/wiki/Shaun_Wright-Phillips', MFF_300]),

  // Edwin van der Sar
  spell('Edwin van der Sar', 'FUL', 'Fulham', 127, '2001/02', '2004/05', ['https://en.wikipedia.org/wiki/Edwin_van_der_Sar', MFF_300]),
  spell('Edwin van der Sar', 'MUN', 'Man United', 186, '2005/06', '2010/11', ['https://en.wikipedia.org/wiki/Edwin_van_der_Sar', MFF_300]),

  // Aaron Cresswell
  spell('Aaron Cresswell', 'WHU', 'West Ham', 312, '2014/15', '2024/25', ['https://en.wikipedia.org/wiki/Aaron_Cresswell', MFF_300]),

  // Dion Dublin
  spell('Dion Dublin', 'MUN', 'Man United', 12, '1992/93', '1993/94', ['https://en.wikipedia.org/wiki/Dion_Dublin', MFF_300]),
  spell('Dion Dublin', 'COV', 'Coventry', 145, '1994/95', '1998/99', ['https://en.wikipedia.org/wiki/Dion_Dublin', MFF_300]),
  spell('Dion Dublin', 'AVL', 'Aston Villa', 155, '1998/99', '2003/04', ['https://en.wikipedia.org/wiki/Dion_Dublin', MFF_300]),

  // Ian Walker
  spell('Ian Walker', 'TOT', 'Spurs', 240, '1992/93', '2000/01', ['https://en.wikipedia.org/wiki/Ian_Walker_(footballer)', MFF_300]),
  spell('Ian Walker', 'LEI', 'Leicester', 35, '2001/02', '2001/02', ['https://en.wikipedia.org/wiki/Ian_Walker_(footballer)', MFF_300]),
  spell('Ian Walker', 'LEI', 'Leicester', 37, '2003/04', '2003/04', ['https://en.wikipedia.org/wiki/Ian_Walker_(footballer)', MFF_300]),

  // Christian Eriksen
  spell('Christian Eriksen', 'TOT', 'Spurs', 226, '2013/14', '2019/20', ['https://en.wikipedia.org/wiki/Christian_Eriksen', MFF_300]),
  spell('Christian Eriksen', 'BRE', 'Brentford', 11, '2021/22', '2021/22', ['https://en.wikipedia.org/wiki/Christian_Eriksen', MFF_300]),
  spell('Christian Eriksen', 'MUN', 'Man United', 73, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Christian_Eriksen', MFF_300]),

  // Peter Schmeichel
  spell('Peter Schmeichel', 'MUN', 'Man United', 252, '1992/93', '1998/99', ['https://en.wikipedia.org/wiki/Peter_Schmeichel', MFF_300]),
  spell('Peter Schmeichel', 'AVL', 'Aston Villa', 29, '2001/02', '2001/02', ['https://en.wikipedia.org/wiki/Peter_Schmeichel', MFF_300]),
  spell('Peter Schmeichel', 'MCI', 'Man City', 29, '2002/03', '2002/03', ['https://en.wikipedia.org/wiki/Peter_Schmeichel', MFF_300]),

  // Joel Ward
  spell('Joel Ward', 'POR', 'Portsmouth', 3, '2009/10', '2009/10', ['https://en.wikipedia.org/wiki/Joel_Ward_(footballer)', MFF_300]),
  spell('Joel Ward', 'CRY', 'Palace', 306, '2013/14', '2024/25', ['https://en.wikipedia.org/wiki/Joel_Ward_(footballer)', MFF_300]),

  // Wes Brown
  spell('Wes Brown', 'MUN', 'Man United', 232, '1997/98', '2010/11', ['https://en.wikipedia.org/wiki/Wes_Brown', MFF_300]),
  spell('Wes Brown', 'SUN', 'Sunderland', 76, '2011/12', '2015/16', ['https://en.wikipedia.org/wiki/Wes_Brown', MFF_300]),

  // Paul Ince
  spell('Paul Ince', 'MUN', 'Man United', 116, '1992/93', '1994/95', ['https://en.wikipedia.org/wiki/Paul_Ince', MFF_300]),
  spell('Paul Ince', 'LIV', 'Liverpool', 65, '1997/98', '1998/99', ['https://en.wikipedia.org/wiki/Paul_Ince', MFF_300]),
  spell('Paul Ince', 'MID', 'Middlesbrough', 93, '1999/00', '2001/02', ['https://en.wikipedia.org/wiki/Paul_Ince', MFF_300]),
  spell('Paul Ince', 'WOL', 'Wolves', 32, '2003/04', '2003/04', ['https://en.wikipedia.org/wiki/Paul_Ince', MFF_300]),

  // Steven Davis
  spell('Steven Davis', 'AVL', 'Aston Villa', 91, '2004/05', '2006/07', ['https://en.wikipedia.org/wiki/Steven_Davis', MFF_300]),
  spell('Steven Davis', 'FUL', 'Fulham', 22, '2007/08', '2007/08', ['https://en.wikipedia.org/wiki/Steven_Davis', MFF_300]),
  spell('Steven Davis', 'SOU', 'Southampton', 193, '2012/13', '2018/19', ['https://en.wikipedia.org/wiki/Steven_Davis', MFF_300]),

  // Adam Lallana
  spell('Adam Lallana', 'SOU', 'Southampton', 68, '2012/13', '2013/14', ['https://en.wikipedia.org/wiki/Adam_Lallana', MFF_300]),
  spell('Adam Lallana', 'SOU', 'Southampton', 14, '2024/25', '2024/25', ['https://en.wikipedia.org/wiki/Adam_Lallana', MFF_300]),
  spell('Adam Lallana', 'LIV', 'Liverpool', 128, '2014/15', '2019/20', ['https://en.wikipedia.org/wiki/Adam_Lallana', MFF_300]),
  spell('Adam Lallana', 'BHA', 'Brighton', 95, '2020/21', '2023/24', ['https://en.wikipedia.org/wiki/Adam_Lallana', MFF_300]),

  // Jordan Ayew
  spell('Jordan Ayew', 'AVL', 'Aston Villa', 30, '2015/16', '2015/16', ['https://en.wikipedia.org/wiki/Jordan_Ayew', MFF_300]),
  spell('Jordan Ayew', 'SWA', 'Swansea', 50, '2016/17', '2017/18', ['https://en.wikipedia.org/wiki/Jordan_Ayew', MFF_300]),
  spell('Jordan Ayew', 'CRY', 'Palace', 195, '2018/19', '2024/25', ['https://en.wikipedia.org/wiki/Jordan_Ayew', MFF_300]),
  spell('Jordan Ayew', 'LEI', 'Leicester', 30, '2024/25', '2024/25', ['https://en.wikipedia.org/wiki/Jordan_Ayew', MFF_300]),

  // Lee Dixon
  spell('Lee Dixon', 'ARS', 'Arsenal', 305, '1992/93', '2001/02', ['https://en.wikipedia.org/wiki/Lee_Dixon', MFF_300]),

  // Jack Cork
  spell('Jack Cork', 'BUR', 'Burnley', 11, '2009/10', '2009/10', ['https://en.wikipedia.org/wiki/Jack_Cork', MFF_300]),
  spell('Jack Cork', 'BUR', 'Burnley', 141, '2017/18', '2021/22', ['https://en.wikipedia.org/wiki/Jack_Cork', MFF_300]),
  spell('Jack Cork', 'BUR', 'Burnley', 4, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Jack_Cork', MFF_300]),
  spell('Jack Cork', 'SOU', 'Southampton', 68, '2012/13', '2014/15', ['https://en.wikipedia.org/wiki/Jack_Cork', MFF_300]),
  spell('Jack Cork', 'SWA', 'Swansea', 80, '2014/15', '2016/17', ['https://en.wikipedia.org/wiki/Jack_Cork', MFF_300]),

  // Craig Dawson
  spell('Craig Dawson', 'WBA', 'West Brom', 153, '2011/12', '2017/18', ['https://en.wikipedia.org/wiki/Craig_Dawson', MFF_300]),
  spell('Craig Dawson', 'WAT', 'Watford', 29, '2019/20', '2019/20', ['https://en.wikipedia.org/wiki/Craig_Dawson', MFF_300]),
  spell('Craig Dawson', 'WHU', 'West Ham', 64, '2020/21', '2022/23', ['https://en.wikipedia.org/wiki/Craig_Dawson', MFF_300]),
  spell('Craig Dawson', 'WOL', 'Wolves', 57, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Craig_Dawson', MFF_300]),

  // Phil Bardsley
  spell('Phil Bardsley', 'MUN', 'Man United', 8, '2003/04', '2007/08', ['https://en.wikipedia.org/wiki/Phil_Bardsley', MFF_300]),
  spell('Phil Bardsley', 'AVL', 'Aston Villa', 13, '2006/07', '2006/07', ['https://en.wikipedia.org/wiki/Phil_Bardsley', MFF_300]),
  spell('Phil Bardsley', 'SUN', 'Sunderland', 174, '2007/08', '2013/14', ['https://en.wikipedia.org/wiki/Phil_Bardsley', MFF_300]),
  spell('Phil Bardsley', 'STK', 'Stoke', 51, '2014/15', '2016/17', ['https://en.wikipedia.org/wiki/Phil_Bardsley', MFF_300]),
  spell('Phil Bardsley', 'BUR', 'Burnley', 57, '2017/18', '2021/22', ['https://en.wikipedia.org/wiki/Phil_Bardsley', MFF_300]),

  // Gavin McCann
  spell('Gavin McCann', 'EVE', 'Everton', 11, '1997/98', '1997/98', ['https://en.wikipedia.org/wiki/Gavin_McCann', MFF_300]),
  spell('Gavin McCann', 'SUN', 'Sunderland', 105, '1999/00', '2002/03', ['https://en.wikipedia.org/wiki/Gavin_McCann', MFF_300]),
  spell('Gavin McCann', 'AVL', 'Aston Villa', 110, '2003/04', '2006/07', ['https://en.wikipedia.org/wiki/Gavin_McCann', MFF_300]),
  spell('Gavin McCann', 'BOL', 'Bolton', 75, '2007/08', '2009/10', ['https://en.wikipedia.org/wiki/Gavin_McCann', MFF_300]),

  // Abou Diaby
  spell('Abou Diaby', 'ARS', 'Arsenal', 124, '2005/06', '2014/15', ['https://en.wikipedia.org/wiki/Abou_Diaby', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Aleksandar Kolarov
  spell('Aleksandar Kolarov', 'MCI', 'Man City', 165, '2010/11', '2016/17', ['https://en.wikipedia.org/wiki/Aleksandar_Kolarov', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Alex Oxlade-Chamberlain
  spell('Alex Oxlade-Chamberlain', 'ARS', 'Arsenal', 132, '2011/12', '2017/18', ['https://en.wikipedia.org/wiki/Alex_Oxlade-Chamberlain', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),
  spell('Alex Oxlade-Chamberlain', 'LIV', 'Liverpool', 103, '2017/18', '2022/23', ['https://en.wikipedia.org/wiki/Alex_Oxlade-Chamberlain', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Alireza Jahanbakhsh
  spell('Alireza Jahanbakhsh', 'BHA', 'Brighton', 50, '2018/19', '2020/21', ['https://en.wikipedia.org/wiki/Alireza_Jahanbakhsh', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Allan Saint-Maximin
  spell('Allan Saint-Maximin', 'NEW', 'Newcastle', 111, '2019/20', '2022/23', ['https://en.wikipedia.org/wiki/Allan_Saint-Maximin', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Ameen Al Dakhil
  spell('Ameen Al Dakhil', 'BUR', 'Burnley', 13, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Ameen_Al-Dakhil', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Ander Herrera
  spell('Ander Herrera', 'MUN', 'Man United', 132, '2014/15', '2018/19', ['https://en.wikipedia.org/wiki/Ander_Herrera', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Andreas Weimann
  spell('Andreas Weimann', 'AVL', 'Aston Villa', 113, '2010/11', '2014/15', ['https://en.wikipedia.org/wiki/Andreas_Weimann', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/']),

  // Andi Zeqiri
  spell('Andi Zeqiri', 'BHA', 'Brighton', 9, '2020/21', '2021/22', ['https://en.wikipedia.org/wiki/Andi_Zeqiri', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Andreas Christensen
  spell('Andreas Christensen', 'CHE', 'Chelsea', 1, '2014/15', '2014/15', ['https://en.wikipedia.org/wiki/Andreas_Christensen', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),
  spell('Andreas Christensen', 'CHE', 'Chelsea', 92, '2017/18', '2021/22', ['https://en.wikipedia.org/wiki/Andreas_Christensen', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Andre Gomes
  spell('Andre Gomes', 'EVE', 'Everton', 88, '2018/19', '2021/22', ['https://en.wikipedia.org/wiki/Andr%C3%A9_Gomes', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/everton/everton-fc-premier-league-appearances/']),
  spell('Andre Gomes', 'EVE', 'Everton', 12, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Andr%C3%A9_Gomes', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/everton/everton-fc-premier-league-appearances/']),

  // Andre-Frank Zambo Anguissa
  spell('Andre-Frank Zambo Anguissa', 'FUL', 'Fulham', 22, '2018/19', '2018/19', ['https://en.wikipedia.org/wiki/Frank_Anguissa', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),
  spell('Andre-Frank Zambo Anguissa', 'FUL', 'Fulham', 36, '2020/21', '2020/21', ['https://en.wikipedia.org/wiki/Frank_Anguissa', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),

  // Andy Hill
  spell('Andy Hill', 'MCI', 'Man City', 54, '1992/93', '1994/95', ['https://en.wikipedia.org/wiki/Andy_Hill_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Andy Keogh
  spell('Andy Keogh', 'WOL', 'Wolves', 14, '2009/10', '2011/12', ['https://en.wikipedia.org/wiki/Andy_Keogh', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Andy Linighan
  spell('Andy Linighan', 'ARS', 'Arsenal', 91, '1992/93', '1996/97', ['https://en.wikipedia.org/wiki/Andy_Linighan', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),
  spell('Andy Linighan', 'CRY', 'Palace', 26, '1997/98', '1997/98', ['https://en.wikipedia.org/wiki/Andy_Linighan', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Ansu Fati
  spell('Ansu Fati', 'BHA', 'Brighton', 19, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Ansu_Fati', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Anthony Martial
  spell('Anthony Martial', 'MUN', 'Man United', 209, '2015/16', '2023/24', ['https://en.wikipedia.org/wiki/Anthony_Martial', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Antonio Rudiger
  spell('Antonio Rudiger', 'CHE', 'Chelsea', 133, '2017/18', '2021/22', ['https://en.wikipedia.org/wiki/Antonio_R%C3%BCdiger', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Arjen Robben
  spell('Arjen Robben', 'CHE', 'Chelsea', 67, '2004/05', '2006/07', ['https://en.wikipedia.org/wiki/Arjen_Robben', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Aymeric Laporte
  spell('Aymeric Laporte', 'MCI', 'Man City', 121, '2017/18', '2023/24', ['https://en.wikipedia.org/wiki/Aymeric_Laporte', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Baily Cargill
  spell('Baily Cargill', 'BOU', 'Bournemouth', 1, '2015/16', '2016/17', ['https://en.wikipedia.org/wiki/Baily_Cargill', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Bacary Sagna
  spell('Bacary Sagna', 'ARS', 'Arsenal', 213, '2007/08', '2013/14', ['https://en.wikipedia.org/wiki/Bacary_Sagna', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),
  spell('Bacary Sagna', 'MCI', 'Man City', 54, '2014/15', '2016/17', ['https://en.wikipedia.org/wiki/Bacary_Sagna', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Bakary Sako
  spell('Bakary Sako', 'CRY', 'Palace', 47, '2015/16', '2018/19', ['https://en.wikipedia.org/wiki/Bakary_Sako', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Barry Hayles
  spell('Barry Hayles', 'FUL', 'Fulham', 75, '2001/02', '2003/04', ['https://en.wikipedia.org/wiki/Barry_Hayles', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),

  // Benicio Baker-Boaitey
  spell('Benicio Baker-Boaitey', 'BHA', 'Brighton', 5, '2023/24', '2024/25', ['https://en.wikipedia.org/wiki/Benicio_Baker-Boaitey', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Benoit Assou-Ekotto
  spell('Benoit Assou-Ekotto', 'TOT', 'Spurs', 155, '2006/07', '2012/13', ['https://en.wikipedia.org/wiki/Beno%C3%AEt_Assou-Ekotto', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/']),

  // Bruce Dyer
  spell('Bruce Dyer', 'CRY', 'Palace', 16, '1994/95', '1994/95', ['https://en.wikipedia.org/wiki/Bruce_Dyer', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),
  spell('Bruce Dyer', 'CRY', 'Palace', 24, '1997/98', '1997/98', ['https://en.wikipedia.org/wiki/Bruce_Dyer', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Bruno Ribeiro
  spell('Bruno Ribeiro', 'LEE', 'Leeds', 42, '1997/98', '1998/99', ['https://en.wikipedia.org/wiki/Bruno_Ribeiro', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Bruno Saltor
  spell('Bruno Saltor', 'BHA', 'Brighton', 39, '2017/18', '2018/19', ['https://en.wikipedia.org/wiki/Bruno_Saltor', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Cameron Peupion
  spell('Cameron Peupion', 'BHA', 'Brighton', 1, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Cameron_Peupion', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Charlie Goode
  spell('Charlie Goode', 'BRE', 'Brentford', 6, '2021/22', '2023/24', ['https://en.wikipedia.org/wiki/Charlie_Goode', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Chris Iwelumo
  spell('Chris Iwelumo', 'WOL', 'Wolves', 15, '2009/10', '2009/10', ['https://en.wikipedia.org/wiki/Chris_Iwelumo', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Chris Mepham
  spell('Chris Mepham', 'BOU', 'Bournemouth', 25, '2018/19', '2019/20', ['https://en.wikipedia.org/wiki/Chris_Mepham', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),
  spell('Chris Mepham', 'BOU', 'Bournemouth', 36, '2022/23', '2023/24', ['https://en.wikipedia.org/wiki/Chris_Mepham', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Christian Pulisic
  spell('Christian Pulisic', 'CHE', 'Chelsea', 98, '2019/20', '2022/23', ['https://en.wikipedia.org/wiki/Christian_Pulisic', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Christophe Berra
  spell('Christophe Berra', 'WOL', 'Wolves', 96, '2009/10', '2011/12', ['https://en.wikipedia.org/wiki/Christophe_Berra', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Ciaran Clark
  spell('Ciaran Clark', 'AVL', 'Aston Villa', 134, '2008/09', '2015/16', ['https://en.wikipedia.org/wiki/Ciaran_Clark', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),
  spell('Ciaran Clark', 'NEW', 'Newcastle', 80, '2017/18', '2021/22', ['https://en.wikipedia.org/wiki/Ciaran_Clark', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Claude Makelele
  spell('Claude Makelele', 'CHE', 'Chelsea', 144, '2003/04', '2007/08', ['https://en.wikipedia.org/wiki/Claude_Mak%C3%A9l%C3%A9l%C3%A9', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Collins John
  spell('Collins John', 'FUL', 'Fulham', 95, '2003/04', '2007/08', ['https://en.wikipedia.org/wiki/Collins_John', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),

  // Connor Goldson
  spell('Connor Goldson', 'BHA', 'Brighton', 3, '2017/18', '2017/18', ['https://en.wikipedia.org/wiki/Connor_Goldson', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Cristiano Ronaldo
  spell('Cristiano Ronaldo', 'MUN', 'Man United', 196, '2003/04', '2008/09', ['https://en.wikipedia.org/wiki/Cristiano_Ronaldo', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),
  spell('Cristiano Ronaldo', 'MUN', 'Man United', 40, '2021/22', '2022/23', ['https://en.wikipedia.org/wiki/Cristiano_Ronaldo', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Dale Stephens
  spell('Dale Stephens', 'BHA', 'Brighton', 99, '2017/18', '2020/21', ['https://en.wikipedia.org/wiki/Dale_Stephens_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),
  spell('Dale Stephens', 'BUR', 'Burnley', 10, '2020/21', '2021/22', ['https://en.wikipedia.org/wiki/Dale_Stephens_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Daley Blind
  spell('Daley Blind', 'MUN', 'Man United', 90, '2014/15', '2017/18', ['https://en.wikipedia.org/wiki/Daley_Blind', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Dalian Atkinson
  spell('Dalian Atkinson', 'AVL', 'Aston Villa', 73, '1992/93', '1994/95', ['https://en.wikipedia.org/wiki/Dalian_Atkinson', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/']),

  // Daniel Agger
  spell('Daniel Agger', 'LIV', 'Liverpool', 175, '2005/06', '2013/14', ['https://en.wikipedia.org/wiki/Daniel_Agger', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Daniel Podence
  spell('Daniel Podence', 'WOL', 'Wolves', 91, '2019/20', '2022/23', ['https://en.wikipedia.org/wiki/Daniel_Podence', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),
  spell('Daniel Podence', 'WOL', 'Wolves', 2, '2024/25', '2024/25', ['https://en.wikipedia.org/wiki/Daniel_Podence', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Danny Cadamarteri
  spell('Danny Cadamarteri', 'EVE', 'Everton', 93, '1996/97', '2001/02', ['https://en.wikipedia.org/wiki/Danny_Cadamarteri', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/everton/everton-fc-premier-league-appearances/']),

  // Danny Tiatto
  spell('Danny Tiatto', 'MCI', 'Man City', 33, '2000/01', '2000/01', ['https://en.wikipedia.org/wiki/Danny_Tiatto', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),
  spell('Danny Tiatto', 'MCI', 'Man City', 18, '2002/03', '2003/04', ['https://en.wikipedia.org/wiki/Danny_Tiatto', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Darius Vassell
  spell('Darius Vassell', 'AVL', 'Aston Villa', 162, '1997/98', '2004/05', ['https://en.wikipedia.org/wiki/Darius_Vassell', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),
  spell('Darius Vassell', 'MCI', 'Man City', 103, '2005/06', '2008/09', ['https://en.wikipedia.org/wiki/Darius_Vassell', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Darwin Nunez
  spell('Darwin Nunez', 'LIV', 'Liverpool', 95, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Darwin_N%C3%BA%C3%B1ez', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // David Beckham
  spell('David Beckham', 'MUN', 'Man United', 265, '1992/93', '2002/03', ['https://en.wikipedia.org/wiki/David_Beckham', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // David Stockdale
  spell('David Stockdale', 'FUL', 'Fulham', 39, '2008/09', '2013/14', ['https://en.wikipedia.org/wiki/David_Stockdale', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),

  // Davinson Sanchez
  spell('Davinson Sanchez', 'TOT', 'Spurs', 143, '2017/18', '2023/24', ['https://en.wikipedia.org/wiki/Davinson_S%C3%A1nchez', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/']),

  // Davy Propper
  spell('Davy Propper', 'BHA', 'Brighton', 107, '2017/18', '2020/21', ['https://en.wikipedia.org/wiki/Davy_Pr%C3%B6pper', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Dean Huijsen
  spell('Dean Huijsen', 'BOU', 'Bournemouth', 32, '2024/25', '2024/25', ['https://en.wikipedia.org/wiki/Dean_Huijsen', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Denis Odoi
  spell('Denis Odoi', 'FUL', 'Fulham', 31, '2018/19', '2018/19', ['https://en.wikipedia.org/wiki/Denis_Odoi', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),
  spell('Denis Odoi', 'FUL', 'Fulham', 3, '2020/21', '2020/21', ['https://en.wikipedia.org/wiki/Denis_Odoi', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),

  // Deniz Undav
  spell('Deniz Undav', 'BHA', 'Brighton', 22, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Deniz_Undav', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Diafra Sakho
  spell('Diafra Sakho', 'WHU', 'West Ham', 62, '2014/15', '2017/18', ['https://en.wikipedia.org/wiki/Diafra_Sakho', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),

  // Didier Drogba
  spell('Didier Drogba', 'CHE', 'Chelsea', 226, '2004/05', '2011/12', ['https://en.wikipedia.org/wiki/Didier_Drogba', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),
  spell('Didier Drogba', 'CHE', 'Chelsea', 28, '2014/15', '2014/15', ['https://en.wikipedia.org/wiki/Didier_Drogba', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Didier Zokora
  spell('Didier Zokora', 'TOT', 'Spurs', 88, '2006/07', '2008/09', ['https://en.wikipedia.org/wiki/Didier_Zokora', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/']),

  // Diego Costa
  spell('Diego Costa', 'CHE', 'Chelsea', 89, '2014/15', '2017/18', ['https://en.wikipedia.org/wiki/Diego_Costa', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),
  spell('Diego Costa', 'WOL', 'Wolves', 23, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Diego_Costa', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Diego Forlan
  spell('Diego Forlan', 'MUN', 'Man United', 63, '2001/02', '2004/05', ['https://en.wikipedia.org/wiki/Diego_Forl%C3%A1n', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Diego Llorente
  spell('Diego Llorente', 'LEE', 'Leeds', 51, '2020/21', '2022/23', ['https://en.wikipedia.org/wiki/Diego_Llorente', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Diego Rico
  spell('Diego Rico', 'BOU', 'Bournemouth', 39, '2018/19', '2019/20', ['https://en.wikipedia.org/wiki/Diego_Rico', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Dimitar Berbatov
  spell('Dimitar Berbatov', 'TOT', 'Spurs', 70, '2006/07', '2008/09', ['https://en.wikipedia.org/wiki/Dimitar_Berbatov', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),
  spell('Dimitar Berbatov', 'MUN', 'Man United', 108, '2008/09', '2012/13', ['https://en.wikipedia.org/wiki/Dimitar_Berbatov', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),
  spell('Dimitar Berbatov', 'FUL', 'Fulham', 51, '2012/13', '2013/14', ['https://en.wikipedia.org/wiki/Dimitar_Berbatov', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Diogo Jota
  spell('Diogo Jota', 'WOL', 'Wolves', 67, '2018/19', '2019/20', ['https://en.wikipedia.org/wiki/Diogo_Jota', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),
  spell('Diogo Jota', 'LIV', 'Liverpool', 123, '2020/21', '2024/25', ['https://en.wikipedia.org/wiki/Diogo_Jota', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Dirk Kuyt
  spell('Dirk Kuyt', 'LIV', 'Liverpool', 208, '2006/07', '2011/12', ['https://en.wikipedia.org/wiki/Dirk_Kuyt', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Divock Origi
  spell('Divock Origi', 'LIV', 'Liverpool', 107, '2015/16', '2021/22', ['https://en.wikipedia.org/wiki/Divock_Origi', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),
  spell('Divock Origi', 'NFO', 'Forest', 20, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Divock_Origi', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Dominic Thompson
  spell('Dominic Thompson', 'BRE', 'Brentford', 2, '2021/22', '2021/22', ['https://en.wikipedia.org/wiki/Dominic_Thompson_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Dougie Freedman
  spell('Dougie Freedman', 'CRY', 'Palace', 7, '1997/98', '1997/98', ['https://en.wikipedia.org/wiki/Dougie_Freedman', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),
  spell('Dougie Freedman', 'CRY', 'Palace', 20, '2004/05', '2004/05', ['https://en.wikipedia.org/wiki/Dougie_Freedman', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),
  spell('Dougie Freedman', 'NFO', 'Forest', 31, '1998/99', '1998/99', ['https://en.wikipedia.org/wiki/Dougie_Freedman', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Dwight Gayle
  spell('Dwight Gayle', 'CRY', 'Palace', 64, '2013/14', '2015/16', ['https://en.wikipedia.org/wiki/Dwight_Gayle', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),
  spell('Dwight Gayle', 'NEW', 'Newcastle', 81, '2017/18', '2021/22', ['https://en.wikipedia.org/wiki/Dwight_Gayle', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Ed de Goey
  spell('Ed de Goey', 'CHE', 'Chelsea', 123, '1997/98', '2002/03', ['https://en.wikipedia.org/wiki/Ed_de_Goey', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Eden Hazard
  spell('Eden Hazard', 'CHE', 'Chelsea', 245, '2012/13', '2018/19', ['https://en.wikipedia.org/wiki/Eden_Hazard', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Edin Dzeko
  spell('Edin Dzeko', 'MCI', 'Man City', 130, '2010/11', '2014/15', ['https://en.wikipedia.org/wiki/Edin_D%C5%BEeko', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Edouard Mendy
  spell('Edouard Mendy', 'CHE', 'Chelsea', 75, '2020/21', '2022/23', ['https://en.wikipedia.org/wiki/%C3%89douard_Mendy', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Elano
  spell('Elano', 'MCI', 'Man City', 62, '2007/08', '2008/09', ['https://en.wikipedia.org/wiki/Elano', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Emre Belozoglu
  spell('Emre Belozoglu', 'NEW', 'Newcastle', 58, '2005/06', '2007/08', ['https://en.wikipedia.org/wiki/Emre_Bel%C3%B6zo%C4%9Flu', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Emre Can
  spell('Emre Can', 'LIV', 'Liverpool', 115, '2014/15', '2017/18', ['https://en.wikipedia.org/wiki/Emre_Can', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Eric Bailly
  spell('Eric Bailly', 'MUN', 'Man United', 70, '2016/17', '2021/22', ['https://en.wikipedia.org/wiki/Eric_Bailly', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Eric Dier
  spell('Eric Dier', 'TOT', 'Spurs', 274, '2014/15', '2023/24', ['https://en.wikipedia.org/wiki/Eric_Dier', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/']),

  // Erland Johnsen
  spell('Erland Johnsen', 'CHE', 'Chelsea', 114, '1992/93', '1996/97', ['https://en.wikipedia.org/wiki/Erland_Johnsen', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Eunan O'Kane
  spell('Eunan O\'Kane', 'BOU', 'Bournemouth', 16, '2015/16', '2015/16', ['https://en.wikipedia.org/wiki/Eunan_O%27Kane', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Ezequiel Schelotto
  spell('Ezequiel Schelotto', 'BHA', 'Brighton', 28, '2017/18', '2019/20', ['https://en.wikipedia.org/wiki/Ezequiel_Schelotto', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Ezgjan Alioski
  spell('Ezgjan Alioski', 'LEE', 'Leeds', 36, '2020/21', '2020/21', ['https://en.wikipedia.org/wiki/Ezgjan_Alioski', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Fabien Barthez
  spell('Fabien Barthez', 'MUN', 'Man United', 92, '2000/01', '2003/04', ['https://en.wikipedia.org/wiki/Fabien_Barthez', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Fabricio Coloccini
  spell('Fabricio Coloccini', 'NEW', 'Newcastle', 34, '2008/09', '2008/09', ['https://en.wikipedia.org/wiki/Fabricio_Coloccini', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),
  spell('Fabricio Coloccini', 'NEW', 'Newcastle', 177, '2010/11', '2015/16', ['https://en.wikipedia.org/wiki/Fabricio_Coloccini', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Fernando Torres
  spell('Fernando Torres', 'LIV', 'Liverpool', 102, '2007/08', '2010/11', ['https://en.wikipedia.org/wiki/Fernando_Torres', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),
  spell('Fernando Torres', 'CHE', 'Chelsea', 110, '2010/11', '2014/15', ['https://en.wikipedia.org/wiki/Fernando_Torres', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Fin Stevens
  spell('Fin Stevens', 'BRE', 'Brentford', 1, '2021/22', '2022/23', ['https://en.wikipedia.org/wiki/Fin_Stevens', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Florent Malouda
  spell('Florent Malouda', 'CHE', 'Chelsea', 149, '2007/08', '2012/13', ['https://en.wikipedia.org/wiki/Florent_Malouda', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Florin Andone
  spell('Florin Andone', 'BHA', 'Brighton', 26, '2018/19', '2022/23', ['https://en.wikipedia.org/wiki/Florin_Andone', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Francis Coquelin
  spell('Francis Coquelin', 'ARS', 'Arsenal', 21, '2011/12', '2012/13', ['https://en.wikipedia.org/wiki/Francis_Coquelin', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),
  spell('Francis Coquelin', 'ARS', 'Arsenal', 84, '2014/15', '2017/18', ['https://en.wikipedia.org/wiki/Francis_Coquelin', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Gabriel Heinze
  spell('Gabriel Heinze', 'MUN', 'Man United', 52, '2004/05', '2006/07', ['https://en.wikipedia.org/wiki/Gabriel_Heinze', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Gareth Bale
  spell('Gareth Bale', 'TOT', 'Spurs', 146, '2007/08', '2012/13', ['https://en.wikipedia.org/wiki/Gareth_Bale', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/']),
  spell('Gareth Bale', 'TOT', 'Spurs', 20, '2020/21', '2020/21', ['https://en.wikipedia.org/wiki/Gareth_Bale', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/']),

  // Gary Bannister
  spell('Gary Bannister', 'NFO', 'Forest', 31, '1992/93', '1992/93', ['https://en.wikipedia.org/wiki/Gary_Bannister', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Gary Naysmith
  spell('Gary Naysmith', 'EVE', 'Everton', 134, '2000/01', '2006/07', ['https://en.wikipedia.org/wiki/Gary_Naysmith', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/everton/everton-fc-premier-league-appearances/']),

  // Gaetan Bong
  spell('Gaetan Bong', 'BHA', 'Brighton', 51, '2017/18', '2019/20', ['https://en.wikipedia.org/wiki/Ga%C3%ABtan_Bong', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // George Elokobi
  spell('George Elokobi', 'WOL', 'Wolves', 58, '2009/10', '2011/12', ['https://en.wikipedia.org/wiki/George_Elokobi', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Gianfranco Zola
  spell('Gianfranco Zola', 'CHE', 'Chelsea', 229, '1996/97', '2002/03', ['https://en.wikipedia.org/wiki/Gianfranco_Zola', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Gilberto Silva
  spell('Gilberto Silva', 'ARS', 'Arsenal', 170, '2002/03', '2007/08', ['https://en.wikipedia.org/wiki/Gilberto_Silva', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Glenn Murray
  spell('Glenn Murray', 'CRY', 'Palace', 33, '2013/14', '2015/16', ['https://en.wikipedia.org/wiki/Glenn_Murray', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),
  spell('Glenn Murray', 'BOU', 'Bournemouth', 19, '2015/16', '2015/16', ['https://en.wikipedia.org/wiki/Glenn_Murray', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),
  spell('Glenn Murray', 'BHA', 'Brighton', 96, '2017/18', '2019/20', ['https://en.wikipedia.org/wiki/Glenn_Murray', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Gonzalo Montiel
  spell('Gonzalo Montiel', 'NFO', 'Forest', 14, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Gonzalo_Montiel', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Goncalo Guedes
  spell('Goncalo Guedes', 'WOL', 'Wolves', 13, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Gon%C3%A7alo_Guedes', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),
  spell('Goncalo Guedes', 'WOL', 'Wolves', 29, '2024/25', '2024/25', ['https://en.wikipedia.org/wiki/Gon%C3%A7alo_Guedes', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Graham Alexander
  spell('Graham Alexander', 'BUR', 'Burnley', 33, '2009/10', '2009/10', ['https://en.wikipedia.org/wiki/Graham_Alexander', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Gus Poyet
  spell('Gus Poyet', 'CHE', 'Chelsea', 105, '1997/98', '2000/01', ['https://en.wikipedia.org/wiki/Gus_Poyet', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),
  spell('Gus Poyet', 'TOT', 'Spurs', 82, '2001/02', '2003/04', ['https://en.wikipedia.org/wiki/Gus_Poyet', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Halil Dervisoglu
  spell('Halil Dervisoglu', 'BRE', 'Brentford', 1, '2021/22', '2022/23', ['https://en.wikipedia.org/wiki/Halil_Dervi%C5%9Fo%C4%9Flu', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Hannes Delcroix
  spell('Hannes Delcroix', 'BUR', 'Burnley', 12, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Hannes_Delcroix', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Harry Kewell
  spell('Harry Kewell', 'LEE', 'Leeds', 181, '1995/96', '2002/03', ['https://en.wikipedia.org/wiki/Harry_Kewell', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),
  spell('Harry Kewell', 'LIV', 'Liverpool', 93, '2003/04', '2007/08', ['https://en.wikipedia.org/wiki/Harry_Kewell', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Hector Bellerin
  spell('Hector Bellerin', 'ARS', 'Arsenal', 183, '2012/13', '2020/21', ['https://en.wikipedia.org/wiki/H%C3%A9ctor_Beller%C3%ADn', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Ilkay Gundogan
  spell('Ilkay Gundogan', 'MCI', 'Man City', 188, '2016/17', '2022/23', ['https://en.wikipedia.org/wiki/%C4%B0lkay_G%C3%BCndo%C4%9Fan', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),
  spell('Ilkay Gundogan', 'MCI', 'Man City', 33, '2024/25', '2024/25', ['https://en.wikipedia.org/wiki/%C4%B0lkay_G%C3%BCndo%C4%9Fan', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Ionut Radu
  spell('Ionut Radu', 'BOU', 'Bournemouth', 2, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Ionu%C8%9B_Radu', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Ivan Cavaleiro
  spell('Ivan Cavaleiro', 'WOL', 'Wolves', 23, '2018/19', '2018/19', ['https://en.wikipedia.org/wiki/Ivan_Cavaleiro', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),
  spell('Ivan Cavaleiro', 'FUL', 'Fulham', 36, '2020/21', '2020/21', ['https://en.wikipedia.org/wiki/Ivan_Cavaleiro', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Jaap Stam
  spell('Jaap Stam', 'MUN', 'Man United', 79, '1998/99', '2001/02', ['https://en.wikipedia.org/wiki/Jaap_Stam', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Jack Collison
  spell('Jack Collison', 'WHU', 'West Ham', 47, '2007/08', '2010/11', ['https://en.wikipedia.org/wiki/Jack_Collison', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),
  spell('Jack Collison', 'WHU', 'West Ham', 27, '2012/13', '2013/14', ['https://en.wikipedia.org/wiki/Jack_Collison', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),

  // Jack Simpson
  spell('Jack Simpson', 'BOU', 'Bournemouth', 11, '2015/16', '2019/20', ['https://en.wikipedia.org/wiki/Jack_Simpson_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Jack Stacey
  spell('Jack Stacey', 'BOU', 'Bournemouth', 19, '2019/20', '2019/20', ['https://en.wikipedia.org/wiki/Jack_Stacey', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),
  spell('Jack Stacey', 'BOU', 'Bournemouth', 10, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Jack_Stacey', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Jakub Moder
  spell('Jakub Moder', 'BHA', 'Brighton', 61, '2020/21', '2024/25', ['https://en.wikipedia.org/wiki/Jakub_Moder', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Jamal Lowe
  spell('Jamal Lowe', 'BOU', 'Bournemouth', 2, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Jamal_Lowe', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // James Perch
  spell('James Perch', 'NEW', 'Newcastle', 65, '2010/11', '2012/13', ['https://en.wikipedia.org/wiki/James_Perch', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // James Tomkins
  spell('James Tomkins', 'WHU', 'West Ham', 60, '2007/08', '2010/11', ['https://en.wikipedia.org/wiki/James_Tomkins_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),
  spell('James Tomkins', 'WHU', 'West Ham', 104, '2012/13', '2015/16', ['https://en.wikipedia.org/wiki/James_Tomkins_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),
  spell('James Tomkins', 'CRY', 'Palace', 125, '2016/17', '2023/24', ['https://en.wikipedia.org/wiki/James_Tomkins_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),

  // Jamie Shackleton
  spell('Jamie Shackleton', 'LEE', 'Leeds', 27, '2020/21', '2021/22', ['https://en.wikipedia.org/wiki/Jamie_Shackleton', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Jan Vertonghen
  spell('Jan Vertonghen', 'TOT', 'Spurs', 232, '2012/13', '2019/20', ['https://en.wikipedia.org/wiki/Jan_Vertonghen', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/']),

  // Jayson Molumby
  spell('Jayson Molumby', 'BHA', 'Brighton', 1, '2020/21', '2020/21', ['https://en.wikipedia.org/wiki/Jayson_Molumby', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Jairo Riedewald
  spell('Jairo Riedewald', 'CRY', 'Palace', 80, '2017/18', '2023/24', ['https://en.wikipedia.org/wiki/Ja%C3%AFro_Riedewald', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Jean Michael Seri
  spell('Jean Michael Seri', 'FUL', 'Fulham', 32, '2018/19', '2018/19', ['https://en.wikipedia.org/wiki/Jean_Micha%C3%ABl_Seri', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),

  // Jens Lehmann
  spell('Jens Lehmann', 'ARS', 'Arsenal', 147, '2003/04', '2007/08', ['https://en.wikipedia.org/wiki/Jens_Lehmann', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),
  spell('Jens Lehmann', 'ARS', 'Arsenal', 1, '2010/11', '2010/11', ['https://en.wikipedia.org/wiki/Jens_Lehmann', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Jeremy Sarmiento
  spell('Jeremy Sarmiento', 'BHA', 'Brighton', 14, '2021/22', '2022/23', ['https://en.wikipedia.org/wiki/Jeremy_Sarmiento', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),
  spell('Jeremy Sarmiento', 'BHA', 'Brighton', 1, '2024/25', '2024/25', ['https://en.wikipedia.org/wiki/Jeremy_Sarmiento', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Jerzy Dudek
  spell('Jerzy Dudek', 'LIV', 'Liverpool', 127, '2001/02', '2006/07', ['https://en.wikipedia.org/wiki/Jerzy_Dudek', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Jesus Navas
  spell('Jesus Navas', 'MCI', 'Man City', 123, '2013/14', '2016/17', ['https://en.wikipedia.org/wiki/Jes%C3%BAs_Navas', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Jhon Duran
  spell('Jhon Duran', 'AVL', 'Aston Villa', 55, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Jhon_Dur%C3%A1n', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/']),

  // Joe Bryan
  spell('Joe Bryan', 'FUL', 'Fulham', 28, '2018/19', '2018/19', ['https://en.wikipedia.org/wiki/Joe_Bryan', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),
  spell('Joe Bryan', 'FUL', 'Fulham', 16, '2020/21', '2020/21', ['https://en.wikipedia.org/wiki/Joe_Bryan', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),

  // Joe Gelhardt
  spell('Joe Gelhardt', 'LEE', 'Leeds', 35, '2020/21', '2022/23', ['https://en.wikipedia.org/wiki/Joe_Gelhardt', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Joe Ledley
  spell('Joe Ledley', 'CRY', 'Palace', 83, '2013/14', '2016/17', ['https://en.wikipedia.org/wiki/Joe_Ledley', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Joe Rothwell
  spell('Joe Rothwell', 'BOU', 'Bournemouth', 31, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Joe_Rothwell', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // John Jensen
  spell('John Jensen', 'ARS', 'Arsenal', 98, '1992/93', '1995/96', ['https://en.wikipedia.org/wiki/John_Jensen', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // John Obi Mikel
  spell('John Obi Mikel', 'CHE', 'Chelsea', 249, '2006/07', '2016/17', ['https://en.wikipedia.org/wiki/Mikel_John_Obi', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Jordan Beyer
  spell('Jordan Beyer', 'BUR', 'Burnley', 15, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Jordan_Beyer', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Jordan Zemura
  spell('Jordan Zemura', 'BOU', 'Bournemouth', 19, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Jordan_Zemura', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Josh Brownhill
  spell('Josh Brownhill', 'BUR', 'Burnley', 78, '2019/20', '2021/22', ['https://en.wikipedia.org/wiki/Josh_Brownhill', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),
  spell('Josh Brownhill', 'BUR', 'Burnley', 33, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Josh_Brownhill', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Joao Cancelo
  spell('Joao Cancelo', 'MCI', 'Man City', 98, '2019/20', '2022/23', ['https://en.wikipedia.org/wiki/Jo%C3%A3o_Cancelo', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Joel Matip
  spell('Joel Matip', 'LIV', 'Liverpool', 150, '2016/17', '2023/24', ['https://en.wikipedia.org/wiki/Jo%C3%ABl_Matip', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Juan Iturbe
  spell('Juan Iturbe', 'BOU', 'Bournemouth', 2, '2015/16', '2015/16', ['https://en.wikipedia.org/wiki/Juan_Iturbe', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Juan Mata
  spell('Juan Mata', 'CHE', 'Chelsea', 82, '2011/12', '2013/14', ['https://en.wikipedia.org/wiki/Juan_Mata', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),
  spell('Juan Mata', 'MUN', 'Man United', 196, '2013/14', '2021/22', ['https://en.wikipedia.org/wiki/Juan_Mata', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Julian Araujo
  spell('Julian Araujo', 'BOU', 'Bournemouth', 12, '2024/25', '2024/25', ['https://en.wikipedia.org/wiki/Juli%C3%A1n_Araujo', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Julian Alvarez
  spell('Julian Alvarez', 'MCI', 'Man City', 67, '2022/23', '2023/24', ['https://en.wikipedia.org/wiki/Juli%C3%A1n_Alvarez', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Julian Speroni
  spell('Julian Speroni', 'CRY', 'Palace', 6, '2004/05', '2004/05', ['https://en.wikipedia.org/wiki/Juli%C3%A1n_Speroni', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),
  spell('Julian Speroni', 'CRY', 'Palace', 87, '2013/14', '2018/19', ['https://en.wikipedia.org/wiki/Juli%C3%A1n_Speroni', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Junior Firpo
  spell('Junior Firpo', 'LEE', 'Leeds', 43, '2021/22', '2022/23', ['https://en.wikipedia.org/wiki/Junior_Firpo', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Johann Berg Gudmundsson
  spell('Johann Berg Gudmundsson', 'BUR', 'Burnley', 136, '2016/17', '2021/22', ['https://en.wikipedia.org/wiki/J%C3%B3hann_Berg_Gu%C3%B0mundsson', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),
  spell('Johann Berg Gudmundsson', 'BUR', 'Burnley', 26, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/J%C3%B3hann_Berg_Gu%C3%B0mundsson', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Jurgen Locadia
  spell('Jurgen Locadia', 'BHA', 'Brighton', 34, '2017/18', '2019/20', ['https://en.wikipedia.org/wiki/J%C3%BCrgen_Locadia', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),
  spell('Jurgen Locadia', 'BHA', 'Brighton', 1, '2021/22', '2021/22', ['https://en.wikipedia.org/wiki/J%C3%BCrgen_Locadia', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Karl-Heinz Riedle
  spell('Karl-Heinz Riedle', 'LIV', 'Liverpool', 60, '1997/98', '1999/00', ['https://en.wikipedia.org/wiki/Karl-Heinz_Riedle', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Kevin Long
  spell('Kevin Long', 'BUR', 'Burnley', 1, '2014/15', '2014/15', ['https://en.wikipedia.org/wiki/Kevin_Long_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),
  spell('Kevin Long', 'BUR', 'Burnley', 47, '2016/17', '2021/22', ['https://en.wikipedia.org/wiki/Kevin_Long_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Kevin Miller
  spell('Kevin Miller', 'CRY', 'Palace', 38, '1997/98', '1997/98', ['https://en.wikipedia.org/wiki/Kevin_Miller_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Kevin Mirallas
  spell('Kevin Mirallas', 'EVE', 'Everton', 151, '2012/13', '2017/18', ['https://en.wikipedia.org/wiki/Kevin_Mirallas', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/everton/everton-fc-premier-league-appearances/']),

  // Keylor Navas
  spell('Keylor Navas', 'NFO', 'Forest', 17, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Keylor_Navas', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Kieffer Moore
  spell('Kieffer Moore', 'BOU', 'Bournemouth', 35, '2022/23', '2023/24', ['https://en.wikipedia.org/wiki/Kieffer_Moore', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Kieran Tierney
  spell('Kieran Tierney', 'ARS', 'Arsenal', 104, '2019/20', '2024/25', ['https://en.wikipedia.org/wiki/Kieran_Tierney', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Kostas Tsimikas
  spell('Kostas Tsimikas', 'LIV', 'Liverpool', 66, '2020/21', '2024/25', ['https://en.wikipedia.org/wiki/Kostas_Tsimikas', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Laurent Koscielny
  spell('Laurent Koscielny', 'ARS', 'Arsenal', 255, '2010/11', '2018/19', ['https://en.wikipedia.org/wiki/Laurent_Koscielny', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Ledley King
  spell('Ledley King', 'TOT', 'Spurs', 268, '1998/99', '2011/12', ['https://en.wikipedia.org/wiki/Ledley_King', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/']),

  // Lee Clark
  spell('Lee Clark', 'NEW', 'Newcastle', 101, '1993/94', '1996/97', ['https://en.wikipedia.org/wiki/Lee_Clark_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),
  spell('Lee Clark', 'NEW', 'Newcastle', 22, '2005/06', '2005/06', ['https://en.wikipedia.org/wiki/Lee_Clark_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),
  spell('Lee Clark', 'FUL', 'Fulham', 62, '2001/02', '2004/05', ['https://en.wikipedia.org/wiki/Lee_Clark_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Lee Glover
  spell('Lee Glover', 'NFO', 'Forest', 14, '1992/93', '1992/93', ['https://en.wikipedia.org/wiki/Lee_Glover', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Lee Hendrie
  spell('Lee Hendrie', 'AVL', 'Aston Villa', 251, '1995/96', '2006/07', ['https://en.wikipedia.org/wiki/Lee_Hendrie', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/']),

  // Leon Balogun
  spell('Leon Balogun', 'BHA', 'Brighton', 8, '2018/19', '2019/20', ['https://en.wikipedia.org/wiki/Leon_Balogun', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Leroy Sane
  spell('Leroy Sane', 'MCI', 'Man City', 90, '2016/17', '2019/20', ['https://en.wikipedia.org/wiki/Leroy_San%C3%A9', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Lewis O'Brien
  spell('Lewis O\'Brien', 'NFO', 'Forest', 13, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Lewis_O%27Brien_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Lorenz Assignon
  spell('Lorenz Assignon', 'BUR', 'Burnley', 15, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Lorenz_Assignon', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Luca Koleosho
  spell('Luca Koleosho', 'BUR', 'Burnley', 15, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Luca_Koleosho', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Luka Milivojevic
  spell('Luka Milivojevic', 'CRY', 'Palace', 183, '2016/17', '2022/23', ['https://en.wikipedia.org/wiki/Luka_Milivojevi%C4%87', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Luka Modric
  spell('Luka Modric', 'TOT', 'Spurs', 127, '2008/09', '2011/12', ['https://en.wikipedia.org/wiki/Luka_Modri%C4%87', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/']),

  // Mads Bech Sørensen
  spell('Mads Bech Sørensen', 'BRE', 'Brentford', 15, '2021/22', '2022/23', ['https://en.wikipedia.org/wiki/Mads_Bech_S%C3%B8rensen', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Mads Bidstrup
  spell('Mads Bidstrup', 'BRE', 'Brentford', 4, '2021/22', '2021/22', ['https://en.wikipedia.org/wiki/Mads_Bidstrup', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Mahmoud Dahoud
  spell('Mahmoud Dahoud', 'BHA', 'Brighton', 9, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Mahmoud_Dahoud', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Mamadou Sakho
  spell('Mamadou Sakho', 'LIV', 'Liverpool', 56, '2013/14', '2015/16', ['https://en.wikipedia.org/wiki/Mamadou_Sakho', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),
  spell('Mamadou Sakho', 'CRY', 'Palace', 72, '2016/17', '2020/21', ['https://en.wikipedia.org/wiki/Mamadou_Sakho', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Manuel Akanji
  spell('Manuel Akanji', 'MCI', 'Man City', 85, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Manuel_Akanji', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Manuel Almunia
  spell('Manuel Almunia', 'ARS', 'Arsenal', 109, '2004/05', '2011/12', ['https://en.wikipedia.org/wiki/Manuel_Almunia', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Manuel Lanzini
  spell('Manuel Lanzini', 'WHU', 'West Ham', 179, '2015/16', '2022/23', ['https://en.wikipedia.org/wiki/Manuel_Lanzini', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),

  // Marc Overmars
  spell('Marc Overmars', 'ARS', 'Arsenal', 100, '1997/98', '1999/00', ['https://en.wikipedia.org/wiki/Marc_Overmars', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Marc Pugh
  spell('Marc Pugh', 'BOU', 'Bournemouth', 67, '2015/16', '2018/19', ['https://en.wikipedia.org/wiki/Marc_Pugh', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Marc Roca
  spell('Marc Roca', 'LEE', 'Leeds', 32, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Marc_Roca', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Marcel Desailly
  spell('Marcel Desailly', 'CHE', 'Chelsea', 158, '1998/99', '2003/04', ['https://en.wikipedia.org/wiki/Marcel_Desailly', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Marcus Forss
  spell('Marcus Forss', 'BRE', 'Brentford', 7, '2021/22', '2021/22', ['https://en.wikipedia.org/wiki/Marcus_Forss', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Mark Delaney
  spell('Mark Delaney', 'AVL', 'Aston Villa', 158, '1998/99', '2006/07', ['https://en.wikipedia.org/wiki/Mark_Delaney_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/']),

  // Mark Flekken
  spell('Mark Flekken', 'BRE', 'Brentford', 74, '2023/24', '2024/25', ['https://en.wikipedia.org/wiki/Mark_Flekken', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Markus Suttner
  spell('Markus Suttner', 'BHA', 'Brighton', 14, '2017/18', '2017/18', ['https://en.wikipedia.org/wiki/Markus_Suttner', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Marouane Fellaini
  spell('Marouane Fellaini', 'EVE', 'Everton', 141, '2008/09', '2013/14', ['https://en.wikipedia.org/wiki/Marouane_Fellaini', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/everton/everton-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),
  spell('Marouane Fellaini', 'MUN', 'Man United', 119, '2013/14', '2018/19', ['https://en.wikipedia.org/wiki/Marouane_Fellaini', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/everton/everton-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Martin Paterson
  spell('Martin Paterson', 'BUR', 'Burnley', 23, '2009/10', '2009/10', ['https://en.wikipedia.org/wiki/Martin_Paterson', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Martin Skrtel
  spell('Martin Skrtel', 'LIV', 'Liverpool', 242, '2007/08', '2015/16', ['https://en.wikipedia.org/wiki/Martin_%C5%A0krtel', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Martin Demichelis
  spell('Martin Demichelis', 'MCI', 'Man City', 78, '2013/14', '2015/16', ['https://en.wikipedia.org/wiki/Mart%C3%ADn_Demichelis', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Martin Montoya
  spell('Martin Montoya', 'BHA', 'Brighton', 52, '2018/19', '2019/20', ['https://en.wikipedia.org/wiki/Mart%C3%ADn_Montoya', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Mason Greenwood
  spell('Mason Greenwood', 'MUN', 'Man United', 83, '2018/19', '2022/23', ['https://en.wikipedia.org/wiki/Mason_Greenwood', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Mateusz Klich
  spell('Mateusz Klich', 'LEE', 'Leeds', 82, '2020/21', '2022/23', ['https://en.wikipedia.org/wiki/Mateusz_Klich', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Matt Lowton
  spell('Matt Lowton', 'AVL', 'Aston Villa', 72, '2012/13', '2014/15', ['https://en.wikipedia.org/wiki/Matt_Lowton', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),
  spell('Matt Lowton', 'BUR', 'Burnley', 159, '2016/17', '2021/22', ['https://en.wikipedia.org/wiki/Matt_Lowton', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Matteo Darmian
  spell('Matteo Darmian', 'MUN', 'Man United', 60, '2015/16', '2018/19', ['https://en.wikipedia.org/wiki/Matteo_Darmian', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Matias Vina
  spell('Matias Vina', 'BOU', 'Bournemouth', 12, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Mat%C3%ADas_Vi%C3%B1a', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Max Meyer
  spell('Max Meyer', 'CRY', 'Palace', 46, '2018/19', '2020/21', ['https://en.wikipedia.org/wiki/Max_Meyer_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Maxi Rodriguez
  spell('Maxi Rodriguez', 'LIV', 'Liverpool', 57, '2009/10', '2011/12', ['https://en.wikipedia.org/wiki/Maxi_Rodr%C3%ADguez', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Mesut Ozil
  spell('Mesut Ozil', 'ARS', 'Arsenal', 184, '2013/14', '2020/21', ['https://en.wikipedia.org/wiki/Mesut_%C3%96zil', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Michael Ballack
  spell('Michael Ballack', 'CHE', 'Chelsea', 105, '2006/07', '2009/10', ['https://en.wikipedia.org/wiki/Michael_Ballack', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Michael Duff
  spell('Michael Duff', 'BUR', 'Burnley', 11, '2009/10', '2009/10', ['https://en.wikipedia.org/wiki/Michael_Duff_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),
  spell('Michael Duff', 'BUR', 'Burnley', 21, '2014/15', '2014/15', ['https://en.wikipedia.org/wiki/Michael_Duff_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Michael Essien
  spell('Michael Essien', 'CHE', 'Chelsea', 163, '2005/06', '2011/12', ['https://en.wikipedia.org/wiki/Michael_Essien', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),
  spell('Michael Essien', 'CHE', 'Chelsea', 5, '2013/14', '2013/14', ['https://en.wikipedia.org/wiki/Michael_Essien', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Michael Olakigbe
  spell('Michael Olakigbe', 'BRE', 'Brentford', 8, '2022/23', '2023/24', ['https://en.wikipedia.org/wiki/Michael_Olakigbe', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Michael Olise
  spell('Michael Olise', 'CRY', 'Palace', 82, '2021/22', '2023/24', ['https://en.wikipedia.org/wiki/Michael_Olise', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Michail Antonio
  spell('Michail Antonio', 'WHU', 'West Ham', 268, '2015/16', '2024/25', ['https://en.wikipedia.org/wiki/Michail_Antonio', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),

  // Miguel Almiron
  spell('Miguel Almiron', 'NEW', 'Newcastle', 186, '2018/19', '2024/25', ['https://en.wikipedia.org/wiki/Miguel_Almir%C3%B3n', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Mikel Arteta
  spell('Mikel Arteta', 'EVE', 'Everton', 174, '2004/05', '2011/12', ['https://en.wikipedia.org/wiki/Mikel_Arteta', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/everton/everton-fc-premier-league-appearances/']),
  spell('Mikel Arteta', 'ARS', 'Arsenal', 110, '2011/12', '2015/16', ['https://en.wikipedia.org/wiki/Mikel_Arteta', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/everton/everton-fc-premier-league-appearances/']),

  // Mile Jedinak
  spell('Mile Jedinak', 'CRY', 'Palace', 90, '2013/14', '2016/17', ['https://en.wikipedia.org/wiki/Mile_Jedinak', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Mohamed El Neny
  spell('Mohamed El Neny', 'ARS', 'Arsenal', 46, '2015/16', '2018/19', ['https://en.wikipedia.org/wiki/Mohamed_Elneny', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),
  spell('Mohamed El Neny', 'ARS', 'Arsenal', 45, '2020/21', '2023/24', ['https://en.wikipedia.org/wiki/Mohamed_Elneny', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Naby Keita
  spell('Naby Keita', 'LIV', 'Liverpool', 84, '2018/19', '2022/23', ['https://en.wikipedia.org/wiki/Naby_Ke%C3%AFta', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Nani
  spell('Nani', 'MUN', 'Man United', 147, '2007/08', '2014/15', ['https://en.wikipedia.org/wiki/Nani_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Naouirou Ahamada
  spell('Naouirou Ahamada', 'CRY', 'Palace', 28, '2022/23', '2023/24', ['https://en.wikipedia.org/wiki/Naouirou_Ahamada', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Nathan Baker
  spell('Nathan Baker', 'AVL', 'Aston Villa', 79, '2009/10', '2015/16', ['https://en.wikipedia.org/wiki/Nathan_Baker', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/']),

  // Nathan Young-Coombes
  spell('Nathan Young-Coombes', 'BRE', 'Brentford', 1, '2021/22', '2021/22', ['https://en.wikipedia.org/wiki/Nathan_Young-Coombes', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Nemanja Matic
  spell('Nemanja Matic', 'CHE', 'Chelsea', 2, '2009/10', '2010/11', ['https://en.wikipedia.org/wiki/Nemanja_Mati%C4%87', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),
  spell('Nemanja Matic', 'CHE', 'Chelsea', 121, '2013/14', '2016/17', ['https://en.wikipedia.org/wiki/Nemanja_Mati%C4%87', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),
  spell('Nemanja Matic', 'MUN', 'Man United', 128, '2017/18', '2021/22', ['https://en.wikipedia.org/wiki/Nemanja_Mati%C4%87', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Nicolas Pepe
  spell('Nicolas Pepe', 'ARS', 'Arsenal', 80, '2019/20', '2021/22', ['https://en.wikipedia.org/wiki/Nicolas_P%C3%A9p%C3%A9', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Nicolas Otamendi
  spell('Nicolas Otamendi', 'MCI', 'Man City', 136, '2015/16', '2019/20', ['https://en.wikipedia.org/wiki/Nicol%C3%A1s_Otamendi', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Nigel de Jong
  spell('Nigel de Jong', 'MCI', 'Man City', 104, '2008/09', '2012/13', ['https://en.wikipedia.org/wiki/Nigel_de_Jong', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Nelson Semedo
  spell('Nelson Semedo', 'WOL', 'Wolves', 165, '2020/21', '2024/25', ['https://en.wikipedia.org/wiki/N%C3%A9lson_Semedo', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Odel Offiah
  spell('Odel Offiah', 'BHA', 'Brighton', 6, '2021/22', '2024/25', ['https://en.wikipedia.org/wiki/Odel_Offiah', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Ole Gunnar Solskjær
  spell('Ole Gunnar Solskjær', 'MUN', 'Man United', 235, '1996/97', '2006/07', ['https://en.wikipedia.org/wiki/Ole_Gunnar_Solskj%C3%A6r', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Olivier Giroud
  spell('Olivier Giroud', 'ARS', 'Arsenal', 180, '2012/13', '2017/18', ['https://en.wikipedia.org/wiki/Olivier_Giroud', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),
  spell('Olivier Giroud', 'CHE', 'Chelsea', 75, '2017/18', '2020/21', ['https://en.wikipedia.org/wiki/Olivier_Giroud', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Olof Mellberg
  spell('Olof Mellberg', 'AVL', 'Aston Villa', 232, '2001/02', '2007/08', ['https://en.wikipedia.org/wiki/Olof_Mellberg', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/']),

  // Pablo Sarabia
  spell('Pablo Sarabia', 'WOL', 'Wolves', 66, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Pablo_Sarabia', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Pablo Zabaleta
  spell('Pablo Zabaleta', 'MCI', 'Man City', 230, '2008/09', '2016/17', ['https://en.wikipedia.org/wiki/Pablo_Zabaleta', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),
  spell('Pablo Zabaleta', 'WHU', 'West Ham', 73, '2017/18', '2019/20', ['https://en.wikipedia.org/wiki/Pablo_Zabaleta', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),

  // Pape Souare
  spell('Pape Souare', 'CRY', 'Palace', 48, '2014/15', '2018/19', ['https://en.wikipedia.org/wiki/Pape_Souar%C3%A9', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Papiss Cisse
  spell('Papiss Cisse', 'NEW', 'Newcastle', 117, '2011/12', '2015/16', ['https://en.wikipedia.org/wiki/Papiss_Ciss%C3%A9', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Paul Dummett
  spell('Paul Dummett', 'NEW', 'Newcastle', 66, '2012/13', '2015/16', ['https://en.wikipedia.org/wiki/Paul_Dummett', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),
  spell('Paul Dummett', 'NEW', 'Newcastle', 85, '2017/18', '2023/24', ['https://en.wikipedia.org/wiki/Paul_Dummett', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Paul Pogba
  spell('Paul Pogba', 'MUN', 'Man United', 3, '2010/11', '2011/12', ['https://en.wikipedia.org/wiki/Paul_Pogba', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),
  spell('Paul Pogba', 'MUN', 'Man United', 154, '2016/17', '2021/22', ['https://en.wikipedia.org/wiki/Paul_Pogba', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Paul Rideout
  spell('Paul Rideout', 'EVE', 'Everton', 112, '1992/93', '1996/97', ['https://en.wikipedia.org/wiki/Paul_Rideout', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/everton/everton-fc-premier-league-appearances/']),

  // Paul Walsh
  spell('Paul Walsh', 'MCI', 'Man City', 53, '1993/94', '1995/96', ['https://en.wikipedia.org/wiki/Paul_Walsh', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Paulo Ferreira
  spell('Paulo Ferreira', 'CHE', 'Chelsea', 141, '2004/05', '2012/13', ['https://en.wikipedia.org/wiki/Paulo_Ferreira', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Pedro Obiang
  spell('Pedro Obiang', 'WHU', 'West Ham', 91, '2015/16', '2018/19', ['https://en.wikipedia.org/wiki/Pedro_Obiang', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),

  // Per Mertesacker
  spell('Per Mertesacker', 'ARS', 'Arsenal', 156, '2011/12', '2017/18', ['https://en.wikipedia.org/wiki/Per_Mertesacker', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Pervis Estupinan
  spell('Pervis Estupinan', 'BHA', 'Brighton', 84, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Pervis_Estupi%C3%B1%C3%A1n', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Philip Billing
  spell('Philip Billing', 'BOU', 'Bournemouth', 34, '2019/20', '2019/20', ['https://en.wikipedia.org/wiki/Philip_Billing', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),
  spell('Philip Billing', 'BOU', 'Bournemouth', 75, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Philip_Billing', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Philippe Albert
  spell('Philippe Albert', 'NEW', 'Newcastle', 96, '1994/95', '1998/99', ['https://en.wikipedia.org/wiki/Philippe_Albert', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Pierre van Hooijdonk
  spell('Pierre van Hooijdonk', 'NFO', 'Forest', 8, '1996/97', '1996/97', ['https://en.wikipedia.org/wiki/Pierre_van_Hooijdonk', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),
  spell('Pierre van Hooijdonk', 'NFO', 'Forest', 21, '1998/99', '1998/99', ['https://en.wikipedia.org/wiki/Pierre_van_Hooijdonk', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Pontus Jansson
  spell('Pontus Jansson', 'BRE', 'Brentford', 49, '2021/22', '2022/23', ['https://en.wikipedia.org/wiki/Pontus_Jansson', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Rafael van der Vaart
  spell('Rafael van der Vaart', 'TOT', 'Spurs', 63, '2010/11', '2012/13', ['https://en.wikipedia.org/wiki/Rafael_van_der_Vaart', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/']),

  // Ramires
  spell('Ramires', 'CHE', 'Chelsea', 159, '2010/11', '2015/16', ['https://en.wikipedia.org/wiki/Ramires', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Ramon Vega
  spell('Ramon Vega', 'TOT', 'Spurs', 64, '1996/97', '2000/01', ['https://en.wikipedia.org/wiki/Ramon_Vega', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/']),

  // Ramon Sosa
  spell('Ramon Sosa', 'NFO', 'Forest', 19, '2024/25', '2024/25', ['https://en.wikipedia.org/wiki/Ram%C3%B3n_Sosa', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Raphael Varane
  spell('Raphael Varane', 'MUN', 'Man United', 68, '2021/22', '2023/24', ['https://en.wikipedia.org/wiki/Rapha%C3%ABl_Varane', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Raphinha
  spell('Raphinha', 'LEE', 'Leeds', 65, '2020/21', '2021/22', ['https://en.wikipedia.org/wiki/Raphinha', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Rasmus Højlund
  spell('Rasmus Højlund', 'MUN', 'Man United', 62, '2023/24', '2024/25', ['https://en.wikipedia.org/wiki/Rasmus_H%C3%B8jlund', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Rasmus Kristensen
  spell('Rasmus Kristensen', 'LEE', 'Leeds', 26, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Rasmus_Kristensen', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Reda Khadra
  spell('Reda Khadra', 'BHA', 'Brighton', 1, '2020/21', '2022/23', ['https://en.wikipedia.org/wiki/Reda_Khadra', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Remo Freuler
  spell('Remo Freuler', 'NFO', 'Forest', 28, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Remo_Freuler', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Renan Lodi
  spell('Renan Lodi', 'NFO', 'Forest', 28, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Renan_Lodi', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Ricky Newman
  spell('Ricky Newman', 'CRY', 'Palace', 2, '1992/93', '1992/93', ['https://en.wikipedia.org/wiki/Ricky_Newman', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),
  spell('Ricky Newman', 'CRY', 'Palace', 35, '1994/95', '1994/95', ['https://en.wikipedia.org/wiki/Ricky_Newman', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Roberto Di Matteo
  spell('Roberto Di Matteo', 'CHE', 'Chelsea', 119, '1996/97', '2000/01', ['https://en.wikipedia.org/wiki/Roberto_Di_Matteo', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Roberto Firmino
  spell('Roberto Firmino', 'LIV', 'Liverpool', 256, '2015/16', '2022/23', ['https://en.wikipedia.org/wiki/Roberto_Firmino', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Robin Koch
  spell('Robin Koch', 'LEE', 'Leeds', 73, '2020/21', '2022/23', ['https://en.wikipedia.org/wiki/Robin_Koch', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Robin van Persie
  spell('Robin van Persie', 'ARS', 'Arsenal', 194, '2004/05', '2011/12', ['https://en.wikipedia.org/wiki/Robin_van_Persie', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),
  spell('Robin van Persie', 'MUN', 'Man United', 86, '2012/13', '2014/15', ['https://en.wikipedia.org/wiki/Robin_van_Persie', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Romain Faivre
  spell('Romain Faivre', 'BOU', 'Bournemouth', 5, '2023/24', '2023/24', ['https://en.wikipedia.org/wiki/Romain_Faivre', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Romain Saiss
  spell('Romain Saiss', 'WOL', 'Wolves', 110, '2018/19', '2021/22', ['https://en.wikipedia.org/wiki/Romain_Sa%C3%AFss', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Ron Vlaar
  spell('Ron Vlaar', 'AVL', 'Aston Villa', 79, '2012/13', '2014/15', ['https://en.wikipedia.org/wiki/Ron_Vlaar', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/']),

  // Ruud Van Nistelrooy
  spell('Ruud Van Nistelrooy', 'MUN', 'Man United', 150, '2001/02', '2005/06', ['https://en.wikipedia.org/wiki/Ruud_van_Nistelrooy', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Ryan Trevitt
  spell('Ryan Trevitt', 'BRE', 'Brentford', 1, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Ryan_Trevitt', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Ruben Neves
  spell('Ruben Neves', 'WOL', 'Wolves', 177, '2018/19', '2022/23', ['https://en.wikipedia.org/wiki/R%C3%BAben_Neves', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Salomon Kalou
  spell('Salomon Kalou', 'CHE', 'Chelsea', 156, '2006/07', '2011/12', ['https://en.wikipedia.org/wiki/Salomon_Kalou', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Sam Baldock
  spell('Sam Baldock', 'BHA', 'Brighton', 2, '2017/18', '2017/18', ['https://en.wikipedia.org/wiki/Sam_Baldock', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Sam Greenwood
  spell('Sam Greenwood', 'LEE', 'Leeds', 25, '2020/21', '2022/23', ['https://en.wikipedia.org/wiki/Sam_Greenwood_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Saman Ghoddos
  spell('Saman Ghoddos', 'BRE', 'Brentford', 51, '2021/22', '2023/24', ['https://en.wikipedia.org/wiki/Saman_Ghoddos', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Santi Cazorla
  spell('Santi Cazorla', 'ARS', 'Arsenal', 129, '2012/13', '2017/18', ['https://en.wikipedia.org/wiki/Santi_Cazorla', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Savo Milosevic
  spell('Savo Milosevic', 'AVL', 'Aston Villa', 90, '1995/96', '1997/98', ['https://en.wikipedia.org/wiki/Savo_Milo%C5%A1evi%C4%87', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/']),

  // Said Benrahma
  spell('Said Benrahma', 'WHU', 'West Ham', 110, '2020/21', '2023/24', ['https://en.wikipedia.org/wiki/Sa%C3%AFd_Benrahma', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),

  // Scott Arfield
  spell('Scott Arfield', 'BUR', 'Burnley', 37, '2014/15', '2014/15', ['https://en.wikipedia.org/wiki/Scott_Arfield', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),
  spell('Scott Arfield', 'BUR', 'Burnley', 49, '2016/17', '2017/18', ['https://en.wikipedia.org/wiki/Scott_Arfield', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Scott McKenna
  spell('Scott McKenna', 'NFO', 'Forest', 25, '2022/23', '2023/24', ['https://en.wikipedia.org/wiki/Scott_McKenna', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Scott McTominay
  spell('Scott McTominay', 'MUN', 'Man United', 178, '2016/17', '2024/25', ['https://en.wikipedia.org/wiki/Scott_McTominay', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Sead Kolasinac
  spell('Sead Kolasinac', 'ARS', 'Arsenal', 80, '2017/18', '2021/22', ['https://en.wikipedia.org/wiki/Sead_Kola%C5%A1inac', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Serge Aurier
  spell('Serge Aurier', 'TOT', 'Spurs', 77, '2017/18', '2020/21', ['https://en.wikipedia.org/wiki/Serge_Aurier', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),
  spell('Serge Aurier', 'NFO', 'Forest', 36, '2022/23', '2023/24', ['https://en.wikipedia.org/wiki/Serge_Aurier', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Shandon Baptiste
  spell('Shandon Baptiste', 'BRE', 'Brentford', 55, '2021/22', '2023/24', ['https://en.wikipedia.org/wiki/Shandon_Baptiste', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Simon Francis
  spell('Simon Francis', 'BOU', 'Bournemouth', 136, '2015/16', '2019/20', ['https://en.wikipedia.org/wiki/Simon_Francis_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Simon Rodger
  spell('Simon Rodger', 'CRY', 'Palace', 23, '1992/93', '1992/93', ['https://en.wikipedia.org/wiki/Simon_Rodger', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),
  spell('Simon Rodger', 'CRY', 'Palace', 4, '1994/95', '1994/95', ['https://en.wikipedia.org/wiki/Simon_Rodger', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),
  spell('Simon Rodger', 'CRY', 'Palace', 29, '1997/98', '1997/98', ['https://en.wikipedia.org/wiki/Simon_Rodger', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Siriki Dembele
  spell('Siriki Dembele', 'BOU', 'Bournemouth', 6, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Siriki_Demb%C3%A9l%C3%A9', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Stephen Jordan
  spell('Stephen Jordan', 'MCI', 'Man City', 53, '2002/03', '2006/07', ['https://en.wikipedia.org/wiki/Stephen_Jordan_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),
  spell('Stephen Jordan', 'BUR', 'Burnley', 25, '2009/10', '2009/10', ['https://en.wikipedia.org/wiki/Stephen_Jordan_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Stephen McPhail
  spell('Stephen McPhail', 'LEE', 'Leeds', 78, '1997/98', '2003/04', ['https://en.wikipedia.org/wiki/Stephen_McPhail', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Stephen Ward
  spell('Stephen Ward', 'WOL', 'Wolves', 94, '2009/10', '2011/12', ['https://en.wikipedia.org/wiki/Stephen_Ward_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),
  spell('Stephen Ward', 'BUR', 'Burnley', 9, '2014/15', '2014/15', ['https://en.wikipedia.org/wiki/Stephen_Ward_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),
  spell('Stephen Ward', 'BUR', 'Burnley', 68, '2016/17', '2018/19', ['https://en.wikipedia.org/wiki/Stephen_Ward_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Steve Bruce
  spell('Steve Bruce', 'MUN', 'Man United', 148, '1992/93', '1995/96', ['https://en.wikipedia.org/wiki/Steve_Bruce', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-united/manchester-united-premier-league-appearances/']),

  // Steve Cook
  spell('Steve Cook', 'BOU', 'Bournemouth', 168, '2015/16', '2019/20', ['https://en.wikipedia.org/wiki/Steve_Cook', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),
  spell('Steve Cook', 'NFO', 'Forest', 12, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Steve_Cook', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Steve Marlet
  spell('Steve Marlet', 'FUL', 'Fulham', 55, '2001/02', '2003/04', ['https://en.wikipedia.org/wiki/Steve_Marlet', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),

  // Steve Nicol
  spell('Steve Nicol', 'LIV', 'Liverpool', 67, '1992/93', '1994/95', ['https://en.wikipedia.org/wiki/Steve_Nicol', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Steven Alzate
  spell('Steven Alzate', 'BHA', 'Brighton', 43, '2017/18', '2023/24', ['https://en.wikipedia.org/wiki/Steven_Alzate', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Steven Defour
  spell('Steven Defour', 'BUR', 'Burnley', 51, '2016/17', '2018/19', ['https://en.wikipedia.org/wiki/Steven_Defour', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Steven Taylor
  spell('Steven Taylor', 'NEW', 'Newcastle', 111, '2003/04', '2008/09', ['https://en.wikipedia.org/wiki/Steven_Taylor_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),
  spell('Steven Taylor', 'NEW', 'Newcastle', 83, '2010/11', '2015/16', ['https://en.wikipedia.org/wiki/Steven_Taylor_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Stuart Dallas
  spell('Stuart Dallas', 'LEE', 'Leeds', 72, '2020/21', '2022/23', ['https://en.wikipedia.org/wiki/Stuart_Dallas', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Tariqe Fosu-Henry
  spell('Tariqe Fosu-Henry', 'BRE', 'Brentford', 1, '2021/22', '2022/23', ['https://en.wikipedia.org/wiki/Tariqe_Fosu', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Taylor Richards
  spell('Taylor Richards', 'BHA', 'Brighton', 2, '2021/22', '2021/22', ['https://en.wikipedia.org/wiki/Taylor_Richards', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Thiago Alcantara
  spell('Thiago Alcantara', 'LIV', 'Liverpool', 68, '2020/21', '2023/24', ['https://en.wikipedia.org/wiki/Thiago_Alc%C3%A2ntara', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Thiago Silva
  spell('Thiago Silva', 'CHE', 'Chelsea', 113, '2020/21', '2023/24', ['https://en.wikipedia.org/wiki/Thiago_Silva', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Thibaut Courtois
  spell('Thibaut Courtois', 'CHE', 'Chelsea', 126, '2014/15', '2017/18', ['https://en.wikipedia.org/wiki/Thibaut_Courtois', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/chelsea/chelsea-fc-premier-league-appearances/']),

  // Thomas Partey
  spell('Thomas Partey', 'ARS', 'Arsenal', 130, '2020/21', '2024/25', ['https://en.wikipedia.org/wiki/Thomas_Partey', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Thomas Vermaelen
  spell('Thomas Vermaelen', 'ARS', 'Arsenal', 110, '2009/10', '2013/14', ['https://en.wikipedia.org/wiki/Thomas_Vermaelen', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Tim Cahill
  spell('Tim Cahill', 'EVE', 'Everton', 226, '2004/05', '2011/12', ['https://en.wikipedia.org/wiki/Tim_Cahill', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/everton/everton-fc-premier-league-appearances/']),

  // Tim Ream
  spell('Tim Ream', 'FUL', 'Fulham', 26, '2018/19', '2018/19', ['https://en.wikipedia.org/wiki/Tim_Ream', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),
  spell('Tim Ream', 'FUL', 'Fulham', 7, '2020/21', '2020/21', ['https://en.wikipedia.org/wiki/Tim_Ream', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),
  spell('Tim Ream', 'FUL', 'Fulham', 51, '2022/23', '2023/24', ['https://en.wikipedia.org/wiki/Tim_Ream', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),

  // Tomer Hemed
  spell('Tomer Hemed', 'BHA', 'Brighton', 16, '2017/18', '2018/19', ['https://en.wikipedia.org/wiki/Tomer_Hemed', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Tommy Elphick
  spell('Tommy Elphick', 'BOU', 'Bournemouth', 12, '2015/16', '2015/16', ['https://en.wikipedia.org/wiki/Tommy_Elphick', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Tomas Rosicky
  spell('Tomas Rosicky', 'ARS', 'Arsenal', 170, '2006/07', '2015/16', ['https://en.wikipedia.org/wiki/Tom%C3%A1%C5%A1_Rosick%C3%BD', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Tony Hibbert
  spell('Tony Hibbert', 'EVE', 'Everton', 265, '2000/01', '2015/16', ['https://en.wikipedia.org/wiki/Tony_Hibbert', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/everton/everton-fc-premier-league-appearances/']),

  // Tony Yeboah
  spell('Tony Yeboah', 'LEE', 'Leeds', 47, '1994/95', '1996/97', ['https://en.wikipedia.org/wiki/Tony_Yeboah', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Trent Alexander-Arnold
  spell('Trent Alexander-Arnold', 'LIV', 'Liverpool', 259, '2016/17', '2024/25', ['https://en.wikipedia.org/wiki/Trent_Alexander-Arnold', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/']),

  // Uwe Hunemeier
  spell('Uwe Hunemeier', 'BHA', 'Brighton', 1, '2017/18', '2017/18', ['https://en.wikipedia.org/wiki/Uwe_H%C3%BCnemeier', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brighton-and-hove-albion/brighton-hove-albion-premier-league-appearances/']),

  // Vicente Guaita
  spell('Vicente Guaita', 'CRY', 'Palace', 149, '2018/19', '2022/23', ['https://en.wikipedia.org/wiki/Vicente_Guaita', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/']),

  // Vincent Kompany
  spell('Vincent Kompany', 'MCI', 'Man City', 265, '2008/09', '2018/19', ['https://en.wikipedia.org/wiki/Vincent_Kompany', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Vitinha
  spell('Vitinha', 'WOL', 'Wolves', 19, '2020/21', '2020/21', ['https://en.wikipedia.org/wiki/Vitinha', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Vurnon Anita
  spell('Vurnon Anita', 'NEW', 'Newcastle', 106, '2012/13', '2015/16', ['https://en.wikipedia.org/wiki/Vurnon_Anita', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Wade Elliott
  spell('Wade Elliott', 'BUR', 'Burnley', 38, '2009/10', '2009/10', ['https://en.wikipedia.org/wiki/Wade_Elliott', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Winston Reid
  spell('Winston Reid', 'WHU', 'West Ham', 7, '2010/11', '2010/11', ['https://en.wikipedia.org/wiki/Winston_Reid', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),
  spell('Winston Reid', 'WHU', 'West Ham', 159, '2012/13', '2021/22', ['https://en.wikipedia.org/wiki/Winston_Reid', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),

  // Wojciech Szczesny
  spell('Wojciech Szczesny', 'ARS', 'Arsenal', 132, '2009/10', '2014/15', ['https://en.wikipedia.org/wiki/Wojciech_Szcz%C4%99sny', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Yann Kermorgant
  spell('Yann Kermorgant', 'BOU', 'Bournemouth', 7, '2015/16', '2015/16', ['https://en.wikipedia.org/wiki/Yann_Kermorgant', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Yaya Toure
  spell('Yaya Toure', 'MCI', 'Man City', 230, '2010/11', '2017/18', ['https://en.wikipedia.org/wiki/Yaya_Tour%C3%A9', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Yohan Cabaye
  spell('Yohan Cabaye', 'NEW', 'Newcastle', 79, '2011/12', '2013/14', ['https://en.wikipedia.org/wiki/Yohan_Cabaye', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),
  spell('Yohan Cabaye', 'CRY', 'Palace', 96, '2015/16', '2017/18', ['https://en.wikipedia.org/wiki/Yohan_Cabaye', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/crystal-palace/crystal-palace-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Erik Lamela
  spell('Erik Lamela', 'TOT', 'Spurs', 177, '2013/14', '2020/21', ['https://en.wikipedia.org/wiki/Erik_Lamela', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/tottenham-hotspur-premier-league-appearances/']),

  // Adam Hammill
  spell('Adam Hammill', 'WOL', 'Wolves', 19, '2010/11', '2011/12', ['https://en.wikipedia.org/wiki/Adam_Hammill', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Ben Mee
  spell('Ben Mee', 'BUR', 'Burnley', 33, '2014/15', '2014/15', ['https://en.wikipedia.org/wiki/Ben_Mee', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),
  spell('Ben Mee', 'BUR', 'Burnley', 184, '2016/17', '2021/22', ['https://en.wikipedia.org/wiki/Ben_Mee', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),
  spell('Ben Mee', 'BRE', 'Brentford', 60, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Ben_Mee', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/']),

  // Ben Pearson
  spell('Ben Pearson', 'BOU', 'Bournemouth', 7, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Ben_Pearson_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Benik Afobe
  spell('Benik Afobe', 'BOU', 'Bournemouth', 63, '2015/16', '2017/18', ['https://en.wikipedia.org/wiki/Benik_Afobe', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Charlie Daniels
  spell('Charlie Daniels', 'BOU', 'Bournemouth', 129, '2015/16', '2019/20', ['https://en.wikipedia.org/wiki/Charlie_Daniels_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Emmanuel Eboue
  spell('Emmanuel Eboue', 'ARS', 'Arsenal', 132, '2004/05', '2010/11', ['https://en.wikipedia.org/wiki/Emmanuel_Eboué', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Harry Toffolo
  spell('Harry Toffolo', 'NFO', 'Forest', 46, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Harry_Toffolo', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/nottingham-forest/nottingham-forest-premier-league-appearances/']),

  // Ian Brightwell
  spell('Ian Brightwell', 'MCI', 'Man City', 87, '1992/93', '1995/96', ['https://en.wikipedia.org/wiki/Ian_Brightwell', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/manchester-city/manchester-city-premier-league-appearances/']),

  // Illan Meslier
  spell('Illan Meslier', 'LEE', 'Leeds', 107, '2020/21', '2022/23', ['https://en.wikipedia.org/wiki/Illan_Meslier', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Isaac Hayden
  spell('Isaac Hayden', 'NEW', 'Newcastle', 118, '2017/18', '2022/23', ['https://en.wikipedia.org/wiki/Isaac_Hayden', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Jonas Lossl
  spell('Jonas Lossl', 'BRE', 'Brentford', 2, '2021/22', '2021/22', ['https://en.wikipedia.org/wiki/Jonas_Lössl', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/brentford-fc/brentford-fc-premier-league-appearances/']),

  // Lee Tomlin
  spell('Lee Tomlin', 'BOU', 'Bournemouth', 6, '2015/16', '2015/16', ['https://en.wikipedia.org/wiki/Lee_Tomlin', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Luke Ayling
  spell('Luke Ayling', 'LEE', 'Leeds', 93, '2020/21', '2022/23', ['https://en.wikipedia.org/wiki/Luke_Ayling', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/leeds-united/leeds-united-premier-league-appearances/']),

  // Mark Travers
  spell('Mark Travers', 'BOU', 'Bournemouth', 3, '2017/18', '2019/20', ['https://en.wikipedia.org/wiki/Mark_Travers', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),
  spell('Mark Travers', 'BOU', 'Bournemouth', 21, '2022/23', '2024/25', ['https://en.wikipedia.org/wiki/Mark_Travers', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/']),

  // Mike Williamson
  spell('Mike Williamson', 'NEW', 'Newcastle', 134, '2010/11', '2015/16', ['https://en.wikipedia.org/wiki/Mike_Williamson_(footballer)', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/newcastle-united/newcastle-united-premier-league-appearances/']),

  // Moritz Volz
  spell('Moritz Volz', 'FUL', 'Fulham', 125, '2003/04', '2007/08', ['https://en.wikipedia.org/wiki/Moritz_Volz', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/fulham/fulham-fc-premier-league-appearances/']),

  // Richard Stearman
  spell('Richard Stearman', 'WOL', 'Wolves', 77, '2009/10', '2011/12', ['https://en.wikipedia.org/wiki/Richard_Stearman', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),

  // Rob Holding
  spell('Rob Holding', 'ARS', 'Arsenal', 98, '2016/17', '2023/24', ['https://en.wikipedia.org/wiki/Rob_Holding', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Ryan Fredericks
  spell('Ryan Fredericks', 'WHU', 'West Ham', 63, '2018/19', '2021/22', ['https://en.wikipedia.org/wiki/Ryan_Fredericks', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),
  spell('Ryan Fredericks', 'BOU', 'Bournemouth', 12, '2022/23', '2022/23', ['https://en.wikipedia.org/wiki/Ryan_Fredericks', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/afc-bournemouth/afc-bournemouth-premier-league-appearances/', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/']),

  // Shkodran Mustafi
  spell('Shkodran Mustafi', 'ARS', 'Arsenal', 102, '2016/17', '2020/21', ['https://en.wikipedia.org/wiki/Shkodran_Mustafi', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/appearances/arsenal-fc-premier-league-appearances/']),

  // Sylvan Ebanks-Blake
  spell('Sylvan Ebanks-Blake', 'WOL', 'Wolves', 76, '2009/10', '2011/12', ['https://en.wikipedia.org/wiki/Sylvan_Ebanks-Blake', 'https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/']),
  // Abdoulaye Doucoure
  spell('Abdoulaye Doucoure', 'WAT', 'Watford', 129, '2016/17', '2019/20', ["https://en.wikipedia.org/wiki/Abdoulaye_Doucour%C3%A9", "https://fbref.com/en/players/02b29014/Abdoulaye-Doucoure"]),
  spell('Abdoulaye Doucoure', 'EVE', 'Everton', 149, '2020/21', '2024/25', ["https://en.wikipedia.org/wiki/Abdoulaye_Doucour%C3%A9", "https://fbref.com/en/players/02b29014/Abdoulaye-Doucoure"]),

  // Adam Federici
  spell('Adam Federici', 'REA', 'Reading', 2, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Adam_Federici", "https://fbref.com/en/players/e5ea8be7/Adam-Federici"]),
  spell('Adam Federici', 'REA', 'Reading', 21, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Adam_Federici", "https://fbref.com/en/players/e5ea8be7/Adam-Federici"]),
  spell('Adam Federici', 'BOU', 'Bournemouth', 8, '2015/16', '2016/17', ["https://en.wikipedia.org/wiki/Adam_Federici", "https://fbref.com/en/players/e5ea8be7/Adam-Federici"]),

  // Adam Forshaw
  spell('Adam Forshaw', 'EVE', 'Everton', 1, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Adam_Forshaw", "https://fbref.com/en/players/9f1938ab/Adam-Forshaw"]),
  spell('Adam Forshaw', 'MID', 'Middlesbrough', 34, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Adam_Forshaw", "https://fbref.com/en/players/9f1938ab/Adam-Forshaw"]),
  spell('Adam Forshaw', 'LEE', 'Leeds', 34, '2021/22', '2022/23', ["https://en.wikipedia.org/wiki/Adam_Forshaw", "https://fbref.com/en/players/9f1938ab/Adam-Forshaw"]),

  // Adam Johnson
  spell('Adam Johnson', 'MID', 'Middlesbrough', 70, '2005/06', '2008/09', ["https://en.wikipedia.org/wiki/Adam_Johnson_(footballer)", "https://fbref.com/en/players/1ba61951/Adam-Johnson"]),
  spell('Adam Johnson', 'MCI', 'Man City', 73, '2009/10', '2011/12', ["https://en.wikipedia.org/wiki/Adam_Johnson_(footballer)", "https://fbref.com/en/players/1ba61951/Adam-Johnson"]),
  spell('Adam Johnson', 'SUN', 'Sunderland', 122, '2012/13', '2015/16', ["https://en.wikipedia.org/wiki/Adam_Johnson_(footballer)", "https://fbref.com/en/players/1ba61951/Adam-Johnson"]),

  // Ademola Lookman
  spell('Ademola Lookman', 'EVE', 'Everton', 36, '2016/17', '2018/19', ["https://en.wikipedia.org/wiki/Ademola_Lookman", "https://fbref.com/en/players/7c104bb7/Ademola-Lookman"]),
  spell('Ademola Lookman', 'FUL', 'Fulham', 34, '2020/21', '2020/21', ["https://en.wikipedia.org/wiki/Ademola_Lookman", "https://fbref.com/en/players/7c104bb7/Ademola-Lookman"]),
  spell('Ademola Lookman', 'LEI', 'Leicester', 26, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Ademola_Lookman", "https://fbref.com/en/players/7c104bb7/Ademola-Lookman"]),

  // Adnan Januzaj
  spell('Adnan Januzaj', 'MUN', 'Man United', 50, '2013/14', '2015/16', ["https://en.wikipedia.org/wiki/Adnan_Januzaj", "https://fbref.com/en/players/4737cebe/Adnan-Januzaj"]),
  spell('Adnan Januzaj', 'SUN', 'Sunderland', 25, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Adnan_Januzaj", "https://fbref.com/en/players/4737cebe/Adnan-Januzaj"]),

  // Adrian Mariappa
  spell('Adrian Mariappa', 'WAT', 'Watford', 19, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Adrian_Mariappa", "https://fbref.com/en/players/8aa5f52c/Adrian-Mariappa"]),
  spell('Adrian Mariappa', 'WAT', 'Watford', 81, '2016/17', '2019/20', ["https://en.wikipedia.org/wiki/Adrian_Mariappa", "https://fbref.com/en/players/8aa5f52c/Adrian-Mariappa"]),
  spell('Adrian Mariappa', 'REA', 'Reading', 29, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Adrian_Mariappa", "https://fbref.com/en/players/8aa5f52c/Adrian-Mariappa"]),
  spell('Adrian Mariappa', 'CRY', 'Palace', 39, '2013/14', '2015/16', ["https://en.wikipedia.org/wiki/Adrian_Mariappa", "https://fbref.com/en/players/8aa5f52c/Adrian-Mariappa"]),

  // Aki Riihilahti
  spell('Aki Riihilahti', 'CRY', 'Palace', 31, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Aki_Riihilahti", "https://fbref.com/en/players/27da5710/Aki-Riihilahti"]),

  // Aleksandar Mitrovic
  spell('Aleksandar Mitrovic', 'NEW', 'Newcastle', 34, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Aleksandar_Mitrovi%C4%87", "https://fbref.com/en/players/3925dbd6/Aleksandar-Mitrovic"]),
  spell('Aleksandar Mitrovic', 'NEW', 'Newcastle', 6, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Aleksandar_Mitrovi%C4%87", "https://fbref.com/en/players/3925dbd6/Aleksandar-Mitrovic"]),
  spell('Aleksandar Mitrovic', 'FUL', 'Fulham', 37, '2018/19', '2018/19', ["https://en.wikipedia.org/wiki/Aleksandar_Mitrovi%C4%87", "https://fbref.com/en/players/3925dbd6/Aleksandar-Mitrovic"]),
  spell('Aleksandar Mitrovic', 'FUL', 'Fulham', 27, '2020/21', '2020/21', ["https://en.wikipedia.org/wiki/Aleksandar_Mitrovi%C4%87", "https://fbref.com/en/players/3925dbd6/Aleksandar-Mitrovic"]),
  spell('Aleksandar Mitrovic', 'FUL', 'Fulham', 25, '2022/23', '2023/24', ["https://en.wikipedia.org/wiki/Aleksandar_Mitrovi%C4%87", "https://fbref.com/en/players/3925dbd6/Aleksandar-Mitrovic"]),

  // Alex Song
  spell('Alex Song', 'ARS', 'Arsenal', 138, '2005/06', '2011/12', ["https://en.wikipedia.org/wiki/Alex_Song", "https://fbref.com/en/players/1c32281d/Alexandre-Song"]),
  spell('Alex Song', 'CHA', 'Charlton', 12, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Alex_Song", "https://fbref.com/en/players/1c32281d/Alexandre-Song"]),
  spell('Alex Song', 'WHU', 'West Ham', 40, '2014/15', '2015/16', ["https://en.wikipedia.org/wiki/Alex_Song", "https://fbref.com/en/players/1c32281d/Alexandre-Song"]),

  // Andreas Pereira
  spell('Andreas Pereira', 'MUN', 'Man United', 5, '2014/15', '2015/16', ["https://en.wikipedia.org/wiki/Andreas_Pereira", "https://fbref.com/en/players/6639e500/Andreas-Pereira"]),
  spell('Andreas Pereira', 'MUN', 'Man United', 40, '2018/19', '2019/20', ["https://en.wikipedia.org/wiki/Andreas_Pereira", "https://fbref.com/en/players/6639e500/Andreas-Pereira"]),
  spell('Andreas Pereira', 'FUL', 'Fulham', 103, '2022/23', '2024/25', ["https://en.wikipedia.org/wiki/Andreas_Pereira", "https://fbref.com/en/players/6639e500/Andreas-Pereira"]),

  // Andrew Omobamidele
  spell('Andrew Omobamidele', 'NOR', 'Norwich', 5, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Andrew_Omobamidele", "https://fbref.com/en/players/c393a6c4/Andrew-Omobamidele"]),
  spell('Andrew Omobamidele', 'NFO', 'Forest', 11, '2023/24', '2023/24', ["https://en.wikipedia.org/wiki/Andrew_Omobamidele", "https://fbref.com/en/players/c393a6c4/Andrew-Omobamidele"]),

  // Andros Townsend
  spell('Andros Townsend', 'TOT', 'Spurs', 50, '2012/13', '2015/16', ["https://en.wikipedia.org/wiki/Andros_Townsend", "https://fbref.com/en/players/b28bbd58/Andros-Townsend"]),
  spell('Andros Townsend', 'QPR', 'QPR', 12, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Andros_Townsend", "https://fbref.com/en/players/b28bbd58/Andros-Townsend"]),
  spell('Andros Townsend', 'NEW', 'Newcastle', 13, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Andros_Townsend", "https://fbref.com/en/players/b28bbd58/Andros-Townsend"]),
  spell('Andros Townsend', 'CRY', 'Palace', 168, '2016/17', '2020/21', ["https://en.wikipedia.org/wiki/Andros_Townsend", "https://fbref.com/en/players/b28bbd58/Andros-Townsend"]),
  spell('Andros Townsend', 'EVE', 'Everton', 21, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Andros_Townsend", "https://fbref.com/en/players/b28bbd58/Andros-Townsend"]),
  spell('Andros Townsend', 'LUT', 'Luton', 27, '2023/24', '2023/24', ["https://en.wikipedia.org/wiki/Andros_Townsend", "https://fbref.com/en/players/b28bbd58/Andros-Townsend"]),

  // Andre Ayew
  spell('Andre Ayew', 'SWA', 'Swansea', 34, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Andr%C3%A9_Ayew", "https://fbref.com/en/players/5dbefa9d/Andre-Ayew"]),
  spell('Andre Ayew', 'SWA', 'Swansea', 12, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Andr%C3%A9_Ayew", "https://fbref.com/en/players/5dbefa9d/Andre-Ayew"]),
  spell('Andre Ayew', 'WHU', 'West Ham', 43, '2016/17', '2017/18', ["https://en.wikipedia.org/wiki/Andr%C3%A9_Ayew", "https://fbref.com/en/players/5dbefa9d/Andre-Ayew"]),
  spell('Andre Ayew', 'NFO', 'Forest', 13, '2022/23', '2022/23', ["https://en.wikipedia.org/wiki/Andr%C3%A9_Ayew", "https://fbref.com/en/players/5dbefa9d/Andre-Ayew"]),

  // Andre Bikey
  spell('Andre Bikey', 'REA', 'Reading', 37, '2006/07', '2007/08', ["https://en.wikipedia.org/wiki/Andr%C3%A9_Bikey", "https://fbref.com/en/players/2c3ab6dd/Andre-Bikey"]),
  spell('Andre Bikey', 'BUR', 'Burnley', 28, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Andr%C3%A9_Bikey", "https://fbref.com/en/players/2c3ab6dd/Andre-Bikey"]),

  // Andy Carroll
  spell('Andy Carroll', 'NEW', 'Newcastle', 22, '2006/07', '2008/09', ["https://en.wikipedia.org/wiki/Andy_Carroll", "https://fbref.com/en/players/b581987a/Andy-Carroll"]),
  spell('Andy Carroll', 'NEW', 'Newcastle', 19, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Andy_Carroll", "https://fbref.com/en/players/b581987a/Andy-Carroll"]),
  spell('Andy Carroll', 'NEW', 'Newcastle', 37, '2019/20', '2020/21', ["https://en.wikipedia.org/wiki/Andy_Carroll", "https://fbref.com/en/players/b581987a/Andy-Carroll"]),
  spell('Andy Carroll', 'LIV', 'Liverpool', 44, '2010/11', '2012/13', ["https://en.wikipedia.org/wiki/Andy_Carroll", "https://fbref.com/en/players/b581987a/Andy-Carroll"]),
  spell('Andy Carroll', 'WHU', 'West Ham', 126, '2012/13', '2018/19', ["https://en.wikipedia.org/wiki/Andy_Carroll", "https://fbref.com/en/players/b581987a/Andy-Carroll"]),

  // Andy Myers
  spell('Andy Myers', 'CHE', 'Chelsea', 70, '1992/93', '1998/99', ["https://en.wikipedia.org/wiki/Andy_Myers", "https://fbref.com/en/players/e5b54539/Andy-Myers"]),
  spell('Andy Myers', 'BRD', 'Bradford', 33, '1999/00', '2000/01', ["https://en.wikipedia.org/wiki/Andy_Myers", "https://fbref.com/en/players/e5b54539/Andy-Myers"]),

  // Anthony Gardner
  spell('Anthony Gardner', 'TOT', 'Spurs', 114, '2000/01', '2007/08', ["https://en.wikipedia.org/wiki/Anthony_Gardner", "https://fbref.com/en/players/0f2da318/Anthony-Gardner"]),
  spell('Anthony Gardner', 'HUL', 'Hull', 30, '2008/09', '2009/10', ["https://en.wikipedia.org/wiki/Anthony_Gardner", "https://fbref.com/en/players/0f2da318/Anthony-Gardner"]),

  // Anthony Knockaert
  spell('Anthony Knockaert', 'LEI', 'Leicester', 9, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Anthony_Knockaert", "https://fbref.com/en/players/6c679c6d/Anthony-Knockaert"]),
  spell('Anthony Knockaert', 'BHA', 'Brighton', 63, '2017/18', '2018/19', ["https://en.wikipedia.org/wiki/Anthony_Knockaert", "https://fbref.com/en/players/6c679c6d/Anthony-Knockaert"]),

  // Anton Ferdinand
  spell('Anton Ferdinand', 'WHU', 'West Ham', 89, '2005/06', '2007/08', ["https://en.wikipedia.org/wiki/Anton_Ferdinand", "https://fbref.com/en/players/d1891093/Anton-Ferdinand"]),
  spell('Anton Ferdinand', 'SUN', 'Sunderland', 85, '2008/09', '2011/12', ["https://en.wikipedia.org/wiki/Anton_Ferdinand", "https://fbref.com/en/players/d1891093/Anton-Ferdinand"]),
  spell('Anton Ferdinand', 'QPR', 'QPR', 44, '2011/12', '2012/13', ["https://en.wikipedia.org/wiki/Anton_Ferdinand", "https://fbref.com/en/players/d1891093/Anton-Ferdinand"]),

  // Anwar El Ghazi
  spell('Anwar El Ghazi', 'AVL', 'Aston Villa', 71, '2019/20', '2021/22', ["https://en.wikipedia.org/wiki/Anwar_El_Ghazi", "https://fbref.com/en/players/ffa90327/Anwar-El-Ghazi"]),
  spell('Anwar El Ghazi', 'EVE', 'Everton', 2, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Anwar_El_Ghazi", "https://fbref.com/en/players/ffa90327/Anwar-El-Ghazi"]),

  // Arnaut Danjuma
  spell('Arnaut Danjuma', 'BOU', 'Bournemouth', 14, '2019/20', '2019/20', ["https://en.wikipedia.org/wiki/Arnaut_Danjuma", "https://fbref.com/en/players/f08490a6/Arnaut-Danjuma"]),
  spell('Arnaut Danjuma', 'TOT', 'Spurs', 9, '2022/23', '2022/23', ["https://en.wikipedia.org/wiki/Arnaut_Danjuma", "https://fbref.com/en/players/f08490a6/Arnaut-Danjuma"]),
  spell('Arnaut Danjuma', 'EVE', 'Everton', 14, '2023/24', '2023/24', ["https://en.wikipedia.org/wiki/Arnaut_Danjuma", "https://fbref.com/en/players/f08490a6/Arnaut-Danjuma"]),

  // Ashley Young
  spell('Ashley Young', 'WAT', 'Watford', 20, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Ashley_Young", "https://fbref.com/en/players/be927d03/Ashley-Young"]),
  spell('Ashley Young', 'AVL', 'Aston Villa', 157, '2006/07', '2010/11', ["https://en.wikipedia.org/wiki/Ashley_Young", "https://fbref.com/en/players/be927d03/Ashley-Young"]),
  spell('Ashley Young', 'AVL', 'Aston Villa', 53, '2021/22', '2022/23', ["https://en.wikipedia.org/wiki/Ashley_Young", "https://fbref.com/en/players/be927d03/Ashley-Young"]),
  spell('Ashley Young', 'MUN', 'Man United', 192, '2011/12', '2019/20', ["https://en.wikipedia.org/wiki/Ashley_Young", "https://fbref.com/en/players/be927d03/Ashley-Young"]),
  spell('Ashley Young', 'EVE', 'Everton', 63, '2023/24', '2024/25', ["https://en.wikipedia.org/wiki/Ashley_Young", "https://fbref.com/en/players/be927d03/Ashley-Young"]),

  // Asmir Begovic
  spell('Asmir Begovic', 'POR', 'Portsmouth', 11, '2008/09', '2009/10', ["https://en.wikipedia.org/wiki/Asmir_Begovi%C4%87", "https://fbref.com/en/players/7b4de647/Asmir-Begovic"]),
  spell('Asmir Begovic', 'STK', 'Stoke', 160, '2009/10', '2014/15', ["https://en.wikipedia.org/wiki/Asmir_Begovi%C4%87", "https://fbref.com/en/players/7b4de647/Asmir-Begovic"]),
  spell('Asmir Begovic', 'CHE', 'Chelsea', 19, '2015/16', '2016/17', ["https://en.wikipedia.org/wiki/Asmir_Begovi%C4%87", "https://fbref.com/en/players/7b4de647/Asmir-Begovic"]),
  spell('Asmir Begovic', 'BOU', 'Bournemouth', 62, '2017/18', '2018/19', ["https://en.wikipedia.org/wiki/Asmir_Begovi%C4%87", "https://fbref.com/en/players/7b4de647/Asmir-Begovic"]),
  spell('Asmir Begovic', 'EVE', 'Everton', 4, '2021/22', '2022/23', ["https://en.wikipedia.org/wiki/Asmir_Begovi%C4%87", "https://fbref.com/en/players/7b4de647/Asmir-Begovic"]),

  // Barry Bannan
  spell('Barry Bannan', 'AVL', 'Aston Villa', 64, '2010/11', '2012/13', ["https://en.wikipedia.org/wiki/Barry_Bannan", "https://fbref.com/en/players/9469fb13/Barry-Bannan"]),
  spell('Barry Bannan', 'CRY', 'Palace', 22, '2013/14', '2014/15', ["https://en.wikipedia.org/wiki/Barry_Bannan", "https://fbref.com/en/players/9469fb13/Barry-Bannan"]),

  // Barry Horne
  spell('Barry Horne', 'EVE', 'Everton', 123, '1992/93', '1995/96', ["https://en.wikipedia.org/wiki/Barry_Horne_(footballer)", "https://fbref.com/en/players/2c1d83f7/Barry-Horne"]),
  spell('Barry Horne', 'SHW', 'Sheffield Wednesday', 7, '1999/00', '1999/00', ["https://en.wikipedia.org/wiki/Barry_Horne_(footballer)", "https://fbref.com/en/players/2c1d83f7/Barry-Horne"]),

  // Ben Godfrey
  spell('Ben Godfrey', 'NOR', 'Norwich', 30, '2019/20', '2019/20', ["https://en.wikipedia.org/wiki/Ben_Godfrey", "https://fbref.com/en/players/9f7c837d/Ben-Godfrey"]),
  spell('Ben Godfrey', 'EVE', 'Everton', 82, '2020/21', '2023/24', ["https://en.wikipedia.org/wiki/Ben_Godfrey", "https://fbref.com/en/players/9f7c837d/Ben-Godfrey"]),
  spell('Ben Godfrey', 'IPS', 'Ipswich', 3, '2024/25', '2024/25', ["https://en.wikipedia.org/wiki/Ben_Godfrey", "https://fbref.com/en/players/9f7c837d/Ben-Godfrey"]),

  // Billy Gilmour
  spell('Billy Gilmour', 'CHE', 'Chelsea', 11, '2019/20', '2020/21', ["https://en.wikipedia.org/wiki/Billy_Gilmour", "https://fbref.com/en/players/df10e27c/Billy-Gilmour"]),
  spell('Billy Gilmour', 'NOR', 'Norwich', 24, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Billy_Gilmour", "https://fbref.com/en/players/df10e27c/Billy-Gilmour"]),
  spell('Billy Gilmour', 'BHA', 'Brighton', 46, '2022/23', '2024/25', ["https://en.wikipedia.org/wiki/Billy_Gilmour", "https://fbref.com/en/players/df10e27c/Billy-Gilmour"]),

  // Bobby Zamora
  spell('Bobby Zamora', 'TOT', 'Spurs', 16, '2003/04', '2003/04', ["https://en.wikipedia.org/wiki/Bobby_Zamora", "https://fbref.com/en/players/7ddb3563/Bobby-Zamora"]),
  spell('Bobby Zamora', 'WHU', 'West Ham', 79, '2005/06', '2007/08', ["https://en.wikipedia.org/wiki/Bobby_Zamora", "https://fbref.com/en/players/7ddb3563/Bobby-Zamora"]),
  spell('Bobby Zamora', 'FUL', 'Fulham', 91, '2008/09', '2011/12', ["https://en.wikipedia.org/wiki/Bobby_Zamora", "https://fbref.com/en/players/7ddb3563/Bobby-Zamora"]),
  spell('Bobby Zamora', 'QPR', 'QPR', 35, '2011/12', '2012/13', ["https://en.wikipedia.org/wiki/Bobby_Zamora", "https://fbref.com/en/players/7ddb3563/Bobby-Zamora"]),
  spell('Bobby Zamora', 'QPR', 'QPR', 31, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Bobby_Zamora", "https://fbref.com/en/players/7ddb3563/Bobby-Zamora"]),

  // Branislav Ivanovic
  spell('Branislav Ivanovic', 'CHE', 'Chelsea', 261, '2008/09', '2016/17', ["https://en.wikipedia.org/wiki/Branislav_Ivanovi%C4%87", "https://fbref.com/en/players/85f8571a/Branislav-Ivanovic"]),
  spell('Branislav Ivanovic', 'WBA', 'West Brom', 13, '2020/21', '2020/21', ["https://en.wikipedia.org/wiki/Branislav_Ivanovi%C4%87", "https://fbref.com/en/players/85f8571a/Branislav-Ivanovic"]),

  // Brian Deane
  spell('Brian Deane', 'SHU', 'Sheffield United', 41, '1992/93', '1992/93', ["https://en.wikipedia.org/wiki/Brian_Deane", "https://fbref.com/en/players/909a4bb4/Brian-Deane"]),
  spell('Brian Deane', 'LEE', 'Leeds', 138, '1993/94', '1996/97', ["https://en.wikipedia.org/wiki/Brian_Deane", "https://fbref.com/en/players/909a4bb4/Brian-Deane"]),
  spell('Brian Deane', 'MID', 'Middlesbrough', 87, '1998/99', '2001/02', ["https://en.wikipedia.org/wiki/Brian_Deane", "https://fbref.com/en/players/909a4bb4/Brian-Deane"]),
  spell('Brian Deane', 'LEI', 'Leicester', 15, '2001/02', '2001/02', ["https://en.wikipedia.org/wiki/Brian_Deane", "https://fbref.com/en/players/909a4bb4/Brian-Deane"]),
  spell('Brian Deane', 'LEI', 'Leicester', 5, '2003/04', '2003/04', ["https://en.wikipedia.org/wiki/Brian_Deane", "https://fbref.com/en/players/909a4bb4/Brian-Deane"]),

  // Calum Chambers
  spell('Calum Chambers', 'SOU', 'Southampton', 22, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Calum_Chambers", "https://fbref.com/en/players/dc6f5bdd/Calum-Chambers"]),
  spell('Calum Chambers', 'ARS', 'Arsenal', 48, '2014/15', '2017/18', ["https://en.wikipedia.org/wiki/Calum_Chambers", "https://fbref.com/en/players/dc6f5bdd/Calum-Chambers"]),
  spell('Calum Chambers', 'ARS', 'Arsenal', 26, '2019/20', '2021/22', ["https://en.wikipedia.org/wiki/Calum_Chambers", "https://fbref.com/en/players/dc6f5bdd/Calum-Chambers"]),
  spell('Calum Chambers', 'MID', 'Middlesbrough', 24, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Calum_Chambers", "https://fbref.com/en/players/dc6f5bdd/Calum-Chambers"]),
  spell('Calum Chambers', 'FUL', 'Fulham', 31, '2018/19', '2018/19', ["https://en.wikipedia.org/wiki/Calum_Chambers", "https://fbref.com/en/players/dc6f5bdd/Calum-Chambers"]),
  spell('Calum Chambers', 'AVL', 'Aston Villa', 30, '2021/22', '2023/24', ["https://en.wikipedia.org/wiki/Calum_Chambers", "https://fbref.com/en/players/dc6f5bdd/Calum-Chambers"]),

  // Cameron Jerome
  spell('Cameron Jerome', 'BIR', 'Birmingham', 33, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Cameron_Jerome", "https://fbref.com/en/players/680fb5ee/Cameron-Jerome"]),
  spell('Cameron Jerome', 'BIR', 'Birmingham', 66, '2009/10', '2010/11', ["https://en.wikipedia.org/wiki/Cameron_Jerome", "https://fbref.com/en/players/680fb5ee/Cameron-Jerome"]),
  spell('Cameron Jerome', 'STK', 'Stoke', 50, '2011/12', '2013/14', ["https://en.wikipedia.org/wiki/Cameron_Jerome", "https://fbref.com/en/players/680fb5ee/Cameron-Jerome"]),
  spell('Cameron Jerome', 'CRY', 'Palace', 28, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Cameron_Jerome", "https://fbref.com/en/players/680fb5ee/Cameron-Jerome"]),
  spell('Cameron Jerome', 'NOR', 'Norwich', 34, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Cameron_Jerome", "https://fbref.com/en/players/680fb5ee/Cameron-Jerome"]),

  // Carlo Cudicini
  spell('Carlo Cudicini', 'CHE', 'Chelsea', 142, '1999/00', '2008/09', ["https://en.wikipedia.org/wiki/Carlo_Cudicini", "https://fbref.com/en/players/df77463a/Carlo-Cudicini"]),
  spell('Carlo Cudicini', 'TOT', 'Spurs', 19, '2008/09', '2010/11', ["https://en.wikipedia.org/wiki/Carlo_Cudicini", "https://fbref.com/en/players/df77463a/Carlo-Cudicini"]),

  // Carlton Cole
  spell('Carlton Cole', 'CHE', 'Chelsea', 16, '2001/02', '2002/03', ["https://en.wikipedia.org/wiki/Carlton_Cole", "https://fbref.com/en/players/51b2effb/Carlton-Cole"]),
  spell('Carlton Cole', 'CHE', 'Chelsea', 9, '2005/06', '2005/06', ["https://en.wikipedia.org/wiki/Carlton_Cole", "https://fbref.com/en/players/51b2effb/Carlton-Cole"]),
  spell('Carlton Cole', 'CHA', 'Charlton', 21, '2003/04', '2003/04', ["https://en.wikipedia.org/wiki/Carlton_Cole", "https://fbref.com/en/players/51b2effb/Carlton-Cole"]),
  spell('Carlton Cole', 'AVL', 'Aston Villa', 27, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Carlton_Cole", "https://fbref.com/en/players/51b2effb/Carlton-Cole"]),
  spell('Carlton Cole', 'WHU', 'West Ham', 140, '2006/07', '2010/11', ["https://en.wikipedia.org/wiki/Carlton_Cole", "https://fbref.com/en/players/51b2effb/Carlton-Cole"]),
  spell('Carlton Cole', 'WHU', 'West Ham', 76, '2012/13', '2014/15', ["https://en.wikipedia.org/wiki/Carlton_Cole", "https://fbref.com/en/players/51b2effb/Carlton-Cole"]),
  // Chris Baird
  spell('Chris Baird', 'SOU', 'Southampton', 7, '2002/03', '2003/04', ["https://en.wikipedia.org/wiki/Chris_Baird", "https://fbref.com/en/players/55fd8c81/Chris-Baird"]),
  spell('Chris Baird', 'FUL', 'Fulham', 127, '2007/08', '2012/13', ["https://en.wikipedia.org/wiki/Chris_Baird", "https://fbref.com/en/players/55fd8c81/Chris-Baird"]),
  spell('Chris Baird', 'WBA', 'West Brom', 19, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Chris_Baird", "https://fbref.com/en/players/55fd8c81/Chris-Baird"]),

  // Chris Bart-Williams
  spell('Chris Bart-Williams', 'SHW', 'Sheffield Wednesday', 109, '1992/93', '1994/95', ["https://en.wikipedia.org/wiki/Chris_Bart-Williams", "https://fbref.com/en/players/250d1973/Chris-Bart-Williams"]),
  spell('Chris Bart-Williams', 'NFO', 'Forest', 49, '1995/96', '1996/97', ["https://en.wikipedia.org/wiki/Chris_Bart-Williams", "https://fbref.com/en/players/250d1973/Chris-Bart-Williams"]),
  spell('Chris Bart-Williams', 'NFO', 'Forest', 24, '1998/99', '1998/99', ["https://en.wikipedia.org/wiki/Chris_Bart-Williams", "https://fbref.com/en/players/250d1973/Chris-Bart-Williams"]),
  spell('Chris Bart-Williams', 'CHA', 'Charlton', 29, '2001/02', '2002/03', ["https://en.wikipedia.org/wiki/Chris_Bart-Williams", "https://fbref.com/en/players/250d1973/Chris-Bart-Williams"]),

  // Chris Eagles
  spell('Chris Eagles', 'MUN', 'Man United', 6, '2006/07', '2007/08', ["https://en.wikipedia.org/wiki/Chris_Eagles", "https://fbref.com/en/players/92aadee9/Chris-Eagles"]),
  spell('Chris Eagles', 'BUR', 'Burnley', 34, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Chris_Eagles", "https://fbref.com/en/players/92aadee9/Chris-Eagles"]),
  spell('Chris Eagles', 'BOL', 'Bolton', 34, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Chris_Eagles", "https://fbref.com/en/players/92aadee9/Chris-Eagles"]),

  // Chris Smalling
  spell('Chris Smalling', 'FUL', 'Fulham', 13, '2008/09', '2009/10', ["https://en.wikipedia.org/wiki/Chris_Smalling", "https://fbref.com/en/players/b6964eb6/Chris-Smalling"]),
  spell('Chris Smalling', 'MUN', 'Man United', 206, '2010/11', '2018/19', ["https://en.wikipedia.org/wiki/Chris_Smalling", "https://fbref.com/en/players/b6964eb6/Chris-Smalling"]),

  // Christian Atsu
  spell('Christian Atsu', 'EVE', 'Everton', 5, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Christian_Atsu", "https://fbref.com/en/players/8816329f/Christian-Atsu"]),
  spell('Christian Atsu', 'NEW', 'Newcastle', 75, '2017/18', '2019/20', ["https://en.wikipedia.org/wiki/Christian_Atsu", "https://fbref.com/en/players/8816329f/Christian-Atsu"]),

  // Christian Benteke
  spell('Christian Benteke', 'AVL', 'Aston Villa', 89, '2012/13', '2014/15', ["https://en.wikipedia.org/wiki/Christian_Benteke", "https://fbref.com/en/players/ab070c55/Christian-Benteke"]),
  spell('Christian Benteke', 'LIV', 'Liverpool', 29, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Christian_Benteke", "https://fbref.com/en/players/ab070c55/Christian-Benteke"]),
  spell('Christian Benteke', 'CRY', 'Palace', 162, '2016/17', '2021/22', ["https://en.wikipedia.org/wiki/Christian_Benteke", "https://fbref.com/en/players/ab070c55/Christian-Benteke"]),

  // Clarke Carlisle
  spell('Clarke Carlisle', 'WAT', 'Watford', 4, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Clarke_Carlisle", "https://fbref.com/en/players/4128d875/Clarke-Carlisle"]),
  spell('Clarke Carlisle', 'BUR', 'Burnley', 27, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Clarke_Carlisle", "https://fbref.com/en/players/4128d875/Clarke-Carlisle"]),

  // Clint Dempsey
  spell('Clint Dempsey', 'FUL', 'Fulham', 184, '2006/07', '2011/12', ["https://en.wikipedia.org/wiki/Clint_Dempsey", "https://fbref.com/en/players/523d9de6/Clint-Dempsey"]),
  spell('Clint Dempsey', 'FUL', 'Fulham', 5, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Clint_Dempsey", "https://fbref.com/en/players/523d9de6/Clint-Dempsey"]),
  spell('Clint Dempsey', 'TOT', 'Spurs', 29, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Clint_Dempsey", "https://fbref.com/en/players/523d9de6/Clint-Dempsey"]),

  // Colin Cooper
  spell('Colin Cooper', 'NFO', 'Forest', 108, '1994/95', '1996/97', ["https://en.wikipedia.org/wiki/Colin_Cooper", "https://fbref.com/en/players/42f93b8f/Colin-Cooper"]),
  spell('Colin Cooper', 'MID', 'Middlesbrough', 158, '1998/99', '2005/06', ["https://en.wikipedia.org/wiki/Colin_Cooper", "https://fbref.com/en/players/42f93b8f/Colin-Cooper"]),

  // Connor Wickham
  spell('Connor Wickham', 'SUN', 'Sunderland', 79, '2011/12', '2014/15', ["https://en.wikipedia.org/wiki/Connor_Wickham", "https://fbref.com/en/players/41cc19c2/Connor-Wickham"]),
  spell('Connor Wickham', 'CRY', 'Palace', 29, '2015/16', '2016/17', ["https://en.wikipedia.org/wiki/Connor_Wickham", "https://fbref.com/en/players/41cc19c2/Connor-Wickham"]),
  spell('Connor Wickham', 'CRY', 'Palace', 12, '2018/19', '2019/20', ["https://en.wikipedia.org/wiki/Connor_Wickham", "https://fbref.com/en/players/41cc19c2/Connor-Wickham"]),

  // Conor Coady
  spell('Conor Coady', 'LIV', 'Liverpool', 1, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Conor_Coady", "https://fbref.com/en/players/2928dca2/Conor-Coady"]),
  spell('Conor Coady', 'WOL', 'Wolves', 151, '2018/19', '2021/22', ["https://en.wikipedia.org/wiki/Conor_Coady", "https://fbref.com/en/players/2928dca2/Conor-Coady"]),
  spell('Conor Coady', 'EVE', 'Everton', 24, '2022/23', '2022/23', ["https://en.wikipedia.org/wiki/Conor_Coady", "https://fbref.com/en/players/2928dca2/Conor-Coady"]),
  spell('Conor Coady', 'LEI', 'Leicester', 22, '2024/25', '2024/25', ["https://en.wikipedia.org/wiki/Conor_Coady", "https://fbref.com/en/players/2928dca2/Conor-Coady"]),

  // Craig Gardner
  spell('Craig Gardner', 'AVL', 'Aston Villa', 59, '2005/06', '2009/10', ["https://en.wikipedia.org/wiki/Craig_Gardner", "https://fbref.com/en/players/1117b9ff/Craig-Gardner"]),
  spell('Craig Gardner', 'BIR', 'Birmingham', 42, '2009/10', '2010/11', ["https://en.wikipedia.org/wiki/Craig_Gardner", "https://fbref.com/en/players/1117b9ff/Craig-Gardner"]),
  spell('Craig Gardner', 'SUN', 'Sunderland', 81, '2011/12', '2013/14', ["https://en.wikipedia.org/wiki/Craig_Gardner", "https://fbref.com/en/players/1117b9ff/Craig-Gardner"]),
  spell('Craig Gardner', 'WBA', 'West Brom', 78, '2014/15', '2016/17', ["https://en.wikipedia.org/wiki/Craig_Gardner", "https://fbref.com/en/players/1117b9ff/Craig-Gardner"]),

  // Dan Gosling
  spell('Dan Gosling', 'EVE', 'Everton', 22, '2008/09', '2009/10', ["https://en.wikipedia.org/wiki/Dan_Gosling", "https://fbref.com/en/players/7fec31a0/Dan-Gosling"]),
  spell('Dan Gosling', 'NEW', 'Newcastle', 24, '2010/11', '2013/14', ["https://en.wikipedia.org/wiki/Dan_Gosling", "https://fbref.com/en/players/7fec31a0/Dan-Gosling"]),
  spell('Dan Gosling', 'BOU', 'Bournemouth', 138, '2015/16', '2019/20', ["https://en.wikipedia.org/wiki/Dan_Gosling", "https://fbref.com/en/players/7fec31a0/Dan-Gosling"]),
  spell('Dan Gosling', 'WAT', 'Watford', 4, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Dan_Gosling", "https://fbref.com/en/players/7fec31a0/Dan-Gosling"]),

  // Dan Petrescu
  spell('Dan Petrescu', 'SHW', 'Sheffield Wednesday', 37, '1994/95', '1995/96', ["https://en.wikipedia.org/wiki/Dan_Petrescu", "https://fbref.com/en/players/dc2e7399/Dan-Petrescu"]),
  spell('Dan Petrescu', 'CHE', 'Chelsea', 150, '1995/96', '1999/00', ["https://en.wikipedia.org/wiki/Dan_Petrescu", "https://fbref.com/en/players/dc2e7399/Dan-Petrescu"]),
  spell('Dan Petrescu', 'BRD', 'Bradford', 17, '2000/01', '2000/01', ["https://en.wikipedia.org/wiki/Dan_Petrescu", "https://fbref.com/en/players/dc2e7399/Dan-Petrescu"]),
  spell('Dan Petrescu', 'SOU', 'Southampton', 11, '2000/01', '2001/02', ["https://en.wikipedia.org/wiki/Dan_Petrescu", "https://fbref.com/en/players/dc2e7399/Dan-Petrescu"]),

  // Daniel Sturridge
  spell('Daniel Sturridge', 'MCI', 'Man City', 21, '2006/07', '2008/09', ["https://en.wikipedia.org/wiki/Daniel_Sturridge", "https://fbref.com/en/players/1b7ec703/Daniel-Sturridge"]),
  spell('Daniel Sturridge', 'CHE', 'Chelsea', 63, '2009/10', '2012/13', ["https://en.wikipedia.org/wiki/Daniel_Sturridge", "https://fbref.com/en/players/1b7ec703/Daniel-Sturridge"]),
  spell('Daniel Sturridge', 'BOL', 'Bolton', 12, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Daniel_Sturridge", "https://fbref.com/en/players/1b7ec703/Daniel-Sturridge"]),
  spell('Daniel Sturridge', 'LIV', 'Liverpool', 116, '2012/13', '2018/19', ["https://en.wikipedia.org/wiki/Daniel_Sturridge", "https://fbref.com/en/players/1b7ec703/Daniel-Sturridge"]),
  spell('Daniel Sturridge', 'WBA', 'West Brom', 6, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Daniel_Sturridge", "https://fbref.com/en/players/1b7ec703/Daniel-Sturridge"]),

  // Danny Ings
  spell('Danny Ings', 'BUR', 'Burnley', 35, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Danny_Ings", "https://fbref.com/en/players/07802f7f/Danny-Ings"]),
  spell('Danny Ings', 'LIV', 'Liverpool', 6, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Danny_Ings", "https://fbref.com/en/players/07802f7f/Danny-Ings"]),
  spell('Danny Ings', 'LIV', 'Liverpool', 8, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Danny_Ings", "https://fbref.com/en/players/07802f7f/Danny-Ings"]),
  spell('Danny Ings', 'SOU', 'Southampton', 91, '2018/19', '2020/21', ["https://en.wikipedia.org/wiki/Danny_Ings", "https://fbref.com/en/players/07802f7f/Danny-Ings"]),
  spell('Danny Ings', 'AVL', 'Aston Villa', 48, '2021/22', '2022/23', ["https://en.wikipedia.org/wiki/Danny_Ings", "https://fbref.com/en/players/07802f7f/Danny-Ings"]),
  spell('Danny Ings', 'WHU', 'West Ham', 52, '2022/23', '2024/25', ["https://en.wikipedia.org/wiki/Danny_Ings", "https://fbref.com/en/players/07802f7f/Danny-Ings"]),

  // Danny Simpson
  spell('Danny Simpson', 'MUN', 'Man United', 3, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Danny_Simpson", "https://fbref.com/en/players/3201b03d/Danny-Simpson"]),
  spell('Danny Simpson', 'BLA', 'Blackburn', 12, '2008/09', '2008/09', ["https://en.wikipedia.org/wiki/Danny_Simpson", "https://fbref.com/en/players/3201b03d/Danny-Simpson"]),
  spell('Danny Simpson', 'NEW', 'Newcastle', 84, '2010/11', '2012/13', ["https://en.wikipedia.org/wiki/Danny_Simpson", "https://fbref.com/en/players/3201b03d/Danny-Simpson"]),
  spell('Danny Simpson', 'QPR', 'QPR', 1, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Danny_Simpson", "https://fbref.com/en/players/3201b03d/Danny-Simpson"]),
  spell('Danny Simpson', 'LEI', 'Leicester', 113, '2014/15', '2018/19', ["https://en.wikipedia.org/wiki/Danny_Simpson", "https://fbref.com/en/players/3201b03d/Danny-Simpson"]),

  // Darren Bent
  spell('Darren Bent', 'IPS', 'Ipswich', 5, '2001/02', '2001/02', ["https://en.wikipedia.org/wiki/Darren_Bent", "https://fbref.com/en/players/fe97f10b/Darren-Bent"]),
  spell('Darren Bent', 'CHA', 'Charlton', 68, '2005/06', '2006/07', ["https://en.wikipedia.org/wiki/Darren_Bent", "https://fbref.com/en/players/fe97f10b/Darren-Bent"]),
  spell('Darren Bent', 'TOT', 'Spurs', 60, '2007/08', '2008/09', ["https://en.wikipedia.org/wiki/Darren_Bent", "https://fbref.com/en/players/fe97f10b/Darren-Bent"]),
  spell('Darren Bent', 'SUN', 'Sunderland', 58, '2009/10', '2010/11', ["https://en.wikipedia.org/wiki/Darren_Bent", "https://fbref.com/en/players/fe97f10b/Darren-Bent"]),
  spell('Darren Bent', 'AVL', 'Aston Villa', 54, '2010/11', '2012/13', ["https://en.wikipedia.org/wiki/Darren_Bent", "https://fbref.com/en/players/fe97f10b/Darren-Bent"]),
  spell('Darren Bent', 'AVL', 'Aston Villa', 7, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Darren_Bent", "https://fbref.com/en/players/fe97f10b/Darren-Bent"]),
  spell('Darren Bent', 'FUL', 'Fulham', 24, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Darren_Bent", "https://fbref.com/en/players/fe97f10b/Darren-Bent"]),

  // Daryl Janmaat
  spell('Daryl Janmaat', 'NEW', 'Newcastle', 69, '2014/15', '2015/16', ["https://en.wikipedia.org/wiki/Daryl_Janmaat", "https://fbref.com/en/players/45da6694/Daryl-Janmaat"]),
  spell('Daryl Janmaat', 'WAT', 'Watford', 76, '2016/17', '2019/20', ["https://en.wikipedia.org/wiki/Daryl_Janmaat", "https://fbref.com/en/players/45da6694/Daryl-Janmaat"]),

  // Dave Beasant
  spell('Dave Beasant', 'CHE', 'Chelsea', 17, '1992/93', '1992/93', ["https://en.wikipedia.org/wiki/Dave_Beasant", "https://fbref.com/en/players/2e448746/Dave-Beasant"]),
  spell('Dave Beasant', 'SOU', 'Southampton', 88, '1993/94', '1996/97', ["https://en.wikipedia.org/wiki/Dave_Beasant", "https://fbref.com/en/players/2e448746/Dave-Beasant"]),
  spell('Dave Beasant', 'NFO', 'Forest', 26, '1998/99', '1998/99', ["https://en.wikipedia.org/wiki/Dave_Beasant", "https://fbref.com/en/players/2e448746/Dave-Beasant"]),

  // David Batty
  spell('David Batty', 'LEE', 'Leeds', 39, '1992/93', '1993/94', ["https://en.wikipedia.org/wiki/David_Batty", "https://fbref.com/en/players/21b2e37b/David-Batty"]),
  spell('David Batty', 'LEE', 'Leeds', 78, '1998/99', '2001/02', ["https://en.wikipedia.org/wiki/David_Batty", "https://fbref.com/en/players/21b2e37b/David-Batty"]),
  spell('David Batty', 'LEE', 'Leeds', 12, '2003/04', '2003/04', ["https://en.wikipedia.org/wiki/David_Batty", "https://fbref.com/en/players/21b2e37b/David-Batty"]),
  spell('David Batty', 'BLA', 'Blackburn', 54, '1993/94', '1995/96', ["https://en.wikipedia.org/wiki/David_Batty", "https://fbref.com/en/players/21b2e37b/David-Batty"]),
  spell('David Batty', 'NEW', 'Newcastle', 83, '1995/96', '1998/99', ["https://en.wikipedia.org/wiki/David_Batty", "https://fbref.com/en/players/21b2e37b/David-Batty"]),

  // David Button
  spell('David Button', 'BHA', 'Brighton', 4, '2018/19', '2018/19', ["https://en.wikipedia.org/wiki/David_Button", "https://fbref.com/en/players/e608ed4c/David-Button"]),
  spell('David Button', 'WBA', 'West Brom', 1, '2020/21', '2020/21', ["https://en.wikipedia.org/wiki/David_Button", "https://fbref.com/en/players/e608ed4c/David-Button"]),
  // Jody Craddock
  spell('Jody Craddock', 'SUN', 'Sunderland', 108, '1999/00', '2002/03', ["https://en.wikipedia.org/wiki/Jody_Craddock", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/"]),
  spell('Jody Craddock', 'WOL', 'Wolves', 32, '2003/04', '2003/04', ["https://en.wikipedia.org/wiki/Jody_Craddock", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/"]),
  spell('Jody Craddock', 'WOL', 'Wolves', 49, '2009/10', '2011/12', ["https://en.wikipedia.org/wiki/Jody_Craddock", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/"]),

  // George McCartney
  spell('George McCartney', 'SUN', 'Sunderland', 44, '2000/01', '2002/03', ["https://en.wikipedia.org/wiki/George_McCartney_(footballer)", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/"]),
  spell('George McCartney', 'SUN', 'Sunderland', 13, '2005/06', '2005/06', ["https://en.wikipedia.org/wiki/George_McCartney_(footballer)", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/"]),
  spell('George McCartney', 'SUN', 'Sunderland', 41, '2008/09', '2009/10', ["https://en.wikipedia.org/wiki/George_McCartney_(footballer)", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/"]),
  spell('George McCartney', 'WHU', 'West Ham', 61, '2006/07', '2008/09', ["https://en.wikipedia.org/wiki/George_McCartney_(footballer)", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/"]),
  spell('George McCartney', 'WHU', 'West Ham', 34, '2012/13', '2013/14', ["https://en.wikipedia.org/wiki/George_McCartney_(footballer)", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/west-ham-united/west-ham-united-premier-league-appearances/"]),

  // Steven Fletcher
  spell('Steven Fletcher', 'BUR', 'Burnley', 35, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Steven_Fletcher_(footballer)", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/"]),
  spell('Steven Fletcher', 'WOL', 'Wolves', 61, '2010/11', '2011/12', ["https://en.wikipedia.org/wiki/Steven_Fletcher_(footballer)", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/"]),
  spell('Steven Fletcher', 'SUN', 'Sunderland', 94, '2012/13', '2015/16', ["https://en.wikipedia.org/wiki/Steven_Fletcher_(footballer)", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/burnley-fc/burnley-fc-premier-league-appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/wolverhampton-wanderers/wolverhampton-wanderers-premier-league-appearances/"]),

  // Simon Mignolet
  spell('Simon Mignolet', 'SUN', 'Sunderland', 90, '2010/11', '2012/13', ["https://en.wikipedia.org/wiki/Simon_Mignolet", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/"]),
  spell('Simon Mignolet', 'LIV', 'Liverpool', 155, '2013/14', '2017/18', ["https://en.wikipedia.org/wiki/Simon_Mignolet", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/liverpool/liverpool-fc-premier-league-appearances/"]),

  // Craig Gordon
  spell('Craig Gordon', 'SUN', 'Sunderland', 88, '2007/08', '2011/12', ["https://en.wikipedia.org/wiki/Craig_Gordon", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),

  // Nyron Nosworthy
  spell('Nyron Nosworthy', 'SUN', 'Sunderland', 30, '2005/06', '2005/06', ["https://en.wikipedia.org/wiki/Nyron_Nosworthy", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),
  spell('Nyron Nosworthy', 'SUN', 'Sunderland', 55, '2007/08', '2009/10', ["https://en.wikipedia.org/wiki/Nyron_Nosworthy", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),

  // Daryl Murphy
  spell('Daryl Murphy', 'SUN', 'Sunderland', 18, '2005/06', '2005/06', ["https://en.wikipedia.org/wiki/Daryl_Murphy", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),
  spell('Daryl Murphy', 'SUN', 'Sunderland', 54, '2007/08', '2009/10', ["https://en.wikipedia.org/wiki/Daryl_Murphy", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),

  // Lamine Kone
  spell('Lamine Kone', 'SUN', 'Sunderland', 45, '2015/16', '2016/17', ["https://en.wikipedia.org/wiki/Lamine_Kon%C3%A9", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),

  // Yann M'Vila
  spell('Yann M\'Vila', 'SUN', 'Sunderland', 37, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Yann_M%27Vila", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),

  // Duncan Watmore
  spell('Duncan Watmore', 'SUN', 'Sunderland', 37, '2015/16', '2016/17', ["https://en.wikipedia.org/wiki/Duncan_Watmore", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),

  // Carlos Edwards
  spell('Carlos Edwards', 'SUN', 'Sunderland', 35, '2007/08', '2008/09', ["https://en.wikipedia.org/wiki/Carlos_Edwards", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),

  // Asamoah Gyan
  spell('Asamoah Gyan', 'SUN', 'Sunderland', 34, '2010/11', '2011/12', ["https://en.wikipedia.org/wiki/Asamoah_Gyan", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),

  // Emanuele Giaccherini
  spell('Emanuele Giaccherini', 'SUN', 'Sunderland', 32, '2013/14', '2014/15', ["https://en.wikipedia.org/wiki/Emanuele_Giaccherini", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),

  // Didier Ndong
  spell('Didier Ndong', 'SUN', 'Sunderland', 31, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Didier_Ndong", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),

  // Lorik Cana
  spell('Lorik Cana', 'SUN', 'Sunderland', 31, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Lorik_Cana", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),

  // Liam Bridcutt
  spell('Liam Bridcutt', 'SUN', 'Sunderland', 30, '2013/14', '2014/15', ["https://en.wikipedia.org/wiki/Liam_Bridcutt", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/"]),

  // Carlos Cuellar
  spell('Carlos Cuellar', 'AVL', 'Aston Villa', 94, '2008/09', '2011/12', ["https://en.wikipedia.org/wiki/Carlos_Cu%C3%A9llar", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/"]),
  spell('Carlos Cuellar', 'SUN', 'Sunderland', 30, '2012/13', '2013/14', ["https://en.wikipedia.org/wiki/Carlos_Cu%C3%A9llar", "https://www.11v11.com/teams/sunderland/tab/stats/option/appearances/", "https://www.myfootballfacts.com/premier-league/all-time-premier-league/clubs/aston-villa/aston-villa-premier-league-appearances/"]),

  // Andy O'Brien
  spell('Andy O\'Brien', 'BRD', 'Bradford', 54, '1999/00', '2000/01', ["https://en.wikipedia.org/wiki/Andy_O%27Brien_(footballer)", "https://fbref.com/en/players/1719f6b2/Andy-O'Brien"]),
  spell('Andy O\'Brien', 'NEW', 'Newcastle', 120, '2000/01', '2004/05', ["https://en.wikipedia.org/wiki/Andy_O%27Brien_(footballer)", "https://fbref.com/en/players/1719f6b2/Andy-O'Brien"]),
  spell('Andy O\'Brien', 'POR', 'Portsmouth', 32, '2005/06', '2006/07', ["https://en.wikipedia.org/wiki/Andy_O%27Brien_(footballer)", "https://fbref.com/en/players/1719f6b2/Andy-O'Brien"]),
  spell('Andy O\'Brien', 'BOL', 'Bolton', 74, '2007/08', '2010/11', ["https://en.wikipedia.org/wiki/Andy_O%27Brien_(footballer)", "https://fbref.com/en/players/1719f6b2/Andy-O'Brien"]),

  // Charles N'Zogbia
  spell('Charles N\'Zogbia', 'NEW', 'Newcastle', 118, '2004/05', '2008/09', ["https://en.wikipedia.org/wiki/Charles_N%27Zogbia", "https://fbref.com/en/players/4e31f3e2/Charles-N'Zogbia"]),
  spell('Charles N\'Zogbia', 'WIG', 'Wigan', 83, '2008/09', '2010/11', ["https://en.wikipedia.org/wiki/Charles_N%27Zogbia", "https://fbref.com/en/players/4e31f3e2/Charles-N'Zogbia"]),
  spell('Charles N\'Zogbia', 'AVL', 'Aston Villa', 51, '2011/12', '2012/13', ["https://en.wikipedia.org/wiki/Charles_N%27Zogbia", "https://fbref.com/en/players/4e31f3e2/Charles-N'Zogbia"]),
  spell('Charles N\'Zogbia', 'AVL', 'Aston Villa', 29, '2014/15', '2015/16', ["https://en.wikipedia.org/wiki/Charles_N%27Zogbia", "https://fbref.com/en/players/4e31f3e2/Charles-N'Zogbia"]),

  // David Datro Fofana
  spell('David Datro Fofana', 'CHE', 'Chelsea', 3, '2022/23', '2022/23', ["https://en.wikipedia.org/wiki/David_Datro_Fofana", "https://fbref.com/en/players/e82900ef/David-Datro-Fofana"]),
  spell('David Datro Fofana', 'BUR', 'Burnley', 15, '2023/24', '2023/24', ["https://en.wikipedia.org/wiki/David_Datro_Fofana", "https://fbref.com/en/players/e82900ef/David-Datro-Fofana"]),

  // David Ginola
  spell('David Ginola', 'NEW', 'Newcastle', 58, '1995/96', '1996/97', ["https://en.wikipedia.org/wiki/David_Ginola", "https://fbref.com/en/players/189225b3/David-Ginola"]),
  spell('David Ginola', 'TOT', 'Spurs', 100, '1997/98', '1999/00', ["https://en.wikipedia.org/wiki/David_Ginola", "https://fbref.com/en/players/189225b3/David-Ginola"]),
  spell('David Ginola', 'AVL', 'Aston Villa', 32, '2000/01', '2001/02', ["https://en.wikipedia.org/wiki/David_Ginola", "https://fbref.com/en/players/189225b3/David-Ginola"]),
  spell('David Ginola', 'EVE', 'Everton', 5, '2001/02', '2001/02', ["https://en.wikipedia.org/wiki/David_Ginola", "https://fbref.com/en/players/189225b3/David-Ginola"]),

  // David Luiz
  spell('David Luiz', 'CHE', 'Chelsea', 81, '2010/11', '2013/14', ["https://en.wikipedia.org/wiki/David_Luiz", "https://fbref.com/en/players/c0e27d1a/David-Luiz"]),
  spell('David Luiz', 'CHE', 'Chelsea', 79, '2016/17', '2018/19', ["https://en.wikipedia.org/wiki/David_Luiz", "https://fbref.com/en/players/c0e27d1a/David-Luiz"]),
  spell('David Luiz', 'ARS', 'Arsenal', 53, '2019/20', '2020/21', ["https://en.wikipedia.org/wiki/David_Luiz", "https://fbref.com/en/players/c0e27d1a/David-Luiz"]),

  // David N'Gog
  spell('David N\'Gog', 'LIV', 'Liverpool', 63, '2008/09', '2010/11', ["https://en.wikipedia.org/wiki/David_Ngog", "https://fbref.com/en/players/beec2968/David-N'Gog"]),
  spell('David N\'Gog', 'BOL', 'Bolton', 33, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/David_Ngog", "https://fbref.com/en/players/beec2968/David-N'Gog"]),
  spell('David N\'Gog', 'SWA', 'Swansea', 3, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/David_Ngog", "https://fbref.com/en/players/beec2968/David-N'Gog"]),

  // David Nugent
  spell('David Nugent', 'POR', 'Portsmouth', 34, '2007/08', '2009/10', ["https://en.wikipedia.org/wiki/David_Nugent", "https://fbref.com/en/players/f9b5e5bd/David-Nugent"]),
  spell('David Nugent', 'BUR', 'Burnley', 30, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/David_Nugent", "https://fbref.com/en/players/f9b5e5bd/David-Nugent"]),
  spell('David Nugent', 'LEI', 'Leicester', 29, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/David_Nugent", "https://fbref.com/en/players/f9b5e5bd/David-Nugent"]),
  spell('David Nugent', 'MID', 'Middlesbrough', 4, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/David_Nugent", "https://fbref.com/en/players/f9b5e5bd/David-Nugent"]),

  // David Seaman
  spell('David Seaman', 'ARS', 'Arsenal', 325, '1992/93', '2002/03', ["https://en.wikipedia.org/wiki/David_Seaman", "https://fbref.com/en/players/2d578837/David-Seaman"]),
  spell('David Seaman', 'MCI', 'Man City', 19, '2003/04', '2003/04', ["https://en.wikipedia.org/wiki/David_Seaman", "https://fbref.com/en/players/2d578837/David-Seaman"]),

  // Dean Marney
  spell('Dean Marney', 'TOT', 'Spurs', 8, '2003/04', '2004/05', ["https://en.wikipedia.org/wiki/Dean_Marney_(footballer)", "https://fbref.com/en/players/b3379356/Dean-Marney"]),
  spell('Dean Marney', 'HUL', 'Hull', 47, '2008/09', '2009/10', ["https://en.wikipedia.org/wiki/Dean_Marney_(footballer)", "https://fbref.com/en/players/b3379356/Dean-Marney"]),
  spell('Dean Marney', 'BUR', 'Burnley', 20, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Dean_Marney_(footballer)", "https://fbref.com/en/players/b3379356/Dean-Marney"]),
  spell('Dean Marney', 'BUR', 'Burnley', 21, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Dean_Marney_(footballer)", "https://fbref.com/en/players/b3379356/Dean-Marney"]),

  // Dejan Lovren
  spell('Dejan Lovren', 'SOU', 'Southampton', 31, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Dejan_Lovren", "https://fbref.com/en/players/1a2935f6/Dejan-Lovren"]),
  spell('Dejan Lovren', 'LIV', 'Liverpool', 131, '2014/15', '2019/20', ["https://en.wikipedia.org/wiki/Dejan_Lovren", "https://fbref.com/en/players/1a2935f6/Dejan-Lovren"]),

  // Dele Alli
  spell('Dele Alli', 'TOT', 'Spurs', 181, '2015/16', '2021/22', ["https://en.wikipedia.org/wiki/Dele_Alli", "https://fbref.com/en/players/cea4ee8f/Dele-Alli"]),
  spell('Dele Alli', 'EVE', 'Everton', 13, '2021/22', '2022/23', ["https://en.wikipedia.org/wiki/Dele_Alli", "https://fbref.com/en/players/cea4ee8f/Dele-Alli"]),

  // Demarai Gray
  spell('Demarai Gray', 'LEI', 'Leicester', 133, '2015/16', '2020/21', ["https://en.wikipedia.org/wiki/Demarai_Gray", "https://fbref.com/en/players/4468ec10/Demarai-Gray"]),
  spell('Demarai Gray', 'EVE', 'Everton', 67, '2021/22', '2022/23', ["https://en.wikipedia.org/wiki/Demarai_Gray", "https://fbref.com/en/players/4468ec10/Demarai-Gray"]),

  // Dennis Wise
  spell('Dennis Wise', 'CHE', 'Chelsea', 261, '1992/93', '2000/01', ["https://en.wikipedia.org/wiki/Dennis_Wise", "https://fbref.com/en/players/e718c23d/Dennis-Wise"]),
  spell('Dennis Wise', 'LEI', 'Leicester', 17, '2001/02', '2001/02', ["https://en.wikipedia.org/wiki/Dennis_Wise", "https://fbref.com/en/players/e718c23d/Dennis-Wise"]),

  // Dickson Etuhu
  spell('Dickson Etuhu', 'SUN', 'Sunderland', 20, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Dickson_Etuhu", "https://fbref.com/en/players/0f04d7b6/Dickson-Etuhu"]),
  spell('Dickson Etuhu', 'FUL', 'Fulham', 91, '2008/09', '2011/12', ["https://en.wikipedia.org/wiki/Dickson_Etuhu", "https://fbref.com/en/players/0f04d7b6/Dickson-Etuhu"]),

  // Dietmar Hamann
  spell('Dietmar Hamann', 'NEW', 'Newcastle', 23, '1998/99', '1998/99', ["https://en.wikipedia.org/wiki/Dietmar_Hamann", "https://fbref.com/en/players/01c05efb/Dietmar-Hamann"]),
  spell('Dietmar Hamann', 'LIV', 'Liverpool', 191, '1999/00', '2005/06', ["https://en.wikipedia.org/wiki/Dietmar_Hamann", "https://fbref.com/en/players/01c05efb/Dietmar-Hamann"]),
  spell('Dietmar Hamann', 'MCI', 'Man City', 54, '2006/07', '2008/09', ["https://en.wikipedia.org/wiki/Dietmar_Hamann", "https://fbref.com/en/players/01c05efb/Dietmar-Hamann"]),

  // Djimi Traore
  spell('Djimi Traore', 'LIV', 'Liverpool', 8, '2000/01', '2000/01', ["https://en.wikipedia.org/wiki/Djimi_Traor%C3%A9", "https://fbref.com/en/players/b8c992d8/Djimi-Traore"]),
  spell('Djimi Traore', 'LIV', 'Liverpool', 80, '2002/03', '2005/06', ["https://en.wikipedia.org/wiki/Djimi_Traor%C3%A9", "https://fbref.com/en/players/b8c992d8/Djimi-Traore"]),
  spell('Djimi Traore', 'CHA', 'Charlton', 11, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Djimi_Traor%C3%A9", "https://fbref.com/en/players/b8c992d8/Djimi-Traore"]),
  spell('Djimi Traore', 'POR', 'Portsmouth', 13, '2006/07', '2007/08', ["https://en.wikipedia.org/wiki/Djimi_Traor%C3%A9", "https://fbref.com/en/players/b8c992d8/Djimi-Traore"]),

  // Duncan Ferguson
  spell('Duncan Ferguson', 'EVE', 'Everton', 116, '1994/95', '1998/99', ["https://en.wikipedia.org/wiki/Duncan_Ferguson", "https://fbref.com/en/players/9593e964/Duncan-Ferguson"]),
  spell('Duncan Ferguson', 'EVE', 'Everton', 123, '2000/01', '2005/06', ["https://en.wikipedia.org/wiki/Duncan_Ferguson", "https://fbref.com/en/players/9593e964/Duncan-Ferguson"]),
  spell('Duncan Ferguson', 'NEW', 'Newcastle', 30, '1998/99', '1999/00', ["https://en.wikipedia.org/wiki/Duncan_Ferguson", "https://fbref.com/en/players/9593e964/Duncan-Ferguson"]),

  // Eidur Gudjohnsen
  spell('Eidur Gudjohnsen', 'CHE', 'Chelsea', 186, '2000/01', '2005/06', ["https://en.wikipedia.org/wiki/Ei%C3%B0ur_Gu%C3%B0johnsen", "https://fbref.com/en/players/32fc9ff2/Eidur-Gudjohnsen"]),
  spell('Eidur Gudjohnsen', 'TOT', 'Spurs', 11, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Ei%C3%B0ur_Gu%C3%B0johnsen", "https://fbref.com/en/players/32fc9ff2/Eidur-Gudjohnsen"]),
  spell('Eidur Gudjohnsen', 'STK', 'Stoke', 4, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Ei%C3%B0ur_Gu%C3%B0johnsen", "https://fbref.com/en/players/32fc9ff2/Eidur-Gudjohnsen"]),
  spell('Eidur Gudjohnsen', 'FUL', 'Fulham', 10, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Ei%C3%B0ur_Gu%C3%B0johnsen", "https://fbref.com/en/players/32fc9ff2/Eidur-Gudjohnsen"]),

  // Eliaquim Mangala
  spell('Eliaquim Mangala', 'MCI', 'Man City', 48, '2014/15', '2015/16', ["https://en.wikipedia.org/wiki/Eliaquim_Mangala", "https://fbref.com/en/players/f520049f/Eliaquim-Mangala"]),
  spell('Eliaquim Mangala', 'MCI', 'Man City', 9, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Eliaquim_Mangala", "https://fbref.com/en/players/f520049f/Eliaquim-Mangala"]),
  spell('Eliaquim Mangala', 'EVE', 'Everton', 2, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Eliaquim_Mangala", "https://fbref.com/en/players/f520049f/Eliaquim-Mangala"]),

  // Emmanuel Adebayor
  spell('Emmanuel Adebayor', 'ARS', 'Arsenal', 104, '2005/06', '2008/09', ["https://en.wikipedia.org/wiki/Emmanuel_Adebayor", "https://fbref.com/en/players/936d9e3e/Emmanuel-Adebayor"]),
  spell('Emmanuel Adebayor', 'MCI', 'Man City', 34, '2009/10', '2010/11', ["https://en.wikipedia.org/wiki/Emmanuel_Adebayor", "https://fbref.com/en/players/936d9e3e/Emmanuel-Adebayor"]),
  spell('Emmanuel Adebayor', 'TOT', 'Spurs', 92, '2011/12', '2014/15', ["https://en.wikipedia.org/wiki/Emmanuel_Adebayor", "https://fbref.com/en/players/936d9e3e/Emmanuel-Adebayor"]),
  spell('Emmanuel Adebayor', 'CRY', 'Palace', 12, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Emmanuel_Adebayor", "https://fbref.com/en/players/936d9e3e/Emmanuel-Adebayor"]),

  // Emmanuel Petit
  spell('Emmanuel Petit', 'ARS', 'Arsenal', 85, '1997/98', '1999/00', ["https://en.wikipedia.org/wiki/Emmanuel_Petit", "https://fbref.com/en/players/291358c4/Emmanuel-Petit"]),
  spell('Emmanuel Petit', 'CHE', 'Chelsea', 55, '2001/02', '2003/04', ["https://en.wikipedia.org/wiki/Emmanuel_Petit", "https://fbref.com/en/players/291358c4/Emmanuel-Petit"]),

  // Emmerson Boyce
  spell('Emmerson Boyce', 'CRY', 'Palace', 27, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Emmerson_Boyce", "https://fbref.com/en/players/84bfbd38/Emmerson-Boyce"]),
  spell('Emmerson Boyce', 'WIG', 'Wigan', 194, '2006/07', '2012/13', ["https://en.wikipedia.org/wiki/Emmerson_Boyce", "https://fbref.com/en/players/84bfbd38/Emmerson-Boyce"]),

  // Eric Cantona
  spell('Eric Cantona', 'LEE', 'Leeds', 13, '1992/93', '1992/93', ["https://en.wikipedia.org/wiki/Eric_Cantona", "https://fbref.com/en/players/808b48cd/Eric-Cantona"]),
  spell('Eric Cantona', 'MUN', 'Man United', 143, '1992/93', '1996/97', ["https://en.wikipedia.org/wiki/Eric_Cantona", "https://fbref.com/en/players/808b48cd/Eric-Cantona"]),

  // Erik Pieters
  spell('Erik Pieters', 'STK', 'Stoke', 169, '2013/14', '2017/18', ["https://en.wikipedia.org/wiki/Erik_Pieters", "https://fbref.com/en/players/1ef37668/Erik-Pieters"]),
  spell('Erik Pieters', 'BUR', 'Burnley', 56, '2019/20', '2021/22', ["https://en.wikipedia.org/wiki/Erik_Pieters", "https://fbref.com/en/players/1ef37668/Erik-Pieters"]),

  // Evan Ferguson
  spell('Evan Ferguson', 'BHA', 'Brighton', 60, '2021/22', '2024/25', ["https://en.wikipedia.org/wiki/Evan_Ferguson", "https://fbref.com/en/players/4596da74/Evan-Ferguson"]),
  spell('Evan Ferguson', 'WHU', 'West Ham', 8, '2024/25', '2024/25', ["https://en.wikipedia.org/wiki/Evan_Ferguson", "https://fbref.com/en/players/4596da74/Evan-Ferguson"]),

  // Fabian Delph
  spell('Fabian Delph', 'AVL', 'Aston Villa', 112, '2009/10', '2014/15', ["https://en.wikipedia.org/wiki/Fabian_Delph", "https://fbref.com/en/players/111c3236/Fabian-Delph"]),
  spell('Fabian Delph', 'MCI', 'Man City', 57, '2015/16', '2018/19', ["https://en.wikipedia.org/wiki/Fabian_Delph", "https://fbref.com/en/players/111c3236/Fabian-Delph"]),
  spell('Fabian Delph', 'EVE', 'Everton', 35, '2019/20', '2021/22', ["https://en.wikipedia.org/wiki/Fabian_Delph", "https://fbref.com/en/players/111c3236/Fabian-Delph"]),

  // Fraizer Campbell
  spell('Fraizer Campbell', 'MUN', 'Man United', 2, '2007/08', '2008/09', ["https://en.wikipedia.org/wiki/Fraizer_Campbell", "https://fbref.com/en/players/81d63375/Fraizer-Campbell"]),
  spell('Fraizer Campbell', 'TOT', 'Spurs', 10, '2008/09', '2008/09', ["https://en.wikipedia.org/wiki/Fraizer_Campbell", "https://fbref.com/en/players/81d63375/Fraizer-Campbell"]),
  spell('Fraizer Campbell', 'SUN', 'Sunderland', 58, '2009/10', '2012/13', ["https://en.wikipedia.org/wiki/Fraizer_Campbell", "https://fbref.com/en/players/81d63375/Fraizer-Campbell"]),
  spell('Fraizer Campbell', 'CAR', 'Cardiff', 37, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Fraizer_Campbell", "https://fbref.com/en/players/81d63375/Fraizer-Campbell"]),
  spell('Fraizer Campbell', 'CRY', 'Palace', 43, '2014/15', '2016/17', ["https://en.wikipedia.org/wiki/Fraizer_Campbell", "https://fbref.com/en/players/81d63375/Fraizer-Campbell"]),

  // Frank Sinclair
  spell('Frank Sinclair', 'CHE', 'Chelsea', 157, '1992/93', '1997/98', ["https://en.wikipedia.org/wiki/Frank_Sinclair", "https://fbref.com/en/players/02942593/Frank-Sinclair"]),
  spell('Frank Sinclair', 'LEI', 'Leicester', 117, '1998/99', '2001/02', ["https://en.wikipedia.org/wiki/Frank_Sinclair", "https://fbref.com/en/players/02942593/Frank-Sinclair"]),
  spell('Frank Sinclair', 'LEI', 'Leicester', 14, '2003/04', '2003/04', ["https://en.wikipedia.org/wiki/Frank_Sinclair", "https://fbref.com/en/players/02942593/Frank-Sinclair"]),

  // Gabriel Obertan
  spell('Gabriel Obertan', 'MUN', 'Man United', 14, '2009/10', '2010/11', ["https://en.wikipedia.org/wiki/Gabriel_Obertan", "https://fbref.com/en/players/adc264a8/Gabriel-Obertan"]),
  spell('Gabriel Obertan', 'NEW', 'Newcastle', 58, '2011/12', '2015/16', ["https://en.wikipedia.org/wiki/Gabriel_Obertan", "https://fbref.com/en/players/adc264a8/Gabriel-Obertan"]),

  // Gary Cahill
  spell('Gary Cahill', 'AVL', 'Aston Villa', 28, '2005/06', '2007/08', ["https://en.wikipedia.org/wiki/Gary_Cahill", "https://fbref.com/en/players/7914b9fe/Gary-Cahill"]),
  spell('Gary Cahill', 'BOL', 'Bolton', 130, '2007/08', '2011/12', ["https://en.wikipedia.org/wiki/Gary_Cahill", "https://fbref.com/en/players/7914b9fe/Gary-Cahill"]),
  spell('Gary Cahill', 'CHE', 'Chelsea', 191, '2011/12', '2018/19', ["https://en.wikipedia.org/wiki/Gary_Cahill", "https://fbref.com/en/players/7914b9fe/Gary-Cahill"]),
  spell('Gary Cahill', 'CRY', 'Palace', 45, '2019/20', '2020/21', ["https://en.wikipedia.org/wiki/Gary_Cahill", "https://fbref.com/en/players/7914b9fe/Gary-Cahill"]),

  // George Boateng
  spell('George Boateng', 'COV', 'Coventry', 46, '1997/98', '1998/99', ["https://en.wikipedia.org/wiki/George_Boateng", "https://fbref.com/en/players/a44a9f65/George-Boateng"]),
  spell('George Boateng', 'AVL', 'Aston Villa', 103, '1999/00', '2001/02', ["https://en.wikipedia.org/wiki/George_Boateng", "https://fbref.com/en/players/a44a9f65/George-Boateng"]),
  spell('George Boateng', 'MID', 'Middlesbrough', 182, '2002/03', '2007/08', ["https://en.wikipedia.org/wiki/George_Boateng", "https://fbref.com/en/players/a44a9f65/George-Boateng"]),
  spell('George Boateng', 'HUL', 'Hull', 52, '2008/09', '2009/10', ["https://en.wikipedia.org/wiki/George_Boateng", "https://fbref.com/en/players/a44a9f65/George-Boateng"]),

  // George Boyd
  spell('George Boyd', 'HUL', 'Hull', 30, '2013/14', '2014/15', ["https://en.wikipedia.org/wiki/George_Boyd_(footballer)", "https://fbref.com/en/players/0a9048ce/George-Boyd"]),
  spell('George Boyd', 'BUR', 'Burnley', 35, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/George_Boyd_(footballer)", "https://fbref.com/en/players/0a9048ce/George-Boyd"]),
  spell('George Boyd', 'BUR', 'Burnley', 36, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/George_Boyd_(footballer)", "https://fbref.com/en/players/0a9048ce/George-Boyd"]),

  // Georginio Wijnaldum
  spell('Georginio Wijnaldum', 'NEW', 'Newcastle', 38, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Georginio_Wijnaldum", "https://fbref.com/en/players/eb58eef0/Georginio-Wijnaldum"]),
  spell('Georginio Wijnaldum', 'LIV', 'Liverpool', 179, '2016/17', '2020/21', ["https://en.wikipedia.org/wiki/Georginio_Wijnaldum", "https://fbref.com/en/players/eb58eef0/Georginio-Wijnaldum"]),

  // Gerard Deulofeu
  spell('Gerard Deulofeu', 'EVE', 'Everton', 25, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Gerard_Deulofeu", "https://fbref.com/en/players/39583cfd/Gerard-Deulofeu"]),
  spell('Gerard Deulofeu', 'EVE', 'Everton', 37, '2015/16', '2016/17', ["https://en.wikipedia.org/wiki/Gerard_Deulofeu", "https://fbref.com/en/players/39583cfd/Gerard-Deulofeu"]),
  spell('Gerard Deulofeu', 'WAT', 'Watford', 65, '2017/18', '2019/20', ["https://en.wikipedia.org/wiki/Gerard_Deulofeu", "https://fbref.com/en/players/39583cfd/Gerard-Deulofeu"]),

  // Gordon Strachan
  spell('Gordon Strachan', 'LEE', 'Leeds', 70, '1992/93', '1994/95', ["https://en.wikipedia.org/wiki/Gordon_Strachan", "https://fbref.com/en/players/90aef1c6/Gordon-Strachan"]),
  spell('Gordon Strachan', 'COV', 'Coventry', 26, '1994/95', '1996/97', ["https://en.wikipedia.org/wiki/Gordon_Strachan", "https://fbref.com/en/players/90aef1c6/Gordon-Strachan"]),

  // Graham Stuart
  spell('Graham Stuart', 'CHE', 'Chelsea', 39, '1992/93', '1992/93', ["https://en.wikipedia.org/wiki/Graham_Stuart_(footballer)", "https://fbref.com/en/players/159c714f/Graham-Stuart"]),
  spell('Graham Stuart', 'EVE', 'Everton', 136, '1993/94', '1997/98', ["https://en.wikipedia.org/wiki/Graham_Stuart_(footballer)", "https://fbref.com/en/players/159c714f/Graham-Stuart"]),
  spell('Graham Stuart', 'CHA', 'Charlton', 9, '1998/99', '1998/99', ["https://en.wikipedia.org/wiki/Graham_Stuart_(footballer)", "https://fbref.com/en/players/159c714f/Graham-Stuart"]),
  spell('Graham Stuart', 'CHA', 'Charlton', 102, '2000/01', '2004/05', ["https://en.wikipedia.org/wiki/Graham_Stuart_(footballer)", "https://fbref.com/en/players/159c714f/Graham-Stuart"]),
  spell('Graham Stuart', 'NOR', 'Norwich', 8, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Graham_Stuart_(footballer)", "https://fbref.com/en/players/159c714f/Graham-Stuart"]),

  // Greg Halford
  spell('Greg Halford', 'REA', 'Reading', 3, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Greg_Halford", "https://fbref.com/en/players/06d45e81/Greg-Halford"]),
  spell('Greg Halford', 'SUN', 'Sunderland', 8, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Greg_Halford", "https://fbref.com/en/players/06d45e81/Greg-Halford"]),
  spell('Greg Halford', 'WOL', 'Wolves', 17, '2009/10', '2010/11', ["https://en.wikipedia.org/wiki/Greg_Halford", "https://fbref.com/en/players/06d45e81/Greg-Halford"]),

  // Gylfi Sigurdsson
  spell('Gylfi Sigurdsson', 'SWA', 'Swansea', 18, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Gylfi_Sigur%C3%B0sson", "https://fbref.com/en/players/76dd1480/Gylfi-Sigurdsson"]),
  spell('Gylfi Sigurdsson', 'SWA', 'Swansea', 106, '2014/15', '2016/17', ["https://en.wikipedia.org/wiki/Gylfi_Sigur%C3%B0sson", "https://fbref.com/en/players/76dd1480/Gylfi-Sigurdsson"]),
  spell('Gylfi Sigurdsson', 'TOT', 'Spurs', 58, '2012/13', '2013/14', ["https://en.wikipedia.org/wiki/Gylfi_Sigur%C3%B0sson", "https://fbref.com/en/players/76dd1480/Gylfi-Sigurdsson"]),
  spell('Gylfi Sigurdsson', 'EVE', 'Everton', 136, '2017/18', '2020/21', ["https://en.wikipedia.org/wiki/Gylfi_Sigur%C3%B0sson", "https://fbref.com/en/players/76dd1480/Gylfi-Sigurdsson"]),

  // Gabor Kiraly
  spell('Gabor Kiraly', 'CRY', 'Palace', 32, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/G%C3%A1bor_Kir%C3%A1ly", "https://fbref.com/en/players/6603a18c/Gabor-Kiraly"]),
  spell('Gabor Kiraly', 'AVL', 'Aston Villa', 5, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/G%C3%A1bor_Kir%C3%A1ly", "https://fbref.com/en/players/6603a18c/Gabor-Kiraly"]),

  // Harry Arter
  spell('Harry Arter', 'BOU', 'Bournemouth', 69, '2015/16', '2017/18', ["https://en.wikipedia.org/wiki/Harry_Arter", "https://fbref.com/en/players/2f4c5a52/Harry-Arter"]),
  spell('Harry Arter', 'CAR', 'Cardiff', 25, '2018/19', '2018/19', ["https://en.wikipedia.org/wiki/Harry_Arter", "https://fbref.com/en/players/2f4c5a52/Harry-Arter"]),

  // Harry Winks
  spell('Harry Winks', 'TOT', 'Spurs', 128, '2016/17', '2021/22', ["https://en.wikipedia.org/wiki/Harry_Winks", "https://fbref.com/en/players/2f7acede/Harry-Winks"]),
  spell('Harry Winks', 'LEI', 'Leicester', 22, '2024/25', '2024/25', ["https://en.wikipedia.org/wiki/Harry_Winks", "https://fbref.com/en/players/2f7acede/Harry-Winks"]),

  // Hatem Ben Arfa
  spell('Hatem Ben Arfa', 'NEW', 'Newcastle', 76, '2010/11', '2013/14', ["https://en.wikipedia.org/wiki/Hatem_Ben_Arfa", "https://fbref.com/en/players/74dc806c/Hatem-Ben-Arfa"]),
  spell('Hatem Ben Arfa', 'HUL', 'Hull', 8, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Hatem_Ben_Arfa", "https://fbref.com/en/players/74dc806c/Hatem-Ben-Arfa"]),

  // Hayden Mullins
  spell('Hayden Mullins', 'WHU', 'West Ham', 116, '2005/06', '2008/09', ["https://en.wikipedia.org/wiki/Hayden_Mullins", "https://fbref.com/en/players/0e5ae692/Hayden-Mullins"]),
  spell('Hayden Mullins', 'POR', 'Portsmouth', 35, '2008/09', '2009/10', ["https://en.wikipedia.org/wiki/Hayden_Mullins", "https://fbref.com/en/players/0e5ae692/Hayden-Mullins"]),

  // Hermann Hreidarsson
  spell('Hermann Hreidarsson', 'CRY', 'Palace', 30, '1997/98', '1997/98', ["https://en.wikipedia.org/wiki/Hermann_Hrei%C3%B0arsson", "https://fbref.com/en/players/18e3787e/Hermann-Hreidarsson"]),
  spell('Hermann Hreidarsson', 'WIM', 'Wimbledon', 24, '1999/00', '1999/00', ["https://en.wikipedia.org/wiki/Hermann_Hrei%C3%B0arsson", "https://fbref.com/en/players/18e3787e/Hermann-Hreidarsson"]),
  spell('Hermann Hreidarsson', 'IPS', 'Ipswich', 74, '2000/01', '2001/02', ["https://en.wikipedia.org/wiki/Hermann_Hrei%C3%B0arsson", "https://fbref.com/en/players/18e3787e/Hermann-Hreidarsson"]),
  spell('Hermann Hreidarsson', 'CHA', 'Charlton', 132, '2003/04', '2006/07', ["https://en.wikipedia.org/wiki/Hermann_Hrei%C3%B0arsson", "https://fbref.com/en/players/18e3787e/Hermann-Hreidarsson"]),
  spell('Hermann Hreidarsson', 'POR', 'Portsmouth', 72, '2007/08', '2009/10', ["https://en.wikipedia.org/wiki/Hermann_Hrei%C3%B0arsson", "https://fbref.com/en/players/18e3787e/Hermann-Hreidarsson"]),

  // Heurelho Gomes
  spell('Heurelho Gomes', 'TOT', 'Spurs', 95, '2008/09', '2010/11', ["https://en.wikipedia.org/wiki/Heurelho_Gomes", "https://fbref.com/en/players/d596e193/Heurelho-Gomes"]),
  spell('Heurelho Gomes', 'WAT', 'Watford', 100, '2015/16', '2017/18', ["https://en.wikipedia.org/wiki/Heurelho_Gomes", "https://fbref.com/en/players/d596e193/Heurelho-Gomes"]),

  // Iain Dowie
  spell('Iain Dowie', 'SOU', 'Southampton', 92, '1992/93', '1994/95', ["https://en.wikipedia.org/wiki/Iain_Dowie", "https://fbref.com/en/players/7853411c/Iain-Dowie"]),
  spell('Iain Dowie', 'CRY', 'Palace', 15, '1994/95', '1994/95', ["https://en.wikipedia.org/wiki/Iain_Dowie", "https://fbref.com/en/players/7853411c/Iain-Dowie"]),
  spell('Iain Dowie', 'WHU', 'West Ham', 68, '1995/96', '1997/98', ["https://en.wikipedia.org/wiki/Iain_Dowie", "https://fbref.com/en/players/7853411c/Iain-Dowie"]),

  // Ian Harte
  spell('Ian Harte', 'LEE', 'Leeds', 213, '1995/96', '2003/04', ["https://en.wikipedia.org/wiki/Ian_Harte", "https://fbref.com/en/players/fd4fa092/Ian-Harte"]),
  spell('Ian Harte', 'SUN', 'Sunderland', 8, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Ian_Harte", "https://fbref.com/en/players/fd4fa092/Ian-Harte"]),
  spell('Ian Harte', 'REA', 'Reading', 16, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Ian_Harte", "https://fbref.com/en/players/fd4fa092/Ian-Harte"]),

  // Ian Rush
  spell('Ian Rush', 'LIV', 'Liverpool', 130, '1992/93', '1995/96', ["https://en.wikipedia.org/wiki/Ian_Rush", "https://fbref.com/en/players/2a942638/Ian-Rush"]),
  spell('Ian Rush', 'LEE', 'Leeds', 36, '1996/97', '1996/97', ["https://en.wikipedia.org/wiki/Ian_Rush", "https://fbref.com/en/players/2a942638/Ian-Rush"]),
  spell('Ian Rush', 'NEW', 'Newcastle', 10, '1997/98', '1997/98', ["https://en.wikipedia.org/wiki/Ian_Rush", "https://fbref.com/en/players/2a942638/Ian-Rush"]),

  // Ivan Toney
  spell('Ivan Toney', 'NEW', 'Newcastle', 2, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Ivan_Toney", "https://fbref.com/en/players/e09f279b/Ivan-Toney"]),
  spell('Ivan Toney', 'BRE', 'Brentford', 83, '2021/22', '2023/24', ["https://en.wikipedia.org/wiki/Ivan_Toney", "https://fbref.com/en/players/e09f279b/Ivan-Toney"]),

  // Izzy Brown
  spell('Izzy Brown', 'WBA', 'West Brom', 1, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Izzy_Brown", "https://fbref.com/en/players/bf54c8cc/Izzy-Brown"]),
  spell('Izzy Brown', 'CHE', 'Chelsea', 1, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Izzy_Brown", "https://fbref.com/en/players/bf54c8cc/Izzy-Brown"]),
  spell('Izzy Brown', 'BHA', 'Brighton', 13, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Izzy_Brown", "https://fbref.com/en/players/bf54c8cc/Izzy-Brown"]),

  // Jack Rodwell
  spell('Jack Rodwell', 'EVE', 'Everton', 85, '2007/08', '2011/12', ["https://en.wikipedia.org/wiki/Jack_Rodwell", "https://fbref.com/en/players/a07579ee/Jack-Rodwell"]),
  spell('Jack Rodwell', 'MCI', 'Man City', 16, '2012/13', '2013/14', ["https://en.wikipedia.org/wiki/Jack_Rodwell", "https://fbref.com/en/players/a07579ee/Jack-Rodwell"]),
  spell('Jack Rodwell', 'SUN', 'Sunderland', 65, '2014/15', '2016/17', ["https://en.wikipedia.org/wiki/Jack_Rodwell", "https://fbref.com/en/players/a07579ee/Jack-Rodwell"]),
  spell('Jack Rodwell', 'SHU', 'Sheffield United', 1, '2019/20', '2019/20', ["https://en.wikipedia.org/wiki/Jack_Rodwell", "https://fbref.com/en/players/a07579ee/Jack-Rodwell"]),

  // Jack Wilshere
  spell('Jack Wilshere', 'ARS', 'Arsenal', 37, '2008/09', '2010/11', ["https://en.wikipedia.org/wiki/Jack_Wilshere", "https://fbref.com/en/players/9c318325/Jack-Wilshere"]),
  spell('Jack Wilshere', 'ARS', 'Arsenal', 88, '2012/13', '2017/18', ["https://en.wikipedia.org/wiki/Jack_Wilshere", "https://fbref.com/en/players/9c318325/Jack-Wilshere"]),
  spell('Jack Wilshere', 'BOL', 'Bolton', 14, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Jack_Wilshere", "https://fbref.com/en/players/9c318325/Jack-Wilshere"]),
  spell('Jack Wilshere', 'BOU', 'Bournemouth', 27, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Jack_Wilshere", "https://fbref.com/en/players/9c318325/Jack-Wilshere"]),
  spell('Jack Wilshere', 'WHU', 'West Ham', 16, '2018/19', '2019/20', ["https://en.wikipedia.org/wiki/Jack_Wilshere", "https://fbref.com/en/players/9c318325/Jack-Wilshere"]),

  // Jamie O'Hara
  spell('Jamie O\'Hara', 'TOT', 'Spurs', 34, '2007/08', '2009/10', ["https://en.wikipedia.org/wiki/Jamie_O%27Hara_(footballer)", "https://fbref.com/en/players/7578d85c/Jamie-O'Hara"]),
  spell('Jamie O\'Hara', 'POR', 'Portsmouth', 26, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Jamie_O%27Hara_(footballer)", "https://fbref.com/en/players/7578d85c/Jamie-O'Hara"]),
  spell('Jamie O\'Hara', 'WOL', 'Wolves', 33, '2010/11', '2011/12', ["https://en.wikipedia.org/wiki/Jamie_O%27Hara_(footballer)", "https://fbref.com/en/players/7578d85c/Jamie-O'Hara"]),

  // Jamie Redknapp
  spell('Jamie Redknapp', 'LIV', 'Liverpool', 227, '1992/93', '1999/00', ["https://en.wikipedia.org/wiki/Jamie_Redknapp", "https://fbref.com/en/players/c337443d/Jamie-Redknapp"]),
  spell('Jamie Redknapp', 'LIV', 'Liverpool', 4, '2001/02', '2001/02', ["https://en.wikipedia.org/wiki/Jamie_Redknapp", "https://fbref.com/en/players/c337443d/Jamie-Redknapp"]),
  spell('Jamie Redknapp', 'TOT', 'Spurs', 48, '2002/03', '2004/05', ["https://en.wikipedia.org/wiki/Jamie_Redknapp", "https://fbref.com/en/players/c337443d/Jamie-Redknapp"]),
  spell('Jamie Redknapp', 'SOU', 'Southampton', 16, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Jamie_Redknapp", "https://fbref.com/en/players/c337443d/Jamie-Redknapp"]),

  // Javi Manquillo
  spell('Javi Manquillo', 'LIV', 'Liverpool', 10, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Javier_Manquillo", "https://fbref.com/en/players/758dd7f0/Javier-Manquillo"]),
  spell('Javi Manquillo', 'SUN', 'Sunderland', 20, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Javier_Manquillo", "https://fbref.com/en/players/758dd7f0/Javier-Manquillo"]),
  spell('Javi Manquillo', 'NEW', 'Newcastle', 96, '2017/18', '2022/23', ["https://en.wikipedia.org/wiki/Javier_Manquillo", "https://fbref.com/en/players/758dd7f0/Javier-Manquillo"]),

  // Javier Mascherano
  spell('Javier Mascherano', 'WHU', 'West Ham', 5, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Javier_Mascherano", "https://fbref.com/en/players/5070881b/Javier-Mascherano"]),
  spell('Javier Mascherano', 'LIV', 'Liverpool', 94, '2006/07', '2010/11', ["https://en.wikipedia.org/wiki/Javier_Mascherano", "https://fbref.com/en/players/5070881b/Javier-Mascherano"]),

  // Jay Rodriguez
  spell('Jay Rodriguez', 'SOU', 'Southampton', 68, '2012/13', '2013/14', ["https://en.wikipedia.org/wiki/Jay_Rodriguez", "https://fbref.com/en/players/4ab53cdb/Jay-Rodriguez"]),
  spell('Jay Rodriguez', 'SOU', 'Southampton', 36, '2015/16', '2016/17', ["https://en.wikipedia.org/wiki/Jay_Rodriguez", "https://fbref.com/en/players/4ab53cdb/Jay-Rodriguez"]),
  spell('Jay Rodriguez', 'WBA', 'West Brom', 37, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Jay_Rodriguez", "https://fbref.com/en/players/4ab53cdb/Jay-Rodriguez"]),
  spell('Jay Rodriguez', 'BUR', 'Burnley', 96, '2019/20', '2021/22', ["https://en.wikipedia.org/wiki/Jay_Rodriguez", "https://fbref.com/en/players/4ab53cdb/Jay-Rodriguez"]),
  spell('Jay Rodriguez', 'BUR', 'Burnley', 21, '2023/24', '2023/24', ["https://en.wikipedia.org/wiki/Jay_Rodriguez", "https://fbref.com/en/players/4ab53cdb/Jay-Rodriguez"]),

  // Jeff Hendrick
  spell('Jeff Hendrick', 'BUR', 'Burnley', 122, '2016/17', '2019/20', ["https://en.wikipedia.org/wiki/Jeff_Hendrick", "https://fbref.com/en/players/989d5705/Jeff-Hendrick"]),
  spell('Jeff Hendrick', 'NEW', 'Newcastle', 25, '2020/21', '2021/22', ["https://en.wikipedia.org/wiki/Jeff_Hendrick", "https://fbref.com/en/players/989d5705/Jeff-Hendrick"]),

  // Jeffrey Schlupp
  spell('Jeffrey Schlupp', 'LEI', 'Leicester', 60, '2014/15', '2016/17', ["https://en.wikipedia.org/wiki/Jeffrey_Schlupp", "https://fbref.com/en/players/3312f911/Jeffrey-Schlupp"]),
  spell('Jeffrey Schlupp', 'CRY', 'Palace', 220, '2016/17', '2024/25', ["https://en.wikipedia.org/wiki/Jeffrey_Schlupp", "https://fbref.com/en/players/3312f911/Jeffrey-Schlupp"]),

  // Jermaine Jenas
  spell('Jermaine Jenas', 'NEW', 'Newcastle', 110, '2001/02', '2005/06', ["https://en.wikipedia.org/wiki/Jermaine_Jenas", "https://fbref.com/en/players/3149f712/Jermaine-Jenas"]),
  spell('Jermaine Jenas', 'TOT', 'Spurs', 154, '2005/06', '2010/11', ["https://en.wikipedia.org/wiki/Jermaine_Jenas", "https://fbref.com/en/players/3149f712/Jermaine-Jenas"]),
  spell('Jermaine Jenas', 'TOT', 'Spurs', 1, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Jermaine_Jenas", "https://fbref.com/en/players/3149f712/Jermaine-Jenas"]),
  spell('Jermaine Jenas', 'AVL', 'Aston Villa', 3, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Jermaine_Jenas", "https://fbref.com/en/players/3149f712/Jermaine-Jenas"]),
  spell('Jermaine Jenas', 'QPR', 'QPR', 12, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Jermaine_Jenas", "https://fbref.com/en/players/3149f712/Jermaine-Jenas"]),

  // Jermaine Pennant
  spell('Jermaine Pennant', 'ARS', 'Arsenal', 5, '2002/03', '2002/03', ["https://en.wikipedia.org/wiki/Jermaine_Pennant", "https://fbref.com/en/players/c6043950/Jermaine-Pennant"]),
  spell('Jermaine Pennant', 'ARS', 'Arsenal', 7, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Jermaine_Pennant", "https://fbref.com/en/players/c6043950/Jermaine-Pennant"]),
  spell('Jermaine Pennant', 'LEE', 'Leeds', 36, '2003/04', '2003/04', ["https://en.wikipedia.org/wiki/Jermaine_Pennant", "https://fbref.com/en/players/c6043950/Jermaine-Pennant"]),
  spell('Jermaine Pennant', 'BIR', 'Birmingham', 50, '2004/05', '2005/06', ["https://en.wikipedia.org/wiki/Jermaine_Pennant", "https://fbref.com/en/players/c6043950/Jermaine-Pennant"]),
  spell('Jermaine Pennant', 'LIV', 'Liverpool', 55, '2006/07', '2008/09', ["https://en.wikipedia.org/wiki/Jermaine_Pennant", "https://fbref.com/en/players/c6043950/Jermaine-Pennant"]),
  spell('Jermaine Pennant', 'POR', 'Portsmouth', 13, '2008/09', '2008/09', ["https://en.wikipedia.org/wiki/Jermaine_Pennant", "https://fbref.com/en/players/c6043950/Jermaine-Pennant"]),
  spell('Jermaine Pennant', 'STK', 'Stoke', 65, '2010/11', '2013/14', ["https://en.wikipedia.org/wiki/Jermaine_Pennant", "https://fbref.com/en/players/c6043950/Jermaine-Pennant"]),

  // Jesper Gronkjaer
  spell('Jesper Gronkjaer', 'CHE', 'Chelsea', 88, '2000/01', '2003/04', ["https://en.wikipedia.org/wiki/Jesper_Gr%C3%B8nkj%C3%A6r", "https://fbref.com/en/players/afe43b0f/Jesper-Gronkjaer"]),
  spell('Jesper Gronkjaer', 'BIR', 'Birmingham', 16, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Jesper_Gr%C3%B8nkj%C3%A6r", "https://fbref.com/en/players/afe43b0f/Jesper-Gronkjaer"]),

  // Jesse Lingard
  spell('Jesse Lingard', 'MUN', 'Man United', 133, '2014/15', '2019/20', ["https://en.wikipedia.org/wiki/Jesse_Lingard", "https://fbref.com/en/players/810e3c74/Jesse-Lingard"]),
  spell('Jesse Lingard', 'MUN', 'Man United', 16, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Jesse_Lingard", "https://fbref.com/en/players/810e3c74/Jesse-Lingard"]),
  spell('Jesse Lingard', 'WHU', 'West Ham', 16, '2020/21', '2020/21', ["https://en.wikipedia.org/wiki/Jesse_Lingard", "https://fbref.com/en/players/810e3c74/Jesse-Lingard"]),
  spell('Jesse Lingard', 'NFO', 'Forest', 17, '2022/23', '2022/23', ["https://en.wikipedia.org/wiki/Jesse_Lingard", "https://fbref.com/en/players/810e3c74/Jesse-Lingard"]),

  // Jimmy Bullard
  spell('Jimmy Bullard', 'WIG', 'Wigan', 36, '2005/06', '2005/06', ["https://en.wikipedia.org/wiki/Jimmy_Bullard", "https://fbref.com/en/players/d46ae0c2/Jimmy-Bullard"]),
  spell('Jimmy Bullard', 'FUL', 'Fulham', 39, '2006/07', '2008/09', ["https://en.wikipedia.org/wiki/Jimmy_Bullard", "https://fbref.com/en/players/d46ae0c2/Jimmy-Bullard"]),
  spell('Jimmy Bullard', 'HUL', 'Hull', 15, '2008/09', '2009/10', ["https://en.wikipedia.org/wiki/Jimmy_Bullard", "https://fbref.com/en/players/d46ae0c2/Jimmy-Bullard"]),

  // Jimmy Floyd Hasselbaink
  spell('Jimmy Floyd Hasselbaink', 'LEE', 'Leeds', 69, '1997/98', '1998/99', ["https://en.wikipedia.org/wiki/Jimmy_Floyd_Hasselbaink", "https://fbref.com/en/players/db8a04d1/Jimmy-Floyd-Hasselbaink"]),
  spell('Jimmy Floyd Hasselbaink', 'CHE', 'Chelsea', 136, '2000/01', '2003/04', ["https://en.wikipedia.org/wiki/Jimmy_Floyd_Hasselbaink", "https://fbref.com/en/players/db8a04d1/Jimmy-Floyd-Hasselbaink"]),
  spell('Jimmy Floyd Hasselbaink', 'MID', 'Middlesbrough', 58, '2004/05', '2005/06', ["https://en.wikipedia.org/wiki/Jimmy_Floyd_Hasselbaink", "https://fbref.com/en/players/db8a04d1/Jimmy-Floyd-Hasselbaink"]),
  spell('Jimmy Floyd Hasselbaink', 'CHA', 'Charlton', 25, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Jimmy_Floyd_Hasselbaink", "https://fbref.com/en/players/db8a04d1/Jimmy-Floyd-Hasselbaink"]),

  // Joe Allen
  spell('Joe Allen', 'SWA', 'Swansea', 36, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Joe_Allen", "https://fbref.com/en/players/9feb8f24/Joe-Allen"]),
  spell('Joe Allen', 'LIV', 'Liverpool', 91, '2012/13', '2015/16', ["https://en.wikipedia.org/wiki/Joe_Allen", "https://fbref.com/en/players/9feb8f24/Joe-Allen"]),
  spell('Joe Allen', 'STK', 'Stoke', 72, '2016/17', '2017/18', ["https://en.wikipedia.org/wiki/Joe_Allen", "https://fbref.com/en/players/9feb8f24/Joe-Allen"]),

  // Joey Barton
  spell('Joey Barton', 'MCI', 'Man City', 130, '2002/03', '2006/07', ["https://en.wikipedia.org/wiki/Joey_Barton", "https://fbref.com/en/players/93bfa675/Joey-Barton"]),
  spell('Joey Barton', 'NEW', 'Newcastle', 32, '2007/08', '2008/09', ["https://en.wikipedia.org/wiki/Joey_Barton", "https://fbref.com/en/players/93bfa675/Joey-Barton"]),
  spell('Joey Barton', 'NEW', 'Newcastle', 34, '2010/11', '2011/12', ["https://en.wikipedia.org/wiki/Joey_Barton", "https://fbref.com/en/players/93bfa675/Joey-Barton"]),
  spell('Joey Barton', 'QPR', 'QPR', 31, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Joey_Barton", "https://fbref.com/en/players/93bfa675/Joey-Barton"]),
  spell('Joey Barton', 'QPR', 'QPR', 28, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Joey_Barton", "https://fbref.com/en/players/93bfa675/Joey-Barton"]),
  spell('Joey Barton', 'BUR', 'Burnley', 14, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Joey_Barton", "https://fbref.com/en/players/93bfa675/Joey-Barton"]),

  // John Barnes
  spell('John Barnes', 'LIV', 'Liverpool', 162, '1992/93', '1996/97', ["https://en.wikipedia.org/wiki/John_Barnes", "https://fbref.com/en/players/e654196b/John-Barnes"]),
  spell('John Barnes', 'NEW', 'Newcastle', 27, '1997/98', '1998/99', ["https://en.wikipedia.org/wiki/John_Barnes", "https://fbref.com/en/players/e654196b/John-Barnes"]),
  spell('John Barnes', 'CHA', 'Charlton', 12, '1998/99', '1998/99', ["https://en.wikipedia.org/wiki/John_Barnes", "https://fbref.com/en/players/e654196b/John-Barnes"]),

  // John Carew
  spell('John Carew', 'AVL', 'Aston Villa', 113, '2006/07', '2010/11', ["https://en.wikipedia.org/wiki/John_Carew", "https://fbref.com/en/players/91ef929d/John-Carew"]),
  spell('John Carew', 'STK', 'Stoke', 10, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/John_Carew", "https://fbref.com/en/players/91ef929d/John-Carew"]),

  // John Lukic
  spell('John Lukic', 'LEE', 'Leeds', 129, '1992/93', '1995/96', ["https://en.wikipedia.org/wiki/John_Lukic", "https://fbref.com/en/players/99095d88/John-Lukic"]),
  spell('John Lukic', 'ARS', 'Arsenal', 15, '1996/97', '1996/97', ["https://en.wikipedia.org/wiki/John_Lukic", "https://fbref.com/en/players/99095d88/John-Lukic"]),
  spell('John Lukic', 'ARS', 'Arsenal', 3, '2000/01', '2000/01', ["https://en.wikipedia.org/wiki/John_Lukic", "https://fbref.com/en/players/99095d88/John-Lukic"]),

  // Joleon Lescott
  spell('Joleon Lescott', 'EVE', 'Everton', 113, '2006/07', '2009/10', ["https://en.wikipedia.org/wiki/Joleon_Lescott", "https://fbref.com/en/players/62393d3b/Joleon-Lescott"]),
  spell('Joleon Lescott', 'MCI', 'Man City', 107, '2009/10', '2013/14', ["https://en.wikipedia.org/wiki/Joleon_Lescott", "https://fbref.com/en/players/62393d3b/Joleon-Lescott"]),
  spell('Joleon Lescott', 'WBA', 'West Brom', 36, '2014/15', '2015/16', ["https://en.wikipedia.org/wiki/Joleon_Lescott", "https://fbref.com/en/players/62393d3b/Joleon-Lescott"]),
  spell('Joleon Lescott', 'AVL', 'Aston Villa', 30, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Joleon_Lescott", "https://fbref.com/en/players/62393d3b/Joleon-Lescott"]),
  spell('Joleon Lescott', 'SUN', 'Sunderland', 2, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Joleon_Lescott", "https://fbref.com/en/players/62393d3b/Joleon-Lescott"]),

  // Jonathan Spector
  spell('Jonathan Spector', 'MUN', 'Man United', 3, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Jonathan_Spector", "https://fbref.com/en/players/3670bd5c/Jonathan-Spector"]),
  spell('Jonathan Spector', 'CHA', 'Charlton', 20, '2005/06', '2005/06', ["https://en.wikipedia.org/wiki/Jonathan_Spector", "https://fbref.com/en/players/3670bd5c/Jonathan-Spector"]),
  spell('Jonathan Spector', 'WHU', 'West Ham', 101, '2006/07', '2010/11', ["https://en.wikipedia.org/wiki/Jonathan_Spector", "https://fbref.com/en/players/3670bd5c/Jonathan-Spector"]),

  // Kalvin Phillips
  spell('Kalvin Phillips', 'LEE', 'Leeds', 49, '2020/21', '2021/22', ["https://en.wikipedia.org/wiki/Kalvin_Phillips", "https://fbref.com/en/players/4f565d77/Kalvin-Phillips"]),
  spell('Kalvin Phillips', 'MCI', 'Man City', 16, '2022/23', '2023/24', ["https://en.wikipedia.org/wiki/Kalvin_Phillips", "https://fbref.com/en/players/4f565d77/Kalvin-Phillips"]),
  spell('Kalvin Phillips', 'WHU', 'West Ham', 8, '2023/24', '2023/24', ["https://en.wikipedia.org/wiki/Kalvin_Phillips", "https://fbref.com/en/players/4f565d77/Kalvin-Phillips"]),
  spell('Kalvin Phillips', 'IPS', 'Ipswich', 19, '2024/25', '2024/25', ["https://en.wikipedia.org/wiki/Kalvin_Phillips", "https://fbref.com/en/players/4f565d77/Kalvin-Phillips"]),

  // Karl Henry
  spell('Karl Henry', 'WOL', 'Wolves', 94, '2009/10', '2011/12', ["https://en.wikipedia.org/wiki/Karl_Henry", "https://fbref.com/en/players/5eac3bb7/Karl-Henry"]),
  spell('Karl Henry', 'QPR', 'QPR', 33, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Karl_Henry", "https://fbref.com/en/players/5eac3bb7/Karl-Henry"]),

  // Kasey Keller
  spell('Kasey Keller', 'LEI', 'Leicester', 99, '1996/97', '1998/99', ["https://en.wikipedia.org/wiki/Kasey_Keller", "https://fbref.com/en/players/5b5bcd83/Kasey-Keller"]),
  spell('Kasey Keller', 'TOT', 'Spurs', 85, '2001/02', '2003/04', ["https://en.wikipedia.org/wiki/Kasey_Keller", "https://fbref.com/en/players/5b5bcd83/Kasey-Keller"]),
  spell('Kasey Keller', 'SOU', 'Southampton', 4, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Kasey_Keller", "https://fbref.com/en/players/5b5bcd83/Kasey-Keller"]),
  spell('Kasey Keller', 'FUL', 'Fulham', 13, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Kasey_Keller", "https://fbref.com/en/players/5b5bcd83/Kasey-Keller"]),

  // Kevin De Bruyne
  spell('Kevin De Bruyne', 'CHE', 'Chelsea', 3, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Kevin_De_Bruyne", "https://fbref.com/en/players/e46012d4/Kevin-De-Bruyne"]),
  spell('Kevin De Bruyne', 'MCI', 'Man City', 285, '2015/16', '2024/25', ["https://en.wikipedia.org/wiki/Kevin_De_Bruyne", "https://fbref.com/en/players/e46012d4/Kevin-De-Bruyne"]),

  // Kevin Doyle
  spell('Kevin Doyle', 'REA', 'Reading', 68, '2006/07', '2007/08', ["https://en.wikipedia.org/wiki/Kevin_Doyle_(footballer)", "https://fbref.com/en/players/c4689de2/Kevin-Doyle"]),
  spell('Kevin Doyle', 'WOL', 'Wolves', 93, '2009/10', '2011/12', ["https://en.wikipedia.org/wiki/Kevin_Doyle_(footballer)", "https://fbref.com/en/players/c4689de2/Kevin-Doyle"]),
  spell('Kevin Doyle', 'CRY', 'Palace', 3, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Kevin_Doyle_(footballer)", "https://fbref.com/en/players/c4689de2/Kevin-Doyle"]),

  // Kieran Gibbs
  spell('Kieran Gibbs', 'ARS', 'Arsenal', 137, '2008/09', '2016/17', ["https://en.wikipedia.org/wiki/Kieran_Gibbs", "https://fbref.com/en/players/46ee5234/Kieran-Gibbs"]),
  spell('Kieran Gibbs', 'WBA', 'West Brom', 33, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Kieran_Gibbs", "https://fbref.com/en/players/46ee5234/Kieran-Gibbs"]),
  spell('Kieran Gibbs', 'WBA', 'West Brom', 10, '2020/21', '2020/21', ["https://en.wikipedia.org/wiki/Kieran_Gibbs", "https://fbref.com/en/players/46ee5234/Kieran-Gibbs"]),

  // Kieran Richardson
  spell('Kieran Richardson', 'MUN', 'Man United', 2, '2002/03', '2002/03', ["https://en.wikipedia.org/wiki/Kieran_Richardson", "https://fbref.com/en/players/d2bf40b4/Kieran-Richardson"]),
  spell('Kieran Richardson', 'MUN', 'Man United', 39, '2004/05', '2006/07', ["https://en.wikipedia.org/wiki/Kieran_Richardson", "https://fbref.com/en/players/d2bf40b4/Kieran-Richardson"]),
  spell('Kieran Richardson', 'WBA', 'West Brom', 12, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Kieran_Richardson", "https://fbref.com/en/players/d2bf40b4/Kieran-Richardson"]),
  spell('Kieran Richardson', 'SUN', 'Sunderland', 134, '2007/08', '2012/13', ["https://en.wikipedia.org/wiki/Kieran_Richardson", "https://fbref.com/en/players/d2bf40b4/Kieran-Richardson"]),
  spell('Kieran Richardson', 'FUL', 'Fulham', 45, '2012/13', '2013/14', ["https://en.wikipedia.org/wiki/Kieran_Richardson", "https://fbref.com/en/players/d2bf40b4/Kieran-Richardson"]),
  spell('Kieran Richardson', 'AVL', 'Aston Villa', 33, '2014/15', '2015/16', ["https://en.wikipedia.org/wiki/Kieran_Richardson", "https://fbref.com/en/players/d2bf40b4/Kieran-Richardson"]),

  // Kieron Dyer
  spell('Kieron Dyer', 'NEW', 'Newcastle', 190, '1999/00', '2006/07', ["https://en.wikipedia.org/wiki/Kieron_Dyer", "https://fbref.com/en/players/90b5a2f2/Kieron-Dyer"]),
  spell('Kieron Dyer', 'WHU', 'West Ham', 30, '2007/08', '2010/11', ["https://en.wikipedia.org/wiki/Kieron_Dyer", "https://fbref.com/en/players/90b5a2f2/Kieron-Dyer"]),
  spell('Kieron Dyer', 'QPR', 'QPR', 5, '2011/12', '2012/13', ["https://en.wikipedia.org/wiki/Kieron_Dyer", "https://fbref.com/en/players/90b5a2f2/Kieron-Dyer"]),

  // Kurt Zouma
  spell('Kurt Zouma', 'CHE', 'Chelsea', 47, '2014/15', '2016/17', ["https://en.wikipedia.org/wiki/Kurt_Zouma", "https://fbref.com/en/players/ce4246f5/Kurt-Zouma"]),
  spell('Kurt Zouma', 'CHE', 'Chelsea', 52, '2019/20', '2020/21', ["https://en.wikipedia.org/wiki/Kurt_Zouma", "https://fbref.com/en/players/ce4246f5/Kurt-Zouma"]),
  spell('Kurt Zouma', 'STK', 'Stoke', 34, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Kurt_Zouma", "https://fbref.com/en/players/ce4246f5/Kurt-Zouma"]),
  spell('Kurt Zouma', 'EVE', 'Everton', 32, '2018/19', '2018/19', ["https://en.wikipedia.org/wiki/Kurt_Zouma", "https://fbref.com/en/players/ce4246f5/Kurt-Zouma"]),
  spell('Kurt Zouma', 'WHU', 'West Ham', 82, '2021/22', '2023/24', ["https://en.wikipedia.org/wiki/Kurt_Zouma", "https://fbref.com/en/players/ce4246f5/Kurt-Zouma"]),

  // Leander Dendoncker
  spell('Leander Dendoncker', 'WOL', 'Wolves', 124, '2018/19', '2022/23', ["https://en.wikipedia.org/wiki/Leander_Dendoncker", "https://fbref.com/en/players/5a7301ae/Leander-Dendoncker"]),
  spell('Leander Dendoncker', 'AVL', 'Aston Villa', 28, '2022/23', '2023/24', ["https://en.wikipedia.org/wiki/Leander_Dendoncker", "https://fbref.com/en/players/5a7301ae/Leander-Dendoncker"]),

  // Leandro Bacuna
  spell('Leandro Bacuna', 'AVL', 'Aston Villa', 85, '2013/14', '2015/16', ["https://en.wikipedia.org/wiki/Leandro_Bacuna", "https://fbref.com/en/players/9dc69d38/Leandro-Bacuna"]),
  spell('Leandro Bacuna', 'CAR', 'Cardiff', 11, '2018/19', '2018/19', ["https://en.wikipedia.org/wiki/Leandro_Bacuna", "https://fbref.com/en/players/9dc69d38/Leandro-Bacuna"]),

  // Lee Bowyer
  spell('Lee Bowyer', 'LEE', 'Leeds', 203, '1996/97', '2002/03', ["https://en.wikipedia.org/wiki/Lee_Bowyer", "https://fbref.com/en/players/f4fd57ba/Lee-Bowyer"]),
  spell('Lee Bowyer', 'WHU', 'West Ham', 10, '2002/03', '2002/03', ["https://en.wikipedia.org/wiki/Lee_Bowyer", "https://fbref.com/en/players/f4fd57ba/Lee-Bowyer"]),
  spell('Lee Bowyer', 'WHU', 'West Ham', 41, '2006/07', '2008/09', ["https://en.wikipedia.org/wiki/Lee_Bowyer", "https://fbref.com/en/players/f4fd57ba/Lee-Bowyer"]),
  spell('Lee Bowyer', 'NEW', 'Newcastle', 79, '2003/04', '2005/06', ["https://en.wikipedia.org/wiki/Lee_Bowyer", "https://fbref.com/en/players/f4fd57ba/Lee-Bowyer"]),
  spell('Lee Bowyer', 'BIR', 'Birmingham', 64, '2009/10', '2010/11', ["https://en.wikipedia.org/wiki/Lee_Bowyer", "https://fbref.com/en/players/f4fd57ba/Lee-Bowyer"]),

  // Lee Carsley
  spell('Lee Carsley', 'DER', 'Derby', 80, '1996/97', '1998/99', ["https://en.wikipedia.org/wiki/Lee_Carsley", "https://fbref.com/en/players/8393a60b/Lee-Carsley"]),
  spell('Lee Carsley', 'BLA', 'Blackburn', 8, '1998/99', '1998/99', ["https://en.wikipedia.org/wiki/Lee_Carsley", "https://fbref.com/en/players/8393a60b/Lee-Carsley"]),
  spell('Lee Carsley', 'COV', 'Coventry', 21, '2000/01', '2000/01', ["https://en.wikipedia.org/wiki/Lee_Carsley", "https://fbref.com/en/players/8393a60b/Lee-Carsley"]),
  spell('Lee Carsley', 'EVE', 'Everton', 166, '2001/02', '2007/08', ["https://en.wikipedia.org/wiki/Lee_Carsley", "https://fbref.com/en/players/8393a60b/Lee-Carsley"]),
  spell('Lee Carsley', 'BIR', 'Birmingham', 7, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Lee_Carsley", "https://fbref.com/en/players/8393a60b/Lee-Carsley"]),

  // Lee Chapman
  spell('Lee Chapman', 'LEE', 'Leeds', 40, '1992/93', '1992/93', ["https://en.wikipedia.org/wiki/Lee_Chapman", "https://fbref.com/en/players/2fecb27a/Lee-Chapman"]),
  spell('Lee Chapman', 'LEE', 'Leeds', 2, '1995/96', '1995/96', ["https://en.wikipedia.org/wiki/Lee_Chapman", "https://fbref.com/en/players/2fecb27a/Lee-Chapman"]),
  spell('Lee Chapman', 'WHU', 'West Ham', 40, '1993/94', '1994/95', ["https://en.wikipedia.org/wiki/Lee_Chapman", "https://fbref.com/en/players/2fecb27a/Lee-Chapman"]),
  spell('Lee Chapman', 'IPS', 'Ipswich', 16, '1994/95', '1994/95', ["https://en.wikipedia.org/wiki/Lee_Chapman", "https://fbref.com/en/players/2fecb27a/Lee-Chapman"]),

  // Liam Cooper
  spell('Liam Cooper', 'HUL', 'Hull', 2, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Liam_Cooper", "https://fbref.com/en/players/dc64b8b3/Liam-Cooper"]),
  spell('Liam Cooper', 'LEE', 'Leeds', 64, '2020/21', '2022/23', ["https://en.wikipedia.org/wiki/Liam_Cooper", "https://fbref.com/en/players/dc64b8b3/Liam-Cooper"]),

  // Liam Ridgewell
  spell('Liam Ridgewell', 'AVL', 'Aston Villa', 79, '2003/04', '2006/07', ["https://en.wikipedia.org/wiki/Liam_Ridgewell", "https://fbref.com/en/players/7c9e057e/Liam-Ridgewell"]),
  spell('Liam Ridgewell', 'BIR', 'Birmingham', 35, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Liam_Ridgewell", "https://fbref.com/en/players/7c9e057e/Liam-Ridgewell"]),
  spell('Liam Ridgewell', 'BIR', 'Birmingham', 67, '2009/10', '2010/11', ["https://en.wikipedia.org/wiki/Liam_Ridgewell", "https://fbref.com/en/players/7c9e057e/Liam-Ridgewell"]),
  spell('Liam Ridgewell', 'WBA', 'West Brom', 76, '2011/12', '2013/14', ["https://en.wikipedia.org/wiki/Liam_Ridgewell", "https://fbref.com/en/players/7c9e057e/Liam-Ridgewell"]),

  // Liam Rosenior
  spell('Liam Rosenior', 'FUL', 'Fulham', 79, '2004/05', '2006/07', ["https://en.wikipedia.org/wiki/Liam_Rosenior", "https://fbref.com/en/players/8b0d6fe9/Liam-Rosenior"]),
  spell('Liam Rosenior', 'REA', 'Reading', 17, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Liam_Rosenior", "https://fbref.com/en/players/8b0d6fe9/Liam-Rosenior"]),
  spell('Liam Rosenior', 'HUL', 'Hull', 42, '2013/14', '2014/15', ["https://en.wikipedia.org/wiki/Liam_Rosenior", "https://fbref.com/en/players/8b0d6fe9/Liam-Rosenior"]),
  spell('Liam Rosenior', 'BHA', 'Brighton', 3, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Liam_Rosenior", "https://fbref.com/en/players/8b0d6fe9/Liam-Rosenior"]),

  // Lloyd Kelly
  spell('Lloyd Kelly', 'BOU', 'Bournemouth', 8, '2019/20', '2019/20', ["https://en.wikipedia.org/wiki/Lloyd_Kelly", "https://fbref.com/en/players/f31def1e/Lloyd-Kelly"]),
  spell('Lloyd Kelly', 'BOU', 'Bournemouth', 46, '2022/23', '2023/24', ["https://en.wikipedia.org/wiki/Lloyd_Kelly", "https://fbref.com/en/players/f31def1e/Lloyd-Kelly"]),
  spell('Lloyd Kelly', 'NEW', 'Newcastle', 10, '2024/25', '2024/25', ["https://en.wikipedia.org/wiki/Lloyd_Kelly", "https://fbref.com/en/players/f31def1e/Lloyd-Kelly"]),

  // Louis Saha
  spell('Louis Saha', 'NEW', 'Newcastle', 11, '1998/99', '1998/99', ["https://en.wikipedia.org/wiki/Louis_Saha", "https://fbref.com/en/players/7106e4fe/Louis-Saha"]),
  spell('Louis Saha', 'FUL', 'Fulham', 74, '2001/02', '2003/04', ["https://en.wikipedia.org/wiki/Louis_Saha", "https://fbref.com/en/players/7106e4fe/Louis-Saha"]),
  spell('Louis Saha', 'MUN', 'Man United', 86, '2003/04', '2007/08', ["https://en.wikipedia.org/wiki/Louis_Saha", "https://fbref.com/en/players/7106e4fe/Louis-Saha"]),
  spell('Louis Saha', 'EVE', 'Everton', 97, '2008/09', '2011/12', ["https://en.wikipedia.org/wiki/Louis_Saha", "https://fbref.com/en/players/7106e4fe/Louis-Saha"]),
  spell('Louis Saha', 'TOT', 'Spurs', 10, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Louis_Saha", "https://fbref.com/en/players/7106e4fe/Louis-Saha"]),
  spell('Louis Saha', 'SUN', 'Sunderland', 11, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Louis_Saha", "https://fbref.com/en/players/7106e4fe/Louis-Saha"]),

  // Lys Mousset
  spell('Lys Mousset', 'BOU', 'Bournemouth', 58, '2016/17', '2018/19', ["https://en.wikipedia.org/wiki/Lys_Mousset", "https://fbref.com/en/players/d9cfca3d/Lys-Mousset"]),
  spell('Lys Mousset', 'SHU', 'Sheffield United', 41, '2019/20', '2020/21', ["https://en.wikipedia.org/wiki/Lys_Mousset", "https://fbref.com/en/players/d9cfca3d/Lys-Mousset"]),

  // Marc Edworthy
  spell('Marc Edworthy', 'CRY', 'Palace', 34, '1997/98', '1997/98', ["https://en.wikipedia.org/wiki/Marc_Edworthy", "https://fbref.com/en/players/fc761a49/Marc-Edworthy"]),
  spell('Marc Edworthy', 'COV', 'Coventry', 56, '1998/99', '2000/01', ["https://en.wikipedia.org/wiki/Marc_Edworthy", "https://fbref.com/en/players/fc761a49/Marc-Edworthy"]),
  spell('Marc Edworthy', 'NOR', 'Norwich', 28, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Marc_Edworthy", "https://fbref.com/en/players/fc761a49/Marc-Edworthy"]),
  spell('Marc Edworthy', 'DER', 'Derby', 9, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Marc_Edworthy", "https://fbref.com/en/players/fc761a49/Marc-Edworthy"]),

  // Mario Balotelli
  spell('Mario Balotelli', 'MCI', 'Man City', 54, '2010/11', '2012/13', ["https://en.wikipedia.org/wiki/Mario_Balotelli", "https://fbref.com/en/players/8ff07990/Mario-Balotelli"]),
  spell('Mario Balotelli', 'LIV', 'Liverpool', 16, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Mario_Balotelli", "https://fbref.com/en/players/8ff07990/Mario-Balotelli"]),

  // Mario Lemina
  spell('Mario Lemina', 'SOU', 'Southampton', 46, '2017/18', '2018/19', ["https://en.wikipedia.org/wiki/Mario_Lemina", "https://fbref.com/en/players/2b471f99/Mario-Lemina"]),
  spell('Mario Lemina', 'FUL', 'Fulham', 28, '2020/21', '2020/21', ["https://en.wikipedia.org/wiki/Mario_Lemina", "https://fbref.com/en/players/2b471f99/Mario-Lemina"]),
  spell('Mario Lemina', 'WOL', 'Wolves', 71, '2022/23', '2024/25', ["https://en.wikipedia.org/wiki/Mario_Lemina", "https://fbref.com/en/players/2b471f99/Mario-Lemina"]),

  // Mario Melchiot
  spell('Mario Melchiot', 'CHE', 'Chelsea', 130, '1999/00', '2003/04', ["https://en.wikipedia.org/wiki/Mario_Melchiot", "https://fbref.com/en/players/1f5e2ed9/Mario-Melchiot"]),
  spell('Mario Melchiot', 'BIR', 'Birmingham', 57, '2004/05', '2005/06', ["https://en.wikipedia.org/wiki/Mario_Melchiot", "https://fbref.com/en/players/1f5e2ed9/Mario-Melchiot"]),
  spell('Mario Melchiot', 'WIG', 'Wigan', 97, '2007/08', '2009/10', ["https://en.wikipedia.org/wiki/Mario_Melchiot", "https://fbref.com/en/players/1f5e2ed9/Mario-Melchiot"]),

  // Mark Bosnich
  spell('Mark Bosnich', 'AVL', 'Aston Villa', 178, '1992/93', '1998/99', ["https://en.wikipedia.org/wiki/Mark_Bosnich", "https://fbref.com/en/players/9b46bcb7/Mark-Bosnich"]),
  spell('Mark Bosnich', 'MUN', 'Man United', 23, '1999/00', '1999/00', ["https://en.wikipedia.org/wiki/Mark_Bosnich", "https://fbref.com/en/players/9b46bcb7/Mark-Bosnich"]),
  spell('Mark Bosnich', 'CHE', 'Chelsea', 5, '2001/02', '2001/02', ["https://en.wikipedia.org/wiki/Mark_Bosnich", "https://fbref.com/en/players/9b46bcb7/Mark-Bosnich"]),

  // Mark Draper
  spell('Mark Draper', 'LEI', 'Leicester', 39, '1994/95', '1994/95', ["https://en.wikipedia.org/wiki/Mark_Draper", "https://fbref.com/en/players/bf597500/Mark-Draper"]),
  spell('Mark Draper', 'AVL', 'Aston Villa', 120, '1995/96', '1999/00', ["https://en.wikipedia.org/wiki/Mark_Draper", "https://fbref.com/en/players/bf597500/Mark-Draper"]),
  spell('Mark Draper', 'SOU', 'Southampton', 24, '2000/01', '2001/02', ["https://en.wikipedia.org/wiki/Mark_Draper", "https://fbref.com/en/players/bf597500/Mark-Draper"]),

  // Marko Arnautovic
  spell('Marko Arnautovic', 'STK', 'Stoke', 125, '2013/14', '2016/17', ["https://en.wikipedia.org/wiki/Marko_Arnautovi%C4%87", "https://fbref.com/en/players/00459419/Marko-Arnautovic"]),
  spell('Marko Arnautovic', 'WHU', 'West Ham', 59, '2017/18', '2018/19', ["https://en.wikipedia.org/wiki/Marko_Arnautovi%C4%87", "https://fbref.com/en/players/00459419/Marko-Arnautovic"]),

  // Marlon Harewood
  spell('Marlon Harewood', 'NFO', 'Forest', 23, '1998/99', '1998/99', ["https://en.wikipedia.org/wiki/Marlon_Harewood", "https://fbref.com/en/players/34dab521/Marlon-Harewood"]),
  spell('Marlon Harewood', 'WHU', 'West Ham', 69, '2005/06', '2006/07', ["https://en.wikipedia.org/wiki/Marlon_Harewood", "https://fbref.com/en/players/34dab521/Marlon-Harewood"]),
  spell('Marlon Harewood', 'AVL', 'Aston Villa', 29, '2007/08', '2008/09', ["https://en.wikipedia.org/wiki/Marlon_Harewood", "https://fbref.com/en/players/34dab521/Marlon-Harewood"]),
  spell('Marlon Harewood', 'BLP', 'Blackpool', 16, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Marlon_Harewood", "https://fbref.com/en/players/34dab521/Marlon-Harewood"]),

  // Marouane Chamakh
  spell('Marouane Chamakh', 'ARS', 'Arsenal', 40, '2010/11', '2011/12', ["https://en.wikipedia.org/wiki/Marouane_Chamakh", "https://fbref.com/en/players/790ca5f3/Marouane-Chamakh"]),
  spell('Marouane Chamakh', 'WHU', 'West Ham', 3, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Marouane_Chamakh", "https://fbref.com/en/players/790ca5f3/Marouane-Chamakh"]),
  spell('Marouane Chamakh', 'CRY', 'Palace', 60, '2013/14', '2015/16', ["https://en.wikipedia.org/wiki/Marouane_Chamakh", "https://fbref.com/en/players/790ca5f3/Marouane-Chamakh"]),

  // Marvin Sordell
  spell('Marvin Sordell', 'BOL', 'Bolton', 3, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Marvin_Sordell", "https://fbref.com/en/players/9f596d20/Marvin-Sordell"]),
  spell('Marvin Sordell', 'BUR', 'Burnley', 14, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Marvin_Sordell", "https://fbref.com/en/players/9f596d20/Marvin-Sordell"]),

  // Mason Holgate
  spell('Mason Holgate', 'EVE', 'Everton', 126, '2016/17', '2022/23', ["https://en.wikipedia.org/wiki/Mason_Holgate", "https://fbref.com/en/players/d0042ab9/Mason-Holgate"]),
  spell('Mason Holgate', 'EVE', 'Everton', 1, '2024/25', '2024/25', ["https://en.wikipedia.org/wiki/Mason_Holgate", "https://fbref.com/en/players/d0042ab9/Mason-Holgate"]),
  spell('Mason Holgate', 'SHU', 'Sheffield United', 10, '2023/24', '2023/24', ["https://en.wikipedia.org/wiki/Mason_Holgate", "https://fbref.com/en/players/d0042ab9/Mason-Holgate"]),

  // Mathieu Flamini
  spell('Mathieu Flamini', 'ARS', 'Arsenal', 102, '2004/05', '2007/08', ["https://en.wikipedia.org/wiki/Mathieu_Flamini", "https://fbref.com/en/players/148d4105/Mathieu-Flamini"]),
  spell('Mathieu Flamini', 'ARS', 'Arsenal', 66, '2013/14', '2015/16', ["https://en.wikipedia.org/wiki/Mathieu_Flamini", "https://fbref.com/en/players/148d4105/Mathieu-Flamini"]),
  spell('Mathieu Flamini', 'CRY', 'Palace', 10, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Mathieu_Flamini", "https://fbref.com/en/players/148d4105/Mathieu-Flamini"]),

  // Matt Jarvis
  spell('Matt Jarvis', 'WOL', 'Wolves', 108, '2009/10', '2011/12', ["https://en.wikipedia.org/wiki/Matt_Jarvis", "https://fbref.com/en/players/02d6d2b4/Matthew-Jarvis"]),
  spell('Matt Jarvis', 'WHU', 'West Ham', 78, '2012/13', '2015/16', ["https://en.wikipedia.org/wiki/Matt_Jarvis", "https://fbref.com/en/players/02d6d2b4/Matthew-Jarvis"]),
  spell('Matt Jarvis', 'NOR', 'Norwich', 19, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Matt_Jarvis", "https://fbref.com/en/players/02d6d2b4/Matthew-Jarvis"]),

  // Matt Ritchie
  spell('Matt Ritchie', 'POR', 'Portsmouth', 2, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Matt_Ritchie", "https://fbref.com/en/players/71ef519e/Matt-Ritchie"]),
  spell('Matt Ritchie', 'BOU', 'Bournemouth', 37, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Matt_Ritchie", "https://fbref.com/en/players/71ef519e/Matt-Ritchie"]),
  spell('Matt Ritchie', 'NEW', 'Newcastle', 145, '2017/18', '2023/24', ["https://en.wikipedia.org/wiki/Matt_Ritchie", "https://fbref.com/en/players/71ef519e/Matt-Ritchie"]),

  // Matthew Etherington
  spell('Matthew Etherington', 'TOT', 'Spurs', 45, '1999/00', '2002/03', ["https://en.wikipedia.org/wiki/Matthew_Etherington", "https://fbref.com/en/players/ef616df9/Matthew-Etherington"]),
  spell('Matthew Etherington', 'WHU', 'West Ham', 91, '2005/06', '2008/09', ["https://en.wikipedia.org/wiki/Matthew_Etherington", "https://fbref.com/en/players/ef616df9/Matthew-Etherington"]),
  spell('Matthew Etherington', 'STK', 'Stoke', 152, '2008/09', '2013/14', ["https://en.wikipedia.org/wiki/Matthew_Etherington", "https://fbref.com/en/players/ef616df9/Matthew-Etherington"]),

  // Matthew Upson
  spell('Matthew Upson', 'ARS', 'Arsenal', 35, '1997/98', '2001/02', ["https://en.wikipedia.org/wiki/Matthew_Upson", "https://fbref.com/en/players/1a6e6d03/Matt-Upson"]),
  spell('Matthew Upson', 'BIR', 'Birmingham', 104, '2002/03', '2005/06', ["https://en.wikipedia.org/wiki/Matthew_Upson", "https://fbref.com/en/players/1a6e6d03/Matt-Upson"]),
  spell('Matthew Upson', 'WHU', 'West Ham', 131, '2006/07', '2010/11', ["https://en.wikipedia.org/wiki/Matthew_Upson", "https://fbref.com/en/players/1a6e6d03/Matt-Upson"]),
  spell('Matthew Upson', 'STK', 'Stoke', 15, '2011/12', '2012/13', ["https://en.wikipedia.org/wiki/Matthew_Upson", "https://fbref.com/en/players/1a6e6d03/Matt-Upson"]),
  spell('Matthew Upson', 'LEI', 'Leicester', 5, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Matthew_Upson", "https://fbref.com/en/players/1a6e6d03/Matt-Upson"]),

  // Matej Vydra
  spell('Matej Vydra', 'WBA', 'West Brom', 23, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Mat%C4%9Bj_Vydra", "https://fbref.com/en/players/0d4ceb32/Matej-Vydra"]),
  spell('Matej Vydra', 'WAT', 'Watford', 1, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Mat%C4%9Bj_Vydra", "https://fbref.com/en/players/0d4ceb32/Matej-Vydra"]),
  spell('Matej Vydra', 'BUR', 'Burnley', 82, '2018/19', '2021/22', ["https://en.wikipedia.org/wiki/Mat%C4%9Bj_Vydra", "https://fbref.com/en/players/0d4ceb32/Matej-Vydra"]),

  // Max Aarons
  spell('Max Aarons', 'NOR', 'Norwich', 36, '2019/20', '2019/20', ["https://en.wikipedia.org/wiki/Max_Aarons", "https://fbref.com/en/players/774cf58b/Max-Aarons"]),
  spell('Max Aarons', 'NOR', 'Norwich', 34, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Max_Aarons", "https://fbref.com/en/players/774cf58b/Max-Aarons"]),
  spell('Max Aarons', 'BOU', 'Bournemouth', 23, '2023/24', '2024/25', ["https://en.wikipedia.org/wiki/Max_Aarons", "https://fbref.com/en/players/774cf58b/Max-Aarons"]),

  // Maxwel Cornet
  spell('Maxwel Cornet', 'BUR', 'Burnley', 26, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Maxwel_Cornet", "https://fbref.com/en/players/beb391dd/Maxwel-Cornet"]),
  spell('Maxwel Cornet', 'WHU', 'West Ham', 21, '2022/23', '2023/24', ["https://en.wikipedia.org/wiki/Maxwel_Cornet", "https://fbref.com/en/players/beb391dd/Maxwel-Cornet"]),
  spell('Maxwel Cornet', 'SOU', 'Southampton', 2, '2024/25', '2024/25', ["https://en.wikipedia.org/wiki/Maxwel_Cornet", "https://fbref.com/en/players/beb391dd/Maxwel-Cornet"]),

  // Micah Richards
  spell('Micah Richards', 'MCI', 'Man City', 179, '2005/06', '2013/14', ["https://en.wikipedia.org/wiki/Micah_Richards", "https://fbref.com/en/players/ff87875a/Micah-Richards"]),
  spell('Micah Richards', 'AVL', 'Aston Villa', 24, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Micah_Richards", "https://fbref.com/en/players/ff87875a/Micah-Richards"]),

  // Michael Dawson
  spell('Michael Dawson', 'TOT', 'Spurs', 236, '2004/05', '2013/14', ["https://en.wikipedia.org/wiki/Michael_Dawson_(footballer)", "https://fbref.com/en/players/4771114f/Michael-Dawson"]),
  spell('Michael Dawson', 'HUL', 'Hull', 28, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Michael_Dawson_(footballer)", "https://fbref.com/en/players/4771114f/Michael-Dawson"]),
  spell('Michael Dawson', 'HUL', 'Hull', 22, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Michael_Dawson_(footballer)", "https://fbref.com/en/players/4771114f/Michael-Dawson"]),

  // Michael Kightly
  spell('Michael Kightly', 'WOL', 'Wolves', 31, '2009/10', '2011/12', ["https://en.wikipedia.org/wiki/Michael_Kightly", "https://fbref.com/en/players/26e5c484/Michael-Kightly"]),
  spell('Michael Kightly', 'STK', 'Stoke', 22, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Michael_Kightly", "https://fbref.com/en/players/26e5c484/Michael-Kightly"]),
  spell('Michael Kightly', 'BUR', 'Burnley', 17, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Michael_Kightly", "https://fbref.com/en/players/26e5c484/Michael-Kightly"]),
  spell('Michael Kightly', 'BUR', 'Burnley', 5, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Michael_Kightly", "https://fbref.com/en/players/26e5c484/Michael-Kightly"]),

  // Michael Mancienne
  spell('Michael Mancienne', 'CHE', 'Chelsea', 4, '2008/09', '2008/09', ["https://en.wikipedia.org/wiki/Michael_Mancienne", "https://fbref.com/en/players/2db3ae0a/Michael-Mancienne"]),
  spell('Michael Mancienne', 'WOL', 'Wolves', 46, '2009/10', '2010/11', ["https://en.wikipedia.org/wiki/Michael_Mancienne", "https://fbref.com/en/players/2db3ae0a/Michael-Mancienne"]),

  // Michy Batshuayi
  spell('Michy Batshuayi', 'CHE', 'Chelsea', 32, '2016/17', '2017/18', ["https://en.wikipedia.org/wiki/Michy_Batshuayi", "https://fbref.com/en/players/2973d8ff/Michy-Batshuayi"]),
  spell('Michy Batshuayi', 'CHE', 'Chelsea', 16, '2019/20', '2019/20', ["https://en.wikipedia.org/wiki/Michy_Batshuayi", "https://fbref.com/en/players/2973d8ff/Michy-Batshuayi"]),
  spell('Michy Batshuayi', 'CRY', 'Palace', 11, '2018/19', '2018/19', ["https://en.wikipedia.org/wiki/Michy_Batshuayi", "https://fbref.com/en/players/2973d8ff/Michy-Batshuayi"]),
  spell('Michy Batshuayi', 'CRY', 'Palace', 18, '2020/21', '2020/21', ["https://en.wikipedia.org/wiki/Michy_Batshuayi", "https://fbref.com/en/players/2973d8ff/Michy-Batshuayi"]),

  // Mikael Silvestre
  spell('Mikael Silvestre', 'MUN', 'Man United', 249, '1999/00', '2007/08', ["https://en.wikipedia.org/wiki/Mika%C3%ABl_Silvestre", "https://fbref.com/en/players/4dde97ea/Mikael-Silvestre"]),
  spell('Mikael Silvestre', 'ARS', 'Arsenal', 26, '2008/09', '2009/10', ["https://en.wikipedia.org/wiki/Mika%C3%ABl_Silvestre", "https://fbref.com/en/players/4dde97ea/Mikael-Silvestre"]),

  // Mike Sheron
  spell('Mike Sheron', 'MCI', 'Man City', 71, '1992/93', '1993/94', ["https://en.wikipedia.org/wiki/Mike_Sheron", "https://fbref.com/en/players/4377334a/Mike-Sheron"]),
  spell('Mike Sheron', 'NOR', 'Norwich', 21, '1994/95', '1994/95', ["https://en.wikipedia.org/wiki/Mike_Sheron", "https://fbref.com/en/players/4377334a/Mike-Sheron"]),

  // Milan Baros
  spell('Milan Baros', 'LIV', 'Liverpool', 68, '2002/03', '2005/06', ["https://en.wikipedia.org/wiki/Milan_Baro%C5%A1", "https://fbref.com/en/players/f3a9a99b/Milan-Baros"]),
  spell('Milan Baros', 'AVL', 'Aston Villa', 42, '2005/06', '2006/07', ["https://en.wikipedia.org/wiki/Milan_Baro%C5%A1", "https://fbref.com/en/players/f3a9a99b/Milan-Baros"]),
  spell('Milan Baros', 'POR', 'Portsmouth', 12, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Milan_Baro%C5%A1", "https://fbref.com/en/players/f3a9a99b/Milan-Baros"]),

  // Morgan Schneiderlin
  spell('Morgan Schneiderlin', 'SOU', 'Southampton', 95, '2012/13', '2014/15', ["https://en.wikipedia.org/wiki/Morgan_Schneiderlin", "https://fbref.com/en/players/51b41c5c/Morgan-Schneiderlin"]),
  spell('Morgan Schneiderlin', 'MUN', 'Man United', 32, '2015/16', '2016/17', ["https://en.wikipedia.org/wiki/Morgan_Schneiderlin", "https://fbref.com/en/players/51b41c5c/Morgan-Schneiderlin"]),
  spell('Morgan Schneiderlin', 'EVE', 'Everton', 73, '2016/17', '2019/20', ["https://en.wikipedia.org/wiki/Morgan_Schneiderlin", "https://fbref.com/en/players/51b41c5c/Morgan-Schneiderlin"]),

  // Moussa Sissoko
  spell('Moussa Sissoko', 'NEW', 'Newcastle', 118, '2012/13', '2015/16', ["https://en.wikipedia.org/wiki/Moussa_Sissoko", "https://fbref.com/en/players/2acd49b9/Moussa-Sissoko"]),
  spell('Moussa Sissoko', 'TOT', 'Spurs', 141, '2016/17', '2020/21', ["https://en.wikipedia.org/wiki/Moussa_Sissoko", "https://fbref.com/en/players/2acd49b9/Moussa-Sissoko"]),
  spell('Moussa Sissoko', 'WAT', 'Watford', 36, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Moussa_Sissoko", "https://fbref.com/en/players/2acd49b9/Moussa-Sissoko"]),

  // N'Golo Kante
  spell('N\'Golo Kante', 'LEI', 'Leicester', 37, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/N'Golo_Kant%C3%A9", "https://fbref.com/en/players/b9fbae28/N'Golo-Kante"]),
  spell('N\'Golo Kante', 'CHE', 'Chelsea', 190, '2016/17', '2022/23', ["https://en.wikipedia.org/wiki/N'Golo_Kant%C3%A9", "https://fbref.com/en/players/b9fbae28/N'Golo-Kante"]),

  // Nathan Redmond
  spell('Nathan Redmond', 'NOR', 'Norwich', 34, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Nathan_Redmond", "https://fbref.com/en/players/ab651565/Nathan-Redmond"]),
  spell('Nathan Redmond', 'NOR', 'Norwich', 35, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Nathan_Redmond", "https://fbref.com/en/players/ab651565/Nathan-Redmond"]),
  spell('Nathan Redmond', 'SOU', 'Southampton', 195, '2016/17', '2022/23', ["https://en.wikipedia.org/wiki/Nathan_Redmond", "https://fbref.com/en/players/ab651565/Nathan-Redmond"]),
  spell('Nathan Redmond', 'BUR', 'Burnley', 12, '2023/24', '2023/24', ["https://en.wikipedia.org/wiki/Nathan_Redmond", "https://fbref.com/en/players/ab651565/Nathan-Redmond"]),

  // Neal Maupay
  spell('Neal Maupay', 'BHA', 'Brighton', 102, '2019/20', '2021/22', ["https://en.wikipedia.org/wiki/Neal_Maupay", "https://fbref.com/en/players/4bcf39f6/Neal-Maupay"]),
  spell('Neal Maupay', 'EVE', 'Everton', 29, '2022/23', '2023/24', ["https://en.wikipedia.org/wiki/Neal_Maupay", "https://fbref.com/en/players/4bcf39f6/Neal-Maupay"]),
  spell('Neal Maupay', 'BRE', 'Brentford', 29, '2023/24', '2023/24', ["https://en.wikipedia.org/wiki/Neal_Maupay", "https://fbref.com/en/players/4bcf39f6/Neal-Maupay"]),

  // Nedum Onuoha
  spell('Nedum Onuoha', 'MCI', 'Man City', 94, '2004/05', '2009/10', ["https://en.wikipedia.org/wiki/Nedum_Onuoha", "https://fbref.com/en/players/b28a0b5a/Nedum-Onuoha"]),
  spell('Nedum Onuoha', 'MCI', 'Man City', 1, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Nedum_Onuoha", "https://fbref.com/en/players/b28a0b5a/Nedum-Onuoha"]),
  spell('Nedum Onuoha', 'SUN', 'Sunderland', 31, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Nedum_Onuoha", "https://fbref.com/en/players/b28a0b5a/Nedum-Onuoha"]),
  spell('Nedum Onuoha', 'QPR', 'QPR', 39, '2011/12', '2012/13', ["https://en.wikipedia.org/wiki/Nedum_Onuoha", "https://fbref.com/en/players/b28a0b5a/Nedum-Onuoha"]),
  spell('Nedum Onuoha', 'QPR', 'QPR', 23, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Nedum_Onuoha", "https://fbref.com/en/players/b28a0b5a/Nedum-Onuoha"]),

  // Neil Ruddock
  spell('Neil Ruddock', 'TOT', 'Spurs', 38, '1992/93', '1992/93', ["https://en.wikipedia.org/wiki/Neil_Ruddock", "https://fbref.com/en/players/8533db00/Neil-Ruddock"]),
  spell('Neil Ruddock', 'LIV', 'Liverpool', 115, '1993/94', '1997/98', ["https://en.wikipedia.org/wiki/Neil_Ruddock", "https://fbref.com/en/players/8533db00/Neil-Ruddock"]),
  spell('Neil Ruddock', 'WHU', 'West Ham', 42, '1998/99', '1999/00', ["https://en.wikipedia.org/wiki/Neil_Ruddock", "https://fbref.com/en/players/8533db00/Neil-Ruddock"]),

  // Neil Sullivan
  spell('Neil Sullivan', 'WIM', 'Wimbledon', 179, '1992/93', '1999/00', ["https://en.wikipedia.org/wiki/Neil_Sullivan", "https://fbref.com/en/players/2ea16583/Neil-Sullivan"]),
  spell('Neil Sullivan', 'TOT', 'Spurs', 64, '2000/01', '2001/02', ["https://en.wikipedia.org/wiki/Neil_Sullivan", "https://fbref.com/en/players/2ea16583/Neil-Sullivan"]),
  spell('Neil Sullivan', 'CHE', 'Chelsea', 4, '2003/04', '2003/04', ["https://en.wikipedia.org/wiki/Neil_Sullivan", "https://fbref.com/en/players/2ea16583/Neil-Sullivan"]),

  // Neville Southall
  spell('Neville Southall', 'EVE', 'Everton', 207, '1992/93', '1997/98', ["https://en.wikipedia.org/wiki/Neville_Southall", "https://fbref.com/en/players/4ef5450a/Neville-Southall"]),
  spell('Neville Southall', 'BRD', 'Bradford', 1, '1999/00', '1999/00', ["https://en.wikipedia.org/wiki/Neville_Southall", "https://fbref.com/en/players/4ef5450a/Neville-Southall"]),

  // Nicklas Bendtner
  spell('Nicklas Bendtner', 'ARS', 'Arsenal', 99, '2007/08', '2011/12', ["https://en.wikipedia.org/wiki/Nicklas_Bendtner", "https://fbref.com/en/players/9f9c57f0/Nicklas-Bendtner"]),
  spell('Nicklas Bendtner', 'ARS', 'Arsenal', 9, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Nicklas_Bendtner", "https://fbref.com/en/players/9f9c57f0/Nicklas-Bendtner"]),
  spell('Nicklas Bendtner', 'SUN', 'Sunderland', 28, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Nicklas_Bendtner", "https://fbref.com/en/players/9f9c57f0/Nicklas-Bendtner"]),

  // Nigel Quashie
  spell('Nigel Quashie', 'QPR', 'QPR', 11, '1995/96', '1995/96', ["https://en.wikipedia.org/wiki/Nigel_Quashie", "https://fbref.com/en/players/9b9a2d62/Nigel-Quashie"]),
  spell('Nigel Quashie', 'NFO', 'Forest', 16, '1998/99', '1998/99', ["https://en.wikipedia.org/wiki/Nigel_Quashie", "https://fbref.com/en/players/9b9a2d62/Nigel-Quashie"]),
  spell('Nigel Quashie', 'POR', 'Portsmouth', 40, '2003/04', '2004/05', ["https://en.wikipedia.org/wiki/Nigel_Quashie", "https://fbref.com/en/players/9b9a2d62/Nigel-Quashie"]),
  spell('Nigel Quashie', 'SOU', 'Southampton', 13, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Nigel_Quashie", "https://fbref.com/en/players/9b9a2d62/Nigel-Quashie"]),
  spell('Nigel Quashie', 'WBA', 'West Brom', 9, '2005/06', '2005/06', ["https://en.wikipedia.org/wiki/Nigel_Quashie", "https://fbref.com/en/players/9b9a2d62/Nigel-Quashie"]),
  spell('Nigel Quashie', 'WHU', 'West Ham', 7, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Nigel_Quashie", "https://fbref.com/en/players/9b9a2d62/Nigel-Quashie"]),

  // Nigel Worthington
  spell('Nigel Worthington', 'SHW', 'Sheffield Wednesday', 71, '1992/93', '1993/94', ["https://en.wikipedia.org/wiki/Nigel_Worthington", "https://fbref.com/en/players/20a32162/Nigel-Worthington"]),
  spell('Nigel Worthington', 'LEE', 'Leeds', 43, '1994/95', '1995/96', ["https://en.wikipedia.org/wiki/Nigel_Worthington", "https://fbref.com/en/players/20a32162/Nigel-Worthington"]),

  // Nolberto Solano
  spell('Nolberto Solano', 'NEW', 'Newcastle', 172, '1998/99', '2003/04', ["https://en.wikipedia.org/wiki/Nolberto_Solano", "https://fbref.com/en/players/37e7c753/Nolberto-Solano"]),
  spell('Nolberto Solano', 'NEW', 'Newcastle', 58, '2005/06', '2007/08', ["https://en.wikipedia.org/wiki/Nolberto_Solano", "https://fbref.com/en/players/37e7c753/Nolberto-Solano"]),
  spell('Nolberto Solano', 'AVL', 'Aston Villa', 49, '2003/04', '2005/06', ["https://en.wikipedia.org/wiki/Nolberto_Solano", "https://fbref.com/en/players/37e7c753/Nolberto-Solano"]),
  spell('Nolberto Solano', 'WHU', 'West Ham', 23, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Nolberto_Solano", "https://fbref.com/en/players/37e7c753/Nolberto-Solano"]),

  // Nwankwo Kanu
  spell('Nwankwo Kanu', 'ARS', 'Arsenal', 119, '1998/99', '2003/04', ["https://en.wikipedia.org/wiki/Nwankwo_Kanu", "https://fbref.com/en/players/12578cde/Nwankwo-Kanu"]),
  spell('Nwankwo Kanu', 'WBA', 'West Brom', 53, '2004/05', '2005/06', ["https://en.wikipedia.org/wiki/Nwankwo_Kanu", "https://fbref.com/en/players/12578cde/Nwankwo-Kanu"]),
  spell('Nwankwo Kanu', 'POR', 'Portsmouth', 101, '2006/07', '2009/10', ["https://en.wikipedia.org/wiki/Nwankwo_Kanu", "https://fbref.com/en/players/12578cde/Nwankwo-Kanu"]),

  // Obafemi Martins
  spell('Obafemi Martins', 'NEW', 'Newcastle', 88, '2006/07', '2008/09', ["https://en.wikipedia.org/wiki/Obafemi_Martins", "https://fbref.com/en/players/70849fc2/Obafemi-Martins"]),
  spell('Obafemi Martins', 'BIR', 'Birmingham', 4, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Obafemi_Martins", "https://fbref.com/en/players/70849fc2/Obafemi-Martins"]),

  // Orel Mangala
  spell('Orel Mangala', 'NFO', 'Forest', 47, '2022/23', '2023/24', ["https://en.wikipedia.org/wiki/Orel_Mangala", "https://fbref.com/en/players/a572e291/Orel-Mangala"]),
  spell('Orel Mangala', 'EVE', 'Everton', 19, '2024/25', '2024/25', ["https://en.wikipedia.org/wiki/Orel_Mangala", "https://fbref.com/en/players/a572e291/Orel-Mangala"]),

  // Paolo Di Canio
  spell('Paolo Di Canio', 'SHW', 'Sheffield Wednesday', 41, '1997/98', '1998/99', ["https://en.wikipedia.org/wiki/Paolo_Di_Canio", "https://fbref.com/en/players/9bbe0ecf/Paolo-Di-Canio"]),
  spell('Paolo Di Canio', 'WHU', 'West Ham', 118, '1998/99', '2002/03', ["https://en.wikipedia.org/wiki/Paolo_Di_Canio", "https://fbref.com/en/players/9bbe0ecf/Paolo-Di-Canio"]),
  spell('Paolo Di Canio', 'CHA', 'Charlton', 31, '2003/04', '2003/04', ["https://en.wikipedia.org/wiki/Paolo_Di_Canio", "https://fbref.com/en/players/9bbe0ecf/Paolo-Di-Canio"]),

  // Papa Bouba Diop
  spell('Papa Bouba Diop', 'FUL', 'Fulham', 76, '2004/05', '2007/08', ["https://en.wikipedia.org/wiki/Papa_Bouba_Diop", "https://fbref.com/en/players/7994a7f9/Papa-Bouba-Diop"]),
  spell('Papa Bouba Diop', 'POR', 'Portsmouth', 53, '2007/08', '2009/10', ["https://en.wikipedia.org/wiki/Papa_Bouba_Diop", "https://fbref.com/en/players/7994a7f9/Papa-Bouba-Diop"]),

  // Pascal Chimbonda
  spell('Pascal Chimbonda', 'WIG', 'Wigan', 38, '2005/06', '2006/07', ["https://en.wikipedia.org/wiki/Pascal_Chimbonda", "https://fbref.com/en/players/5cbb464e/Pascal-Chimbonda"]),
  spell('Pascal Chimbonda', 'TOT', 'Spurs', 68, '2006/07', '2008/09', ["https://en.wikipedia.org/wiki/Pascal_Chimbonda", "https://fbref.com/en/players/5cbb464e/Pascal-Chimbonda"]),
  spell('Pascal Chimbonda', 'SUN', 'Sunderland', 13, '2008/09', '2008/09', ["https://en.wikipedia.org/wiki/Pascal_Chimbonda", "https://fbref.com/en/players/5cbb464e/Pascal-Chimbonda"]),
  spell('Pascal Chimbonda', 'BLA', 'Blackburn', 30, '2009/10', '2010/11', ["https://en.wikipedia.org/wiki/Pascal_Chimbonda", "https://fbref.com/en/players/5cbb464e/Pascal-Chimbonda"]),

  // Patrice Evra
  spell('Patrice Evra', 'MUN', 'Man United', 273, '2005/06', '2013/14', ["https://en.wikipedia.org/wiki/Patrice_Evra", "https://fbref.com/en/players/51a3caf1/Patrice-Evra"]),
  spell('Patrice Evra', 'WHU', 'West Ham', 5, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Patrice_Evra", "https://fbref.com/en/players/51a3caf1/Patrice-Evra"]),

  // Patrick Bamford
  spell('Patrick Bamford', 'CRY', 'Palace', 6, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Patrick_Bamford", "https://fbref.com/en/players/93feac6e/Patrick-Bamford"]),
  spell('Patrick Bamford', 'NOR', 'Norwich', 7, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Patrick_Bamford", "https://fbref.com/en/players/93feac6e/Patrick-Bamford"]),
  spell('Patrick Bamford', 'BUR', 'Burnley', 6, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Patrick_Bamford", "https://fbref.com/en/players/93feac6e/Patrick-Bamford"]),
  spell('Patrick Bamford', 'MID', 'Middlesbrough', 8, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Patrick_Bamford", "https://fbref.com/en/players/93feac6e/Patrick-Bamford"]),
  spell('Patrick Bamford', 'LEE', 'Leeds', 75, '2020/21', '2022/23', ["https://en.wikipedia.org/wiki/Patrick_Bamford", "https://fbref.com/en/players/93feac6e/Patrick-Bamford"]),

  // Patrick Van Aanholt
  spell('Patrick Van Aanholt', 'CHE', 'Chelsea', 2, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Patrick_van_Aanholt", "https://fbref.com/en/players/5f09991f/Patrick-van-Aanholt"]),
  spell('Patrick Van Aanholt', 'WIG', 'Wigan', 3, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Patrick_van_Aanholt", "https://fbref.com/en/players/5f09991f/Patrick-van-Aanholt"]),
  spell('Patrick Van Aanholt', 'SUN', 'Sunderland', 82, '2014/15', '2016/17', ["https://en.wikipedia.org/wiki/Patrick_van_Aanholt", "https://fbref.com/en/players/5f09991f/Patrick-van-Aanholt"]),
  spell('Patrick Van Aanholt', 'CRY', 'Palace', 126, '2016/17', '2020/21', ["https://en.wikipedia.org/wiki/Patrick_van_Aanholt", "https://fbref.com/en/players/5f09991f/Patrick-van-Aanholt"]),

  // Patrik Berger
  spell('Patrik Berger', 'LIV', 'Liverpool', 148, '1996/97', '2002/03', ["https://en.wikipedia.org/wiki/Patrik_Berger", "https://fbref.com/en/players/f16325b3/Patrik-Berger"]),
  spell('Patrik Berger', 'POR', 'Portsmouth', 52, '2003/04', '2004/05', ["https://en.wikipedia.org/wiki/Patrik_Berger", "https://fbref.com/en/players/f16325b3/Patrik-Berger"]),
  spell('Patrik Berger', 'AVL', 'Aston Villa', 29, '2005/06', '2007/08', ["https://en.wikipedia.org/wiki/Patrik_Berger", "https://fbref.com/en/players/f16325b3/Patrik-Berger"]),

  // Paul McGrath
  spell('Paul McGrath', 'AVL', 'Aston Villa', 142, '1992/93', '1995/96', ["https://en.wikipedia.org/wiki/Paul_McGrath_(footballer)", "https://fbref.com/en/players/2f129582/Paul-McGrath"]),
  spell('Paul McGrath', 'DER', 'Derby', 24, '1996/97', '1996/97', ["https://en.wikipedia.org/wiki/Paul_McGrath_(footballer)", "https://fbref.com/en/players/2f129582/Paul-McGrath"]),

  // Paul Merson
  spell('Paul Merson', 'ARS', 'Arsenal', 160, '1992/93', '1996/97', ["https://en.wikipedia.org/wiki/Paul_Merson", "https://fbref.com/en/players/eba7e6fd/Paul-Merson"]),
  spell('Paul Merson', 'MID', 'Middlesbrough', 3, '1998/99', '1998/99', ["https://en.wikipedia.org/wiki/Paul_Merson", "https://fbref.com/en/players/eba7e6fd/Paul-Merson"]),
  spell('Paul Merson', 'AVL', 'Aston Villa', 117, '1998/99', '2001/02', ["https://en.wikipedia.org/wiki/Paul_Merson", "https://fbref.com/en/players/eba7e6fd/Paul-Merson"]),

  // Pepe Reina
  spell('Pepe Reina', 'LIV', 'Liverpool', 285, '2005/06', '2012/13', ["https://en.wikipedia.org/wiki/Pepe_Reina", "https://fbref.com/en/players/e358587b/Pepe-Reina"]),
  spell('Pepe Reina', 'AVL', 'Aston Villa', 12, '2019/20', '2019/20', ["https://en.wikipedia.org/wiki/Pepe_Reina", "https://fbref.com/en/players/e358587b/Pepe-Reina"]),

  // Peter Beagrie
  spell('Peter Beagrie', 'EVE', 'Everton', 51, '1992/93', '1993/94', ["https://en.wikipedia.org/wiki/Peter_Beagrie", "https://fbref.com/en/players/edcefdc4/Peter-Beagrie"]),
  spell('Peter Beagrie', 'EVE', 'Everton', 6, '1997/98', '1997/98', ["https://en.wikipedia.org/wiki/Peter_Beagrie", "https://fbref.com/en/players/edcefdc4/Peter-Beagrie"]),
  spell('Peter Beagrie', 'MCI', 'Man City', 51, '1993/94', '1995/96', ["https://en.wikipedia.org/wiki/Peter_Beagrie", "https://fbref.com/en/players/edcefdc4/Peter-Beagrie"]),
  spell('Peter Beagrie', 'BRD', 'Bradford', 54, '1999/00', '2000/01', ["https://en.wikipedia.org/wiki/Peter_Beagrie", "https://fbref.com/en/players/edcefdc4/Peter-Beagrie"]),

  // Peter Beardsley
  spell('Peter Beardsley', 'EVE', 'Everton', 39, '1992/93', '1992/93', ["https://en.wikipedia.org/wiki/Peter_Beardsley", "https://fbref.com/en/players/4d9a93aa/Peter-Beardsley"]),
  spell('Peter Beardsley', 'NEW', 'Newcastle', 129, '1993/94', '1996/97', ["https://en.wikipedia.org/wiki/Peter_Beardsley", "https://fbref.com/en/players/4d9a93aa/Peter-Beardsley"]),
  spell('Peter Beardsley', 'BOL', 'Bolton', 17, '1997/98', '1997/98', ["https://en.wikipedia.org/wiki/Peter_Beardsley", "https://fbref.com/en/players/4d9a93aa/Peter-Beardsley"]),

  // Peter Whittingham
  spell('Peter Whittingham', 'AVL', 'Aston Villa', 56, '2002/03', '2006/07', ["https://en.wikipedia.org/wiki/Peter_Whittingham", "https://fbref.com/en/players/f2286f20/Peter-Whittingham"]),
  spell('Peter Whittingham', 'CAR', 'Cardiff', 32, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Peter_Whittingham", "https://fbref.com/en/players/f2286f20/Peter-Whittingham"]),

  // Phil Babb
  spell('Phil Babb', 'COV', 'Coventry', 77, '1992/93', '1994/95', ["https://en.wikipedia.org/wiki/Phil_Babb", "https://fbref.com/en/players/37af386a/Phil-Babb"]),
  spell('Phil Babb', 'LIV', 'Liverpool', 128, '1994/95', '1998/99', ["https://en.wikipedia.org/wiki/Phil_Babb", "https://fbref.com/en/players/37af386a/Phil-Babb"]),
  spell('Phil Babb', 'SUN', 'Sunderland', 26, '2002/03', '2002/03', ["https://en.wikipedia.org/wiki/Phil_Babb", "https://fbref.com/en/players/37af386a/Phil-Babb"]),

  // Phil Jagielka
  spell('Phil Jagielka', 'SHU', 'Sheffield United', 38, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Phil_Jagielka", "https://fbref.com/en/players/3233eefd/Phil-Jagielka"]),
  spell('Phil Jagielka', 'SHU', 'Sheffield United', 16, '2019/20', '2020/21', ["https://en.wikipedia.org/wiki/Phil_Jagielka", "https://fbref.com/en/players/3233eefd/Phil-Jagielka"]),
  spell('Phil Jagielka', 'EVE', 'Everton', 322, '2007/08', '2018/19', ["https://en.wikipedia.org/wiki/Phil_Jagielka", "https://fbref.com/en/players/3233eefd/Phil-Jagielka"]),

  // Philippe Coutinho
  spell('Philippe Coutinho', 'LIV', 'Liverpool', 152, '2012/13', '2017/18', ["https://en.wikipedia.org/wiki/Philippe_Coutinho", "https://fbref.com/en/players/0ef89a37/Philippe-Coutinho"]),
  spell('Philippe Coutinho', 'AVL', 'Aston Villa', 41, '2021/22', '2023/24', ["https://en.wikipedia.org/wiki/Philippe_Coutinho", "https://fbref.com/en/players/0ef89a37/Philippe-Coutinho"]),

  // Philippe Senderos
  spell('Philippe Senderos', 'ARS', 'Arsenal', 64, '2004/05', '2007/08', ["https://en.wikipedia.org/wiki/Philippe_Senderos", "https://fbref.com/en/players/b1d82fc2/Philippe-Senderos"]),
  spell('Philippe Senderos', 'EVE', 'Everton', 2, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Philippe_Senderos", "https://fbref.com/en/players/b1d82fc2/Philippe-Senderos"]),
  spell('Philippe Senderos', 'FUL', 'Fulham', 57, '2010/11', '2013/14', ["https://en.wikipedia.org/wiki/Philippe_Senderos", "https://fbref.com/en/players/b1d82fc2/Philippe-Senderos"]),
  spell('Philippe Senderos', 'AVL', 'Aston Villa', 8, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Philippe_Senderos", "https://fbref.com/en/players/b1d82fc2/Philippe-Senderos"]),

  // Pierre-Emerick Aubameyang
  spell('Pierre-Emerick Aubameyang', 'ARS', 'Arsenal', 128, '2017/18', '2021/22', ["https://en.wikipedia.org/wiki/Pierre-Emerick_Aubameyang", "https://fbref.com/en/players/d5dd5f1f/Pierre-Emerick-Aubameyang"]),
  spell('Pierre-Emerick Aubameyang', 'CHE', 'Chelsea', 15, '2022/23', '2022/23', ["https://en.wikipedia.org/wiki/Pierre-Emerick_Aubameyang", "https://fbref.com/en/players/d5dd5f1f/Pierre-Emerick-Aubameyang"]),

  // Pierre-Emile Hojbjerg
  spell('Pierre-Emile Hojbjerg', 'SOU', 'Southampton', 109, '2016/17', '2019/20', ["https://en.wikipedia.org/wiki/Pierre-Emile_H%C3%B8jbjerg", "https://fbref.com/en/players/8b04d6c1/Pierre-Hojbjerg"]),
  spell('Pierre-Emile Hojbjerg', 'TOT', 'Spurs', 145, '2020/21', '2023/24', ["https://en.wikipedia.org/wiki/Pierre-Emile_H%C3%B8jbjerg", "https://fbref.com/en/players/8b04d6c1/Pierre-Hojbjerg"]),

  // Richard Shaw
  spell('Richard Shaw', 'CRY', 'Palace', 33, '1992/93', '1992/93', ["https://en.wikipedia.org/wiki/Richard_Shaw_(footballer)", "https://fbref.com/en/players/88b5bd84/Richard-Shaw"]),
  spell('Richard Shaw', 'CRY', 'Palace', 41, '1994/95', '1994/95', ["https://en.wikipedia.org/wiki/Richard_Shaw_(footballer)", "https://fbref.com/en/players/88b5bd84/Richard-Shaw"]),
  spell('Richard Shaw', 'COV', 'Coventry', 179, '1995/96', '2000/01', ["https://en.wikipedia.org/wiki/Richard_Shaw_(footballer)", "https://fbref.com/en/players/88b5bd84/Richard-Shaw"]),

  // Richard Wright
  spell('Richard Wright', 'IPS', 'Ipswich', 3, '1994/95', '1994/95', ["https://en.wikipedia.org/wiki/Richard_Wright_(footballer)", "https://fbref.com/en/players/d9e2e2ae/Richard-Wright"]),
  spell('Richard Wright', 'IPS', 'Ipswich', 36, '2000/01', '2000/01', ["https://en.wikipedia.org/wiki/Richard_Wright_(footballer)", "https://fbref.com/en/players/d9e2e2ae/Richard-Wright"]),
  spell('Richard Wright', 'ARS', 'Arsenal', 12, '2001/02', '2001/02', ["https://en.wikipedia.org/wiki/Richard_Wright_(footballer)", "https://fbref.com/en/players/d9e2e2ae/Richard-Wright"]),
  spell('Richard Wright', 'EVE', 'Everton', 60, '2002/03', '2006/07', ["https://en.wikipedia.org/wiki/Richard_Wright_(footballer)", "https://fbref.com/en/players/d9e2e2ae/Richard-Wright"]),

  // Riyad Mahrez
  spell('Riyad Mahrez', 'LEI', 'Leicester', 139, '2014/15', '2017/18', ["https://en.wikipedia.org/wiki/Riyad_Mahrez", "https://fbref.com/en/players/892d5bb1/Riyad-Mahrez"]),
  spell('Riyad Mahrez', 'MCI', 'Man City', 145, '2018/19', '2022/23', ["https://en.wikipedia.org/wiki/Riyad_Mahrez", "https://fbref.com/en/players/892d5bb1/Riyad-Mahrez"]),

  // Robbie Blake
  spell('Robbie Blake', 'BRD', 'Bradford', 49, '1999/00', '2000/01', ["https://en.wikipedia.org/wiki/Robbie_Blake", "https://fbref.com/en/players/ddc0a1fd/Robbie-Blake"]),
  spell('Robbie Blake', 'BIR', 'Birmingham', 11, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Robbie_Blake", "https://fbref.com/en/players/ddc0a1fd/Robbie-Blake"]),
  spell('Robbie Blake', 'BUR', 'Burnley', 31, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Robbie_Blake", "https://fbref.com/en/players/ddc0a1fd/Robbie-Blake"]),
  spell('Robbie Blake', 'BOL', 'Bolton', 9, '2010/11', '2011/12', ["https://en.wikipedia.org/wiki/Robbie_Blake", "https://fbref.com/en/players/ddc0a1fd/Robbie-Blake"]),

  // Robbie Brady
  spell('Robbie Brady', 'HUL', 'Hull', 43, '2013/14', '2014/15', ["https://en.wikipedia.org/wiki/Robbie_Brady", "https://fbref.com/en/players/96bb8cc2/Robbie-Brady"]),
  spell('Robbie Brady', 'NOR', 'Norwich', 36, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Robbie_Brady", "https://fbref.com/en/players/96bb8cc2/Robbie-Brady"]),
  spell('Robbie Brady', 'BUR', 'Burnley', 81, '2016/17', '2020/21', ["https://en.wikipedia.org/wiki/Robbie_Brady", "https://fbref.com/en/players/96bb8cc2/Robbie-Brady"]),

  // Roger Johnson
  spell('Roger Johnson', 'BIR', 'Birmingham', 76, '2009/10', '2010/11', ["https://en.wikipedia.org/wiki/Roger_Johnson_(footballer)", "https://fbref.com/en/players/f6e08a82/Roger-Johnson"]),
  spell('Roger Johnson', 'WOL', 'Wolves', 27, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Roger_Johnson_(footballer)", "https://fbref.com/en/players/f6e08a82/Roger-Johnson"]),
  spell('Roger Johnson', 'WHU', 'West Ham', 4, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Roger_Johnson_(footballer)", "https://fbref.com/en/players/f6e08a82/Roger-Johnson"]),

  // Romelu Lukaku
  spell('Romelu Lukaku', 'CHE', 'Chelsea', 8, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Romelu_Lukaku", "https://fbref.com/en/players/5eae500a/Romelu-Lukaku"]),
  spell('Romelu Lukaku', 'CHE', 'Chelsea', 2, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Romelu_Lukaku", "https://fbref.com/en/players/5eae500a/Romelu-Lukaku"]),
  spell('Romelu Lukaku', 'CHE', 'Chelsea', 26, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Romelu_Lukaku", "https://fbref.com/en/players/5eae500a/Romelu-Lukaku"]),
  spell('Romelu Lukaku', 'WBA', 'West Brom', 35, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Romelu_Lukaku", "https://fbref.com/en/players/5eae500a/Romelu-Lukaku"]),
  spell('Romelu Lukaku', 'EVE', 'Everton', 141, '2013/14', '2016/17', ["https://en.wikipedia.org/wiki/Romelu_Lukaku", "https://fbref.com/en/players/5eae500a/Romelu-Lukaku"]),
  spell('Romelu Lukaku', 'MUN', 'Man United', 66, '2017/18', '2018/19', ["https://en.wikipedia.org/wiki/Romelu_Lukaku", "https://fbref.com/en/players/5eae500a/Romelu-Lukaku"]),

  // Ronny Johnsen
  spell('Ronny Johnsen', 'MUN', 'Man United', 99, '1996/97', '2001/02', ["https://en.wikipedia.org/wiki/Ronny_Johnsen", "https://fbref.com/en/players/02f25c21/Ronny-Johnsen"]),
  spell('Ronny Johnsen', 'AVL', 'Aston Villa', 49, '2002/03', '2003/04', ["https://en.wikipedia.org/wiki/Ronny_Johnsen", "https://fbref.com/en/players/02f25c21/Ronny-Johnsen"]),
  spell('Ronny Johnsen', 'NEW', 'Newcastle', 3, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Ronny_Johnsen", "https://fbref.com/en/players/02f25c21/Ronny-Johnsen"]),

  // Ronny Rosenthal
  spell('Ronny Rosenthal', 'LIV', 'Liverpool', 30, '1992/93', '1993/94', ["https://en.wikipedia.org/wiki/Ronny_Rosenthal", "https://fbref.com/en/players/e69665a8/Ronny-Rosenthal"]),
  spell('Ronny Rosenthal', 'TOT', 'Spurs', 88, '1993/94', '1996/97', ["https://en.wikipedia.org/wiki/Ronny_Rosenthal", "https://fbref.com/en/players/e69665a8/Ronny-Rosenthal"]),

  // Ruben Loftus-Cheek
  spell('Ruben Loftus-Cheek', 'CHE', 'Chelsea', 22, '2014/15', '2016/17', ["https://en.wikipedia.org/wiki/Ruben_Loftus-Cheek", "https://fbref.com/en/players/e97fd090/Ruben-Loftus-Cheek"]),
  spell('Ruben Loftus-Cheek', 'CHE', 'Chelsea', 81, '2018/19', '2022/23', ["https://en.wikipedia.org/wiki/Ruben_Loftus-Cheek", "https://fbref.com/en/players/e97fd090/Ruben-Loftus-Cheek"]),
  spell('Ruben Loftus-Cheek', 'CRY', 'Palace', 24, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Ruben_Loftus-Cheek", "https://fbref.com/en/players/e97fd090/Ruben-Loftus-Cheek"]),
  spell('Ruben Loftus-Cheek', 'FUL', 'Fulham', 30, '2020/21', '2020/21', ["https://en.wikipedia.org/wiki/Ruben_Loftus-Cheek", "https://fbref.com/en/players/e97fd090/Ruben-Loftus-Cheek"]),

  // Ryan Babel
  spell('Ryan Babel', 'LIV', 'Liverpool', 91, '2007/08', '2010/11', ["https://en.wikipedia.org/wiki/Ryan_Babel", "https://fbref.com/en/players/6438d426/Ryan-Babel"]),
  spell('Ryan Babel', 'FUL', 'Fulham', 16, '2018/19', '2018/19', ["https://en.wikipedia.org/wiki/Ryan_Babel", "https://fbref.com/en/players/6438d426/Ryan-Babel"]),

  // Ryan Bennett
  spell('Ryan Bennett', 'NOR', 'Norwich', 39, '2011/12', '2013/14', ["https://en.wikipedia.org/wiki/Ryan_Bennett", "https://fbref.com/en/players/0bad4516/Ryan-Bennett"]),
  spell('Ryan Bennett', 'NOR', 'Norwich', 22, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Ryan_Bennett", "https://fbref.com/en/players/0bad4516/Ryan-Bennett"]),
  spell('Ryan Bennett', 'WOL', 'Wolves', 45, '2018/19', '2019/20', ["https://en.wikipedia.org/wiki/Ryan_Bennett", "https://fbref.com/en/players/0bad4516/Ryan-Bennett"]),
  spell('Ryan Bennett', 'LEI', 'Leicester', 5, '2019/20', '2019/20', ["https://en.wikipedia.org/wiki/Ryan_Bennett", "https://fbref.com/en/players/0bad4516/Ryan-Bennett"]),

  // Sadio Mane
  spell('Sadio Mane', 'SOU', 'Southampton', 67, '2014/15', '2015/16', ["https://en.wikipedia.org/wiki/Sadio_Man%C3%A9", "https://fbref.com/en/players/c691bfe2/Sadio-Mane"]),
  spell('Sadio Mane', 'LIV', 'Liverpool', 196, '2016/17', '2021/22', ["https://en.wikipedia.org/wiki/Sadio_Man%C3%A9", "https://fbref.com/en/players/c691bfe2/Sadio-Mane"]),

  // Sam Vokes
  spell('Sam Vokes', 'WOL', 'Wolves', 11, '2009/10', '2011/12', ["https://en.wikipedia.org/wiki/Sam_Vokes", "https://fbref.com/en/players/1d6ac165/Sam-Vokes"]),
  spell('Sam Vokes', 'BUR', 'Burnley', 15, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Sam_Vokes", "https://fbref.com/en/players/1d6ac165/Sam-Vokes"]),
  spell('Sam Vokes', 'BUR', 'Burnley', 87, '2016/17', '2018/19', ["https://en.wikipedia.org/wiki/Sam_Vokes", "https://fbref.com/en/players/1d6ac165/Sam-Vokes"]),

  // Samir Nasri
  spell('Samir Nasri', 'ARS', 'Arsenal', 86, '2008/09', '2011/12', ["https://en.wikipedia.org/wiki/Samir_Nasri", "https://fbref.com/en/players/165bed61/Samir-Nasri"]),
  spell('Samir Nasri', 'MCI', 'Man City', 129, '2011/12', '2016/17', ["https://en.wikipedia.org/wiki/Samir_Nasri", "https://fbref.com/en/players/165bed61/Samir-Nasri"]),
  spell('Samir Nasri', 'WHU', 'West Ham', 5, '2018/19', '2018/19', ["https://en.wikipedia.org/wiki/Samir_Nasri", "https://fbref.com/en/players/165bed61/Samir-Nasri"]),

  // Sander Westerveld
  spell('Sander Westerveld', 'LIV', 'Liverpool', 75, '1999/00', '2001/02', ["https://en.wikipedia.org/wiki/Sander_Westerveld", "https://fbref.com/en/players/dc8d38a2/Sander-Westerveld"]),
  spell('Sander Westerveld', 'POR', 'Portsmouth', 6, '2005/06', '2005/06', ["https://en.wikipedia.org/wiki/Sander_Westerveld", "https://fbref.com/en/players/dc8d38a2/Sander-Westerveld"]),
  spell('Sander Westerveld', 'EVE', 'Everton', 2, '2005/06', '2005/06', ["https://en.wikipedia.org/wiki/Sander_Westerveld", "https://fbref.com/en/players/dc8d38a2/Sander-Westerveld"]),

  // Scott Dann
  spell('Scott Dann', 'BIR', 'Birmingham', 50, '2009/10', '2010/11', ["https://en.wikipedia.org/wiki/Scott_Dann", "https://fbref.com/en/players/52105203/Scott-Dann"]),
  spell('Scott Dann', 'BLA', 'Blackburn', 27, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Scott_Dann", "https://fbref.com/en/players/52105203/Scott-Dann"]),
  spell('Scott Dann', 'CRY', 'Palace', 164, '2013/14', '2020/21', ["https://en.wikipedia.org/wiki/Scott_Dann", "https://fbref.com/en/players/52105203/Scott-Dann"]),

  // Sergi Canos
  spell('Sergi Canos', 'LIV', 'Liverpool', 1, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Sergi_Can%C3%B3s", "https://fbref.com/en/players/1137759d/Sergi-Canos"]),
  spell('Sergi Canos', 'BRE', 'Brentford', 36, '2021/22', '2022/23', ["https://en.wikipedia.org/wiki/Sergi_Can%C3%B3s", "https://fbref.com/en/players/1137759d/Sergi-Canos"]),

  // Sergio Reguilon
  spell('Sergio Reguilon', 'TOT', 'Spurs', 52, '2020/21', '2021/22', ["https://en.wikipedia.org/wiki/Sergio_Reguil%C3%B3n", "https://fbref.com/en/players/3353737a/Sergio-Reguilon"]),
  spell('Sergio Reguilon', 'TOT', 'Spurs', 4, '2024/25', '2024/25', ["https://en.wikipedia.org/wiki/Sergio_Reguil%C3%B3n", "https://fbref.com/en/players/3353737a/Sergio-Reguilon"]),
  spell('Sergio Reguilon', 'MUN', 'Man United', 9, '2023/24', '2023/24', ["https://en.wikipedia.org/wiki/Sergio_Reguil%C3%B3n", "https://fbref.com/en/players/3353737a/Sergio-Reguilon"]),
  spell('Sergio Reguilon', 'BRE', 'Brentford', 16, '2023/24', '2023/24', ["https://en.wikipedia.org/wiki/Sergio_Reguil%C3%B3n", "https://fbref.com/en/players/3353737a/Sergio-Reguilon"]),

  // Shane Duffy
  spell('Shane Duffy', 'EVE', 'Everton', 5, '2011/12', '2012/13', ["https://en.wikipedia.org/wiki/Shane_Duffy", "https://fbref.com/en/players/7314bba4/Shane-Duffy"]),
  spell('Shane Duffy', 'BHA', 'Brighton', 91, '2017/18', '2019/20', ["https://en.wikipedia.org/wiki/Shane_Duffy", "https://fbref.com/en/players/7314bba4/Shane-Duffy"]),
  spell('Shane Duffy', 'BHA', 'Brighton', 18, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Shane_Duffy", "https://fbref.com/en/players/7314bba4/Shane-Duffy"]),
  spell('Shane Duffy', 'FUL', 'Fulham', 5, '2022/23', '2022/23', ["https://en.wikipedia.org/wiki/Shane_Duffy", "https://fbref.com/en/players/7314bba4/Shane-Duffy"]),

  // Shola Ameobi
  spell('Shola Ameobi', 'NEW', 'Newcastle', 190, '2000/01', '2008/09', ["https://en.wikipedia.org/wiki/Shola_Ameobi", "https://fbref.com/en/players/e79a368b/Shola-Ameobi"]),
  spell('Shola Ameobi', 'NEW', 'Newcastle', 104, '2010/11', '2013/14', ["https://en.wikipedia.org/wiki/Shola_Ameobi", "https://fbref.com/en/players/e79a368b/Shola-Ameobi"]),
  spell('Shola Ameobi', 'CRY', 'Palace', 4, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Shola_Ameobi", "https://fbref.com/en/players/e79a368b/Shola-Ameobi"]),

  // Simon Osborn
  spell('Simon Osborn', 'CRY', 'Palace', 31, '1992/93', '1992/93', ["https://en.wikipedia.org/wiki/Simon_Osborn", "https://fbref.com/en/players/f8c8fb04/Simon-Osborn"]),
  spell('Simon Osborn', 'QPR', 'QPR', 9, '1995/96', '1995/96', ["https://en.wikipedia.org/wiki/Simon_Osborn", "https://fbref.com/en/players/f8c8fb04/Simon-Osborn"]),

  // Stan Lazaridis
  spell('Stan Lazaridis', 'WHU', 'West Ham', 69, '1995/96', '1998/99', ["https://en.wikipedia.org/wiki/Stan_Lazaridis", "https://fbref.com/en/players/5350fc7f/Stan-Lazaridis"]),
  spell('Stan Lazaridis', 'BIR', 'Birmingham', 97, '2002/03', '2005/06', ["https://en.wikipedia.org/wiki/Stan_Lazaridis", "https://fbref.com/en/players/5350fc7f/Stan-Lazaridis"]),

  // Stephen Ireland
  spell('Stephen Ireland', 'MCI', 'Man City', 138, '2005/06', '2009/10', ["https://en.wikipedia.org/wiki/Stephen_Ireland", "https://fbref.com/en/players/bcf30f17/Stephen-Ireland"]),
  spell('Stephen Ireland', 'AVL', 'Aston Villa', 47, '2010/11', '2012/13', ["https://en.wikipedia.org/wiki/Stephen_Ireland", "https://fbref.com/en/players/bcf30f17/Stephen-Ireland"]),
  spell('Stephen Ireland', 'NEW', 'Newcastle', 2, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Stephen_Ireland", "https://fbref.com/en/players/bcf30f17/Stephen-Ireland"]),
  spell('Stephen Ireland', 'STK', 'Stoke', 55, '2013/14', '2015/16', ["https://en.wikipedia.org/wiki/Stephen_Ireland", "https://fbref.com/en/players/bcf30f17/Stephen-Ireland"]),
  spell('Stephen Ireland', 'STK', 'Stoke', 4, '2017/18', '2017/18', ["https://en.wikipedia.org/wiki/Stephen_Ireland", "https://fbref.com/en/players/bcf30f17/Stephen-Ireland"]),

  // Stephen Warnock
  spell('Stephen Warnock', 'LIV', 'Liverpool', 40, '2004/05', '2006/07', ["https://en.wikipedia.org/wiki/Stephen_Warnock", "https://fbref.com/en/players/07869028/Stephen-Warnock"]),
  spell('Stephen Warnock', 'BLA', 'Blackburn', 88, '2006/07', '2009/10', ["https://en.wikipedia.org/wiki/Stephen_Warnock", "https://fbref.com/en/players/07869028/Stephen-Warnock"]),
  spell('Stephen Warnock', 'AVL', 'Aston Villa', 84, '2009/10', '2011/12', ["https://en.wikipedia.org/wiki/Stephen_Warnock", "https://fbref.com/en/players/07869028/Stephen-Warnock"]),

  // Steve Bould
  spell('Steve Bould', 'ARS', 'Arsenal', 175, '1992/93', '1998/99', ["https://en.wikipedia.org/wiki/Steve_Bould", "https://fbref.com/en/players/42e0fd3a/Steve-Bould"]),
  spell('Steve Bould', 'SUN', 'Sunderland', 21, '1999/00', '2000/01', ["https://en.wikipedia.org/wiki/Steve_Bould", "https://fbref.com/en/players/42e0fd3a/Steve-Bould"]),

  // Steve Finnan
  spell('Steve Finnan', 'FUL', 'Fulham', 70, '2001/02', '2002/03', ["https://en.wikipedia.org/wiki/Steve_Finnan", "https://fbref.com/en/players/5596a89f/Steve-Finnan"]),
  spell('Steve Finnan', 'LIV', 'Liverpool', 145, '2003/04', '2007/08', ["https://en.wikipedia.org/wiki/Steve_Finnan", "https://fbref.com/en/players/5596a89f/Steve-Finnan"]),
  spell('Steve Finnan', 'POR', 'Portsmouth', 21, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Steve_Finnan", "https://fbref.com/en/players/5596a89f/Steve-Finnan"]),

  // Steve Harper
  spell('Steve Harper', 'NEW', 'Newcastle', 31, '1998/99', '2000/01', ["https://en.wikipedia.org/wiki/Steve_Harper", "https://fbref.com/en/players/a98f1d52/Steve-Harper"]),
  spell('Steve Harper', 'NEW', 'Newcastle', 2, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Steve_Harper", "https://fbref.com/en/players/a98f1d52/Steve-Harper"]),
  spell('Steve Harper', 'NEW', 'Newcastle', 55, '2006/07', '2008/09', ["https://en.wikipedia.org/wiki/Steve_Harper", "https://fbref.com/en/players/a98f1d52/Steve-Harper"]),
  spell('Steve Harper', 'NEW', 'Newcastle', 18, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Steve_Harper", "https://fbref.com/en/players/a98f1d52/Steve-Harper"]),
  spell('Steve Harper', 'NEW', 'Newcastle', 6, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Steve_Harper", "https://fbref.com/en/players/a98f1d52/Steve-Harper"]),
  spell('Steve Harper', 'HUL', 'Hull', 23, '2013/14', '2014/15', ["https://en.wikipedia.org/wiki/Steve_Harper", "https://fbref.com/en/players/a98f1d52/Steve-Harper"]),

  // Steve Howey
  spell('Steve Howey', 'NEW', 'Newcastle', 117, '1993/94', '1999/00', ["https://en.wikipedia.org/wiki/Steve_Howey_(footballer)", "https://fbref.com/en/players/c1dd78cb/Steve-Howey"]),
  spell('Steve Howey', 'MCI', 'Man City', 36, '2000/01', '2000/01', ["https://en.wikipedia.org/wiki/Steve_Howey_(footballer)", "https://fbref.com/en/players/c1dd78cb/Steve-Howey"]),
  spell('Steve Howey', 'MCI', 'Man City', 24, '2002/03', '2002/03', ["https://en.wikipedia.org/wiki/Steve_Howey_(footballer)", "https://fbref.com/en/players/c1dd78cb/Steve-Howey"]),
  spell('Steve Howey', 'LEI', 'Leicester', 13, '2003/04', '2003/04', ["https://en.wikipedia.org/wiki/Steve_Howey_(footballer)", "https://fbref.com/en/players/c1dd78cb/Steve-Howey"]),
  spell('Steve Howey', 'BOL', 'Bolton', 3, '2003/04', '2003/04', ["https://en.wikipedia.org/wiki/Steve_Howey_(footballer)", "https://fbref.com/en/players/c1dd78cb/Steve-Howey"]),

  // Steve McManaman
  spell('Steve McManaman', 'LIV', 'Liverpool', 240, '1992/93', '1998/99', ["https://en.wikipedia.org/wiki/Steve_McManaman", "https://fbref.com/en/players/9be05f40/Steve-McManaman"]),
  spell('Steve McManaman', 'MCI', 'Man City', 35, '2003/04', '2004/05', ["https://en.wikipedia.org/wiki/Steve_McManaman", "https://fbref.com/en/players/9be05f40/Steve-McManaman"]),

  // Steve Sidwell
  spell('Steve Sidwell', 'REA', 'Reading', 35, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Steve_Sidwell", "https://fbref.com/en/players/ed083afd/Steve-Sidwell"]),
  spell('Steve Sidwell', 'CHE', 'Chelsea', 15, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Steve_Sidwell", "https://fbref.com/en/players/ed083afd/Steve-Sidwell"]),
  spell('Steve Sidwell', 'AVL', 'Aston Villa', 45, '2008/09', '2010/11', ["https://en.wikipedia.org/wiki/Steve_Sidwell", "https://fbref.com/en/players/ed083afd/Steve-Sidwell"]),
  spell('Steve Sidwell', 'FUL', 'Fulham', 92, '2010/11', '2013/14', ["https://en.wikipedia.org/wiki/Steve_Sidwell", "https://fbref.com/en/players/ed083afd/Steve-Sidwell"]),
  spell('Steve Sidwell', 'STK', 'Stoke', 13, '2014/15', '2015/16', ["https://en.wikipedia.org/wiki/Steve_Sidwell", "https://fbref.com/en/players/ed083afd/Steve-Sidwell"]),

  // Steve Staunton
  spell('Steve Staunton', 'AVL', 'Aston Villa', 171, '1992/93', '1997/98', ["https://en.wikipedia.org/wiki/Steve_Staunton", "https://fbref.com/en/players/cb617782/Steve-Staunton"]),
  spell('Steve Staunton', 'AVL', 'Aston Villa', 73, '2000/01', '2002/03', ["https://en.wikipedia.org/wiki/Steve_Staunton", "https://fbref.com/en/players/cb617782/Steve-Staunton"]),
  spell('Steve Staunton', 'LIV', 'Liverpool', 44, '1998/99', '2000/01', ["https://en.wikipedia.org/wiki/Steve_Staunton", "https://fbref.com/en/players/cb617782/Steve-Staunton"]),

  // Steven Caldwell
  spell('Steven Caldwell', 'NEW', 'Newcastle', 9, '2000/01', '2000/01', ["https://en.wikipedia.org/wiki/Steven_Caldwell", "https://fbref.com/en/players/6839f68e/Steven-Caldwell"]),
  spell('Steven Caldwell', 'NEW', 'Newcastle', 19, '2002/03', '2003/04', ["https://en.wikipedia.org/wiki/Steven_Caldwell", "https://fbref.com/en/players/6839f68e/Steven-Caldwell"]),
  spell('Steven Caldwell', 'LEE', 'Leeds', 13, '2003/04', '2003/04', ["https://en.wikipedia.org/wiki/Steven_Caldwell", "https://fbref.com/en/players/6839f68e/Steven-Caldwell"]),
  spell('Steven Caldwell', 'SUN', 'Sunderland', 24, '2005/06', '2005/06', ["https://en.wikipedia.org/wiki/Steven_Caldwell", "https://fbref.com/en/players/6839f68e/Steven-Caldwell"]),
  spell('Steven Caldwell', 'BUR', 'Burnley', 13, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Steven_Caldwell", "https://fbref.com/en/players/6839f68e/Steven-Caldwell"]),
  spell('Steven Caldwell', 'WIG', 'Wigan', 10, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Steven_Caldwell", "https://fbref.com/en/players/6839f68e/Steven-Caldwell"]),

  // Steven Pienaar
  spell('Steven Pienaar', 'EVE', 'Everton', 189, '2007/08', '2015/16', ["https://en.wikipedia.org/wiki/Steven_Pienaar", "https://fbref.com/en/players/8056f6e6/Steven-Pienaar"]),
  spell('Steven Pienaar', 'TOT', 'Spurs', 10, '2010/11', '2011/12', ["https://en.wikipedia.org/wiki/Steven_Pienaar", "https://fbref.com/en/players/8056f6e6/Steven-Pienaar"]),
  spell('Steven Pienaar', 'SUN', 'Sunderland', 15, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Steven_Pienaar", "https://fbref.com/en/players/8056f6e6/Steven-Pienaar"]),

  // Stuart Pearce
  spell('Stuart Pearce', 'NFO', 'Forest', 23, '1992/93', '1992/93', ["https://en.wikipedia.org/wiki/Stuart_Pearce", "https://fbref.com/en/players/39243ce6/Stuart-Pearce"]),
  spell('Stuart Pearce', 'NFO', 'Forest', 100, '1994/95', '1996/97', ["https://en.wikipedia.org/wiki/Stuart_Pearce", "https://fbref.com/en/players/39243ce6/Stuart-Pearce"]),
  spell('Stuart Pearce', 'NEW', 'Newcastle', 37, '1997/98', '1998/99', ["https://en.wikipedia.org/wiki/Stuart_Pearce", "https://fbref.com/en/players/39243ce6/Stuart-Pearce"]),
  spell('Stuart Pearce', 'WHU', 'West Ham', 42, '1999/00', '2000/01', ["https://en.wikipedia.org/wiki/Stuart_Pearce", "https://fbref.com/en/players/39243ce6/Stuart-Pearce"]),

  // Tariq Lamptey
  spell('Tariq Lamptey', 'CHE', 'Chelsea', 1, '2019/20', '2019/20', ["https://en.wikipedia.org/wiki/Tariq_Lamptey", "https://fbref.com/en/players/f4e433d4/Tariq-Lamptey"]),
  spell('Tariq Lamptey', 'BHA', 'Brighton', 103, '2019/20', '2024/25', ["https://en.wikipedia.org/wiki/Tariq_Lamptey", "https://fbref.com/en/players/f4e433d4/Tariq-Lamptey"]),

  // Thomas Hitzlsperger
  spell('Thomas Hitzlsperger', 'AVL', 'Aston Villa', 99, '2000/01', '2004/05', ["https://en.wikipedia.org/wiki/Thomas_Hitzlsperger", "https://fbref.com/en/players/2757060a/Thomas-Hitzlsperger"]),
  spell('Thomas Hitzlsperger', 'WHU', 'West Ham', 11, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Thomas_Hitzlsperger", "https://fbref.com/en/players/2757060a/Thomas-Hitzlsperger"]),
  spell('Thomas Hitzlsperger', 'EVE', 'Everton', 7, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Thomas_Hitzlsperger", "https://fbref.com/en/players/2757060a/Thomas-Hitzlsperger"]),

  // Titus Bramble
  spell('Titus Bramble', 'IPS', 'Ipswich', 44, '2000/01', '2001/02', ["https://en.wikipedia.org/wiki/Titus_Bramble", "https://fbref.com/en/players/83ac7c3c/Titus-Bramble"]),
  spell('Titus Bramble', 'NEW', 'Newcastle', 105, '2002/03', '2006/07', ["https://en.wikipedia.org/wiki/Titus_Bramble", "https://fbref.com/en/players/83ac7c3c/Titus-Bramble"]),
  spell('Titus Bramble', 'WIG', 'Wigan', 96, '2007/08', '2009/10', ["https://en.wikipedia.org/wiki/Titus_Bramble", "https://fbref.com/en/players/83ac7c3c/Titus-Bramble"]),
  spell('Titus Bramble', 'SUN', 'Sunderland', 47, '2010/11', '2012/13', ["https://en.wikipedia.org/wiki/Titus_Bramble", "https://fbref.com/en/players/83ac7c3c/Titus-Bramble"]),

  // Toby Alderweireld
  spell('Toby Alderweireld', 'SOU', 'Southampton', 26, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Toby_Alderweireld", "https://fbref.com/en/players/f7d50789/Toby-Alderweireld"]),
  spell('Toby Alderweireld', 'TOT', 'Spurs', 174, '2015/16', '2020/21', ["https://en.wikipedia.org/wiki/Toby_Alderweireld", "https://fbref.com/en/players/f7d50789/Toby-Alderweireld"]),

  // Tom Cleverley
  spell('Tom Cleverley', 'MUN', 'Man United', 55, '2011/12', '2014/15', ["https://en.wikipedia.org/wiki/Tom_Cleverley", "https://fbref.com/en/players/6cdd8245/Tom-Cleverley"]),
  spell('Tom Cleverley', 'WIG', 'Wigan', 25, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Tom_Cleverley", "https://fbref.com/en/players/6cdd8245/Tom-Cleverley"]),
  spell('Tom Cleverley', 'AVL', 'Aston Villa', 31, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Tom_Cleverley", "https://fbref.com/en/players/6cdd8245/Tom-Cleverley"]),
  spell('Tom Cleverley', 'EVE', 'Everton', 32, '2015/16', '2016/17', ["https://en.wikipedia.org/wiki/Tom_Cleverley", "https://fbref.com/en/players/6cdd8245/Tom-Cleverley"]),
  spell('Tom Cleverley', 'WAT', 'Watford', 71, '2016/17', '2019/20', ["https://en.wikipedia.org/wiki/Tom_Cleverley", "https://fbref.com/en/players/6cdd8245/Tom-Cleverley"]),
  spell('Tom Cleverley', 'WAT', 'Watford', 28, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Tom_Cleverley", "https://fbref.com/en/players/6cdd8245/Tom-Cleverley"]),

  // Tom Huddlestone
  spell('Tom Huddlestone', 'TOT', 'Spurs', 144, '2005/06', '2012/13', ["https://en.wikipedia.org/wiki/Tom_Huddlestone", "https://fbref.com/en/players/464cbbc9/Tom-Huddlestone"]),
  spell('Tom Huddlestone', 'HUL', 'Hull', 67, '2013/14', '2014/15', ["https://en.wikipedia.org/wiki/Tom_Huddlestone", "https://fbref.com/en/players/464cbbc9/Tom-Huddlestone"]),
  spell('Tom Huddlestone', 'HUL', 'Hull', 31, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Tom_Huddlestone", "https://fbref.com/en/players/464cbbc9/Tom-Huddlestone"]),

  // Tony Cottee
  spell('Tony Cottee', 'EVE', 'Everton', 68, '1992/93', '1994/95', ["https://en.wikipedia.org/wiki/Tony_Cottee", "https://fbref.com/en/players/111e8515/Tony-Cottee"]),
  spell('Tony Cottee', 'WHU', 'West Ham', 67, '1994/95', '1996/97', ["https://en.wikipedia.org/wiki/Tony_Cottee", "https://fbref.com/en/players/111e8515/Tony-Cottee"]),
  spell('Tony Cottee', 'LEI', 'Leicester', 85, '1997/98', '2000/01', ["https://en.wikipedia.org/wiki/Tony_Cottee", "https://fbref.com/en/players/111e8515/Tony-Cottee"]),

  // Tony Dorigo
  spell('Tony Dorigo', 'LEE', 'Leeds', 133, '1992/93', '1996/97', ["https://en.wikipedia.org/wiki/Tony_Dorigo", "https://fbref.com/en/players/451c459e/Tony-Dorigo"]),
  spell('Tony Dorigo', 'DER', 'Derby', 41, '1998/99', '1999/00', ["https://en.wikipedia.org/wiki/Tony_Dorigo", "https://fbref.com/en/players/451c459e/Tony-Dorigo"]),

  // Tyrone Mears
  spell('Tyrone Mears', 'WHU', 'West Ham', 5, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Tyrone_Mears", "https://fbref.com/en/players/6f34d0b5/Tyrone-Mears"]),
  spell('Tyrone Mears', 'DER', 'Derby', 25, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Tyrone_Mears", "https://fbref.com/en/players/6f34d0b5/Tyrone-Mears"]),
  spell('Tyrone Mears', 'BUR', 'Burnley', 38, '2009/10', '2009/10', ["https://en.wikipedia.org/wiki/Tyrone_Mears", "https://fbref.com/en/players/6f34d0b5/Tyrone-Mears"]),
  spell('Tyrone Mears', 'BOL', 'Bolton', 1, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Tyrone_Mears", "https://fbref.com/en/players/6f34d0b5/Tyrone-Mears"]),

  // Victor Anichebe
  spell('Victor Anichebe', 'EVE', 'Everton', 131, '2005/06', '2013/14', ["https://en.wikipedia.org/wiki/Victor_Anichebe", "https://fbref.com/en/players/4aed5c19/Victor-Anichebe"]),
  spell('Victor Anichebe', 'WBA', 'West Brom', 55, '2013/14', '2015/16', ["https://en.wikipedia.org/wiki/Victor_Anichebe", "https://fbref.com/en/players/4aed5c19/Victor-Anichebe"]),
  spell('Victor Anichebe', 'SUN', 'Sunderland', 18, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/Victor_Anichebe", "https://fbref.com/en/players/4aed5c19/Victor-Anichebe"]),

  // Victor Moses
  spell('Victor Moses', 'WIG', 'Wigan', 74, '2009/10', '2012/13', ["https://en.wikipedia.org/wiki/Victor_Moses", "https://fbref.com/en/players/e726e11e/Victor-Moses"]),
  spell('Victor Moses', 'CHE', 'Chelsea', 23, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Victor_Moses", "https://fbref.com/en/players/e726e11e/Victor-Moses"]),
  spell('Victor Moses', 'CHE', 'Chelsea', 64, '2016/17', '2018/19', ["https://en.wikipedia.org/wiki/Victor_Moses", "https://fbref.com/en/players/e726e11e/Victor-Moses"]),
  spell('Victor Moses', 'LIV', 'Liverpool', 19, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Victor_Moses", "https://fbref.com/en/players/e726e11e/Victor-Moses"]),
  spell('Victor Moses', 'STK', 'Stoke', 19, '2014/15', '2014/15', ["https://en.wikipedia.org/wiki/Victor_Moses", "https://fbref.com/en/players/e726e11e/Victor-Moses"]),
  spell('Victor Moses', 'WHU', 'West Ham', 21, '2015/16', '2015/16', ["https://en.wikipedia.org/wiki/Victor_Moses", "https://fbref.com/en/players/e726e11e/Victor-Moses"]),

  // Wayne Hennessey
  spell('Wayne Hennessey', 'WOL', 'Wolves', 71, '2009/10', '2011/12', ["https://en.wikipedia.org/wiki/Wayne_Hennessey", "https://fbref.com/en/players/76eca7e2/Wayne-Hennessey"]),
  spell('Wayne Hennessey', 'CRY', 'Palace', 110, '2013/14', '2019/20', ["https://en.wikipedia.org/wiki/Wayne_Hennessey", "https://fbref.com/en/players/76eca7e2/Wayne-Hennessey"]),
  spell('Wayne Hennessey', 'BUR', 'Burnley', 2, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Wayne_Hennessey", "https://fbref.com/en/players/76eca7e2/Wayne-Hennessey"]),
  spell('Wayne Hennessey', 'NFO', 'Forest', 4, '2022/23', '2022/23', ["https://en.wikipedia.org/wiki/Wayne_Hennessey", "https://fbref.com/en/players/76eca7e2/Wayne-Hennessey"]),

  // Wayne Routledge
  spell('Wayne Routledge', 'CRY', 'Palace', 38, '2004/05', '2004/05', ["https://en.wikipedia.org/wiki/Wayne_Routledge", "https://fbref.com/en/players/1d387eee/Wayne-Routledge"]),
  spell('Wayne Routledge', 'TOT', 'Spurs', 3, '2005/06', '2005/06', ["https://en.wikipedia.org/wiki/Wayne_Routledge", "https://fbref.com/en/players/1d387eee/Wayne-Routledge"]),
  spell('Wayne Routledge', 'TOT', 'Spurs', 2, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Wayne_Routledge", "https://fbref.com/en/players/1d387eee/Wayne-Routledge"]),
  spell('Wayne Routledge', 'POR', 'Portsmouth', 13, '2005/06', '2005/06', ["https://en.wikipedia.org/wiki/Wayne_Routledge", "https://fbref.com/en/players/1d387eee/Wayne-Routledge"]),
  spell('Wayne Routledge', 'FUL', 'Fulham', 24, '2006/07', '2006/07', ["https://en.wikipedia.org/wiki/Wayne_Routledge", "https://fbref.com/en/players/1d387eee/Wayne-Routledge"]),
  spell('Wayne Routledge', 'AVL', 'Aston Villa', 2, '2007/08', '2008/09', ["https://en.wikipedia.org/wiki/Wayne_Routledge", "https://fbref.com/en/players/1d387eee/Wayne-Routledge"]),
  spell('Wayne Routledge', 'NEW', 'Newcastle', 17, '2010/11', '2010/11', ["https://en.wikipedia.org/wiki/Wayne_Routledge", "https://fbref.com/en/players/1d387eee/Wayne-Routledge"]),
  spell('Wayne Routledge', 'SWA', 'Swansea', 198, '2011/12', '2017/18', ["https://en.wikipedia.org/wiki/Wayne_Routledge", "https://fbref.com/en/players/1d387eee/Wayne-Routledge"]),

  // Wilfried Zaha
  spell('Wilfried Zaha', 'MUN', 'Man United', 2, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Wilfried_Zaha", "https://fbref.com/en/players/b2bc3b1f/Wilfried-Zaha"]),
  spell('Wilfried Zaha', 'CAR', 'Cardiff', 12, '2013/14', '2013/14', ["https://en.wikipedia.org/wiki/Wilfried_Zaha", "https://fbref.com/en/players/b2bc3b1f/Wilfried-Zaha"]),
  spell('Wilfried Zaha', 'CRY', 'Palace', 291, '2014/15', '2022/23', ["https://en.wikipedia.org/wiki/Wilfried_Zaha", "https://fbref.com/en/players/b2bc3b1f/Wilfried-Zaha"]),

  // Wilson Palacios
  spell('Wilson Palacios', 'BIR', 'Birmingham', 7, '2007/08', '2007/08', ["https://en.wikipedia.org/wiki/Wilson_Palacios", "https://fbref.com/en/players/58df81fc/Wilson-Palacios"]),
  spell('Wilson Palacios', 'WIG', 'Wigan', 37, '2007/08', '2008/09', ["https://en.wikipedia.org/wiki/Wilson_Palacios", "https://fbref.com/en/players/58df81fc/Wilson-Palacios"]),
  spell('Wilson Palacios', 'TOT', 'Spurs', 65, '2008/09', '2010/11', ["https://en.wikipedia.org/wiki/Wilson_Palacios", "https://fbref.com/en/players/58df81fc/Wilson-Palacios"]),
  spell('Wilson Palacios', 'STK', 'Stoke', 38, '2011/12', '2013/14', ["https://en.wikipedia.org/wiki/Wilson_Palacios", "https://fbref.com/en/players/58df81fc/Wilson-Palacios"]),

  // Wout Weghorst
  spell('Wout Weghorst', 'BUR', 'Burnley', 20, '2021/22', '2021/22', ["https://en.wikipedia.org/wiki/Wout_Weghorst", "https://fbref.com/en/players/c4e87b8b/Wout-Weghorst"]),
  spell('Wout Weghorst', 'MUN', 'Man United', 17, '2022/23', '2022/23', ["https://en.wikipedia.org/wiki/Wout_Weghorst", "https://fbref.com/en/players/c4e87b8b/Wout-Weghorst"]),

  // Yossi Benayoun
  spell('Yossi Benayoun', 'WHU', 'West Ham', 63, '2005/06', '2006/07', ["https://en.wikipedia.org/wiki/Yossi_Benayoun", "https://fbref.com/en/players/8414bb13/Yossi-Benayoun"]),
  spell('Yossi Benayoun', 'WHU', 'West Ham', 6, '2012/13', '2012/13', ["https://en.wikipedia.org/wiki/Yossi_Benayoun", "https://fbref.com/en/players/8414bb13/Yossi-Benayoun"]),
  spell('Yossi Benayoun', 'LIV', 'Liverpool', 92, '2007/08', '2009/10', ["https://en.wikipedia.org/wiki/Yossi_Benayoun", "https://fbref.com/en/players/8414bb13/Yossi-Benayoun"]),
  spell('Yossi Benayoun', 'CHE', 'Chelsea', 14, '2010/11', '2012/13', ["https://en.wikipedia.org/wiki/Yossi_Benayoun", "https://fbref.com/en/players/8414bb13/Yossi-Benayoun"]),
  spell('Yossi Benayoun', 'ARS', 'Arsenal', 19, '2011/12', '2011/12', ["https://en.wikipedia.org/wiki/Yossi_Benayoun", "https://fbref.com/en/players/8414bb13/Yossi-Benayoun"]),

  // Zat Knight
  spell('Zat Knight', 'FUL', 'Fulham', 150, '2001/02', '2007/08', ["https://en.wikipedia.org/wiki/Zat_Knight", "https://fbref.com/en/players/607efc45/Zat-Knight"]),
  spell('Zat Knight', 'AVL', 'Aston Villa', 40, '2007/08', '2008/09', ["https://en.wikipedia.org/wiki/Zat_Knight", "https://fbref.com/en/players/607efc45/Zat-Knight"]),
  spell('Zat Knight', 'BOL', 'Bolton', 94, '2009/10', '2011/12', ["https://en.wikipedia.org/wiki/Zat_Knight", "https://fbref.com/en/players/607efc45/Zat-Knight"]),

  // Alvaro Arbeloa
  spell('Alvaro Arbeloa', 'LIV', 'Liverpool', 66, '2006/07', '2008/09', ["https://en.wikipedia.org/wiki/%C3%81lvaro_Arbeloa", "https://fbref.com/en/players/6dc73abd/Alvaro-Arbeloa"]),
  spell('Alvaro Arbeloa', 'WHU', 'West Ham', 3, '2016/17', '2016/17', ["https://en.wikipedia.org/wiki/%C3%81lvaro_Arbeloa", "https://fbref.com/en/players/6dc73abd/Alvaro-Arbeloa"]),

];

export function verifiedPlayerKeys(): Set<string> {
  const keys = new Set<string>();
  for (const row of VERIFIED_PLAYER_CLUB_SPELLS) {
    keys.add(playerKeyFromName(row.playerName));
  }
  return keys;
}

export function playerKeyFromName(playerName: string): string {
  return playerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
