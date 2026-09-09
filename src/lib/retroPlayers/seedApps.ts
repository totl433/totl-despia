/**
 * Starter Premier League player×club appearance pack for The Players daily.
 * Numbers are curated career PL apps (approx where noted) — good enough for
 * puzzle brackets; replace/extend via `retro_player_club_apps` when backfilling
 * full history from FBref etc.
 *
 * Multiple rows with the same player+club = separate spells (e.g. returns).
 */

export type ClubSpell = {
  firstSeason?: string;
  lastSeason?: string;
  appearances: number;
};

export type PlayerClubApp = {
  playerName: string;
  playerKey: string;
  clubCode: string;
  clubName: string;
  /** Total PL apps at this club (sum of spells). */
  appearances: number;
  firstSeason?: string;
  lastSeason?: string;
  /** Separate stints at the club (one entry if continuous). */
  spells: ClubSpell[];
};

function row(
  playerName: string,
  clubCode: string,
  clubName: string,
  appearances: number,
  firstSeason?: string,
  lastSeason?: string
): Omit<PlayerClubApp, 'spells'> & { spells?: ClubSpell[] } {
  const playerKey = playerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return {
    playerName,
    playerKey,
    clubCode,
    clubName,
    appearances,
    firstSeason,
    lastSeason,
    spells: [{ firstSeason, lastSeason, appearances }],
  };
}

/** Seed pack used by the web puzzle builder. */
export const RETRO_PLAYER_CLUB_SEED: Array<Omit<PlayerClubApp, 'spells'> & { spells?: ClubSpell[] }> = [
  // —— Easy legends (100+) ——
  row('Ryan Giggs', 'MUN', 'Man United', 632, '1992/93', '2013/14'),
  row('Gareth Barry', 'AVL', 'Aston Villa', 441, '1997/98', '2008/09'),
  row('Gareth Barry', 'MCI', 'Man City', 132, '2009/10', '2013/14'),
  row('Gareth Barry', 'EVE', 'Everton', 131, '2013/14', '2016/17'),
  row('Frank Lampard', 'CHE', 'Chelsea', 429, '2001/02', '2013/14'),
  row('Frank Lampard', 'WHU', 'West Ham', 148, '1995/96', '2000/01'),
  row('Frank Lampard', 'MCI', 'Man City', 32, '2014/15', '2014/15'),
  row('Steven Gerrard', 'LIV', 'Liverpool', 504, '1998/99', '2014/15'),
  row('John Terry', 'CHE', 'Chelsea', 492, '1998/99', '2016/17'),
  row('Jamie Carragher', 'LIV', 'Liverpool', 508, '1996/97', '2012/13'),
  row('Paul Scholes', 'MUN', 'Man United', 499, '1994/95', '2012/13'),
  row('Gary Speed', 'LEE', 'Leeds', 248, '1992/93', '1995/96'),
  row('Gary Speed', 'EVE', 'Everton', 58, '1996/97', '1997/98'),
  row('Gary Speed', 'NEW', 'Newcastle', 213, '1997/98', '2003/04'),
  row('Gary Speed', 'BOL', 'Bolton', 121, '2004/05', '2007/08'),
  row('Sol Campbell', 'TOT', 'Spurs', 255, '1992/93', '2000/01'),
  row('Sol Campbell', 'ARS', 'Arsenal', 197, '2001/02', '2005/06'),
  row('Sol Campbell', 'POR', 'Portsmouth', 95, '2006/07', '2009/10'),
  row('Ashley Cole', 'ARS', 'Arsenal', 228, '1999/00', '2005/06'),
  row('Ashley Cole', 'CHE', 'Chelsea', 229, '2006/07', '2013/14'),
  row('Rio Ferdinand', 'WHU', 'West Ham', 127, '1995/96', '2000/01'),
  row('Rio Ferdinand', 'LEE', 'Leeds', 54, '2000/01', '2001/02'),
  row('Rio Ferdinand', 'MUN', 'Man United', 312, '2002/03', '2013/14'),
  row('Rio Ferdinand', 'QPR', 'QPR', 11, '2014/15', '2014/15'),
  row('Wayne Rooney', 'EVE', 'Everton', 67, '2002/03', '2003/04'),
  row('Wayne Rooney', 'EVE', 'Everton', 31, '2017/18', '2017/18'),
  row('Wayne Rooney', 'MUN', 'Man United', 393, '2004/05', '2016/17'),
  row('Alan Shearer', 'BLA', 'Blackburn', 138, '1992/93', '1995/96'),
  row('Alan Shearer', 'NEW', 'Newcastle', 303, '1996/97', '2005/06'),
  row('Thierry Henry', 'ARS', 'Arsenal', 258, '1999/00', '2006/07'),
  row('Didier Drogba', 'CHE', 'Chelsea', 226, '2004/05', '2011/12'),
  row('Didier Drogba', 'CHE', 'Chelsea', 28, '2014/15', '2014/15'),
  row('Petr Cech', 'CHE', 'Chelsea', 333, '2004/05', '2014/15'),
  row('Petr Cech', 'ARS', 'Arsenal', 110, '2015/16', '2018/19'),
  row('James Milner', 'LEE', 'Leeds', 48, '2002/03', '2003/04'),
  row('James Milner', 'NEW', 'Newcastle', 94, '2004/05', '2007/08'),
  row('James Milner', 'AVL', 'Aston Villa', 100, '2008/09', '2009/10'),
  row('James Milner', 'MCI', 'Man City', 147, '2010/11', '2014/15'),
  row('James Milner', 'LIV', 'Liverpool', 230, '2015/16', '2022/23'),
  row('James Milner', 'BHA', 'Brighton', 40, '2023/24', '2024/25'),
  row('Mark Noble', 'WHU', 'West Ham', 414, '2004/05', '2021/22'),
  row('Jordan Henderson', 'SUN', 'Sunderland', 71, '2008/09', '2010/11'),
  row('Jordan Henderson', 'LIV', 'Liverpool', 360, '2011/12', '2022/23'),
  row('Peter Crouch', 'TOT', 'Spurs', 73, '2004/05', '2008/09'),
  row('Peter Crouch', 'LIV', 'Liverpool', 85, '2005/06', '2007/08'),
  row('Peter Crouch', 'POR', 'Portsmouth', 38, '2008/09', '2008/09'),
  row('Peter Crouch', 'STK', 'Stoke', 225, '2011/12', '2018/19'),
  row('Peter Crouch', 'BUR', 'Burnley', 6, '2009/10', '2009/10'),
  row('Jermain Defoe', 'WHU', 'West Ham', 93, '2000/01', '2003/04'),
  row('Jermain Defoe', 'TOT', 'Spurs', 139, '2003/04', '2007/08'),
  row('Jermain Defoe', 'TOT', 'Spurs', 137, '2008/09', '2013/14'),
  row('Jermain Defoe', 'POR', 'Portsmouth', 31, '2007/08', '2007/08'),
  row('Jermain Defoe', 'SUN', 'Sunderland', 87, '2014/15', '2016/17'),
  row('Jermain Defoe', 'BOU', 'Bournemouth', 31, '2017/18', '2019/20'),
  row('Dwight Yorke', 'AVL', 'Aston Villa', 231, '1992/93', '1998/99'),
  row('Dwight Yorke', 'MUN', 'Man United', 96, '1998/99', '2001/02'),
  row('Dwight Yorke', 'BLA', 'Blackburn', 60, '2002/03', '2003/04'),
  row('Dwight Yorke', 'BIR', 'Birmingham', 13, '2004/05', '2004/05'),
  row('Dwight Yorke', 'SUN', 'Sunderland', 59, '2005/06', '2007/08'),
  row('Teddy Sheringham', 'NFO', 'Forest', 42, '1992/93', '1992/93'),
  row('Teddy Sheringham', 'TOT', 'Spurs', 166, '1992/93', '1996/97'),
  row('Teddy Sheringham', 'TOT', 'Spurs', 70, '2001/02', '2002/03'),
  row('Teddy Sheringham', 'MUN', 'Man United', 104, '1997/98', '2000/01'),
  row('Teddy Sheringham', 'POR', 'Portsmouth', 32, '2003/04', '2003/04'),
  row('Teddy Sheringham', 'WHU', 'West Ham', 26, '2004/05', '2006/07'),
  row('Kevin Phillips', 'SUN', 'Sunderland', 208, '1997/98', '2002/03'),
  row('Kevin Phillips', 'SOU', 'Southampton', 64, '2003/04', '2004/05'),
  row('Kevin Phillips', 'AVL', 'Aston Villa', 23, '2005/06', '2005/06'),
  row('Kevin Phillips', 'WBA', 'West Brom', 71, '2006/07', '2007/08'),
  row('Kevin Phillips', 'BIR', 'Birmingham', 19, '2008/09', '2009/10'),
  row('Kevin Phillips', 'CRY', 'Palace', 14, '2013/14', '2013/14'),
  row('Nemanja Vidic', 'MUN', 'Man United', 211, '2005/06', '2013/14'),
  row('Patrick Vieira', 'ARS', 'Arsenal', 279, '1996/97', '2004/05'),
  row('Patrick Vieira', 'MCI', 'Man City', 28, '2009/10', '2010/11'),
  row('Dennis Bergkamp', 'ARS', 'Arsenal', 315, '1995/96', '2005/06'),
  row('Tony Adams', 'ARS', 'Arsenal', 255, '1992/93', '2001/02'),
  row('David Seaman', 'ARS', 'Arsenal', 344, '1992/93', '2002/03'),
  row('David Seaman', 'MCI', 'Man City', 19, '2003/04', '2003/04'),
  row('Nigel Martyn', 'CRY', 'Palace', 189, '1992/93', '1996/97'),
  row('Nigel Martyn', 'LEE', 'Leeds', 207, '1996/97', '2002/03'),
  row('Nigel Martyn', 'EVE', 'Everton', 86, '2003/04', '2005/06'),
  row('Tim Howard', 'MUN', 'Man United', 45, '2003/04', '2005/06'),
  row('Tim Howard', 'EVE', 'Everton', 329, '2006/07', '2015/16'),
  row('Joe Hart', 'MCI', 'Man City', 266, '2006/07', '2016/17'),
  row('Joe Hart', 'BIR', 'Birmingham', 36, '2009/10', '2009/10'),
  row('Joe Hart', 'TOT', 'Spurs', 19, '2016/17', '2016/17'),
  row('Joe Hart', 'WHU', 'West Ham', 19, '2017/18', '2017/18'),
  row('Joe Hart', 'BUR', 'Burnley', 19, '2020/21', '2020/21'),
  row('Leighton Baines', 'WIG', 'Wigan', 145, '2005/06', '2006/07'),
  row('Leighton Baines', 'EVE', 'Everton', 348, '2007/08', '2019/20'),
  row('Phil Neville', 'MUN', 'Man United', 263, '1994/95', '2004/05'),
  row('Phil Neville', 'EVE', 'Everton', 198, '2005/06', '2012/13'),
  row('Gary Neville', 'MUN', 'Man United', 400, '1994/95', '2010/11'),
  row('Michael Carrick', 'WHU', 'West Ham', 136, '1999/00', '2003/04'),
  row('Michael Carrick', 'TOT', 'Spurs', 64, '2004/05', '2005/06'),
  row('Michael Carrick', 'MUN', 'Man United', 316, '2006/07', '2017/18'),
  row('Nani', 'MUN', 'Man United', 147, '2007/08', '2014/15'),
  row('Dimitar Berbatov', 'TOT', 'Spurs', 70, '2006/07', '2007/08'),
  row('Dimitar Berbatov', 'MUN', 'Man United', 108, '2008/09', '2011/12'),
  row('Dimitar Berbatov', 'FUL', 'Fulham', 51, '2012/13', '2013/14'),
  row('Robin van Persie', 'ARS', 'Arsenal', 194, '2004/05', '2011/12'),
  row('Robin van Persie', 'MUN', 'Man United', 66, '2012/13', '2014/15'),
  row('Carlos Tevez', 'WHU', 'West Ham', 26, '2006/07', '2006/07'),
  row('Carlos Tevez', 'MUN', 'Man United', 63, '2007/08', '2008/09'),
  row('Carlos Tevez', 'MCI', 'Man City', 105, '2009/10', '2012/13'),
  row('Yaya Toure', 'MCI', 'Man City', 230, '2010/11', '2017/18'),
  row('Sergio Aguero', 'MCI', 'Man City', 275, '2011/12', '2020/21'),
  row('Vincent Kompany', 'MCI', 'Man City', 265, '2008/09', '2018/19'),
  row('David Silva', 'MCI', 'Man City', 309, '2010/11', '2019/20'),
  row('Fernandinho', 'MCI', 'Man City', 264, '2013/14', '2021/22'),
  row('Kevin De Bruyne', 'CHE', 'Chelsea', 3, '2012/13', '2012/13'),
  row('Kevin De Bruyne', 'MCI', 'Man City', 280, '2015/16', '2024/25'),
  row('Raheem Sterling', 'LIV', 'Liverpool', 95, '2012/13', '2014/15'),
  row('Raheem Sterling', 'MCI', 'Man City', 285, '2015/16', '2021/22'),
  row('Raheem Sterling', 'CHE', 'Chelsea', 81, '2022/23', '2023/24'),
  row('Mohamed Salah', 'CHE', 'Chelsea', 13, '2013/14', '2014/15'),
  row('Mohamed Salah', 'LIV', 'Liverpool', 300, '2017/18', '2024/25'),
  row('Sadio Mane', 'SOU', 'Southampton', 67, '2014/15', '2015/16'),
  row('Sadio Mane', 'LIV', 'Liverpool', 196, '2016/17', '2021/22'),
  row('Roberto Firmino', 'LIV', 'Liverpool', 256, '2015/16', '2022/23'),
  row('Virgil van Dijk', 'SOU', 'Southampton', 67, '2015/16', '2017/18'),
  row('Virgil van Dijk', 'LIV', 'Liverpool', 230, '2017/18', '2024/25'),
  row('Andrew Robertson', 'HUL', 'Hull', 36, '2014/15', '2015/16'),
  row('Andrew Robertson', 'LIV', 'Liverpool', 250, '2017/18', '2024/25'),
  row('Harry Kane', 'TOT', 'Spurs', 320, '2013/14', '2022/23'),
  row('Harry Kane', 'NOR', 'Norwich', 3, '2012/13', '2012/13'),
  row('Harry Kane', 'LEI', 'Leicester', 13, '2012/13', '2012/13'),
  row('Son Heung-min', 'TOT', 'Spurs', 320, '2015/16', '2024/25'),
  row('Gareth Bale', 'TOT', 'Spurs', 146, '2007/08', '2012/13'),
  row('Luka Modric', 'TOT', 'Spurs', 127, '2008/09', '2011/12'),
  row('Christian Eriksen', 'TOT', 'Spurs', 226, '2013/14', '2019/20'),
  row('Christian Eriksen', 'BRE', 'Brentford', 11, '2021/22', '2021/22'),
  row('Christian Eriksen', 'MUN', 'Man United', 55, '2022/23', '2024/25'),
  row('Dele Alli', 'TOT', 'Spurs', 181, '2015/16', '2021/22'),
  row('Dele Alli', 'EVE', 'Everton', 13, '2021/22', '2022/23'),
  row('Cesc Fabregas', 'ARS', 'Arsenal', 212, '2003/04', '2010/11'),
  row('Cesc Fabregas', 'CHE', 'Chelsea', 118, '2014/15', '2018/19'),
  row('Eden Hazard', 'CHE', 'Chelsea', 245, '2012/13', '2018/19'),
  row("N'Golo Kante", 'LEI', 'Leicester', 37, '2015/16', '2015/16'),
  row("N'Golo Kante", 'CHE', 'Chelsea', 208, '2016/17', '2022/23'),
  row('Jamie Vardy', 'LEI', 'Leicester', 340, '2014/15', '2024/25'),
  row('Riyad Mahrez', 'LEI', 'Leicester', 158, '2014/15', '2017/18'),
  row('Riyad Mahrez', 'MCI', 'Man City', 181, '2018/19', '2022/23'),
  row('Wilfried Zaha', 'CRY', 'Palace', 297, '2013/14', '2022/23'),
  row('Wilfried Zaha', 'MUN', 'Man United', 2, '2013/14', '2013/14'),
  row('Michail Antonio', 'WHU', 'West Ham', 230, '2015/16', '2024/25'),
  row('Callum Wilson', 'BOU', 'Bournemouth', 157, '2015/16', '2019/20'),
  row('Callum Wilson', 'NEW', 'Newcastle', 110, '2020/21', '2024/25'),
  row('Danny Ings', 'LIV', 'Liverpool', 25, '2015/16', '2018/19'),
  row('Danny Ings', 'SOU', 'Southampton', 90, '2018/19', '2020/21'),
  row('Danny Ings', 'AVL', 'Aston Villa', 88, '2021/22', '2022/23'),
  row('Danny Ings', 'WHU', 'West Ham', 50, '2022/23', '2024/25'),
  row('Ollie Watkins', 'AVL', 'Aston Villa', 160, '2020/21', '2024/25'),
  row('Jack Grealish', 'AVL', 'Aston Villa', 185, '2015/16', '2020/21'),
  row('Jack Grealish', 'MCI', 'Man City', 110, '2021/22', '2024/25'),
  row('Phil Foden', 'MCI', 'Man City', 210, '2017/18', '2024/25'),
  row('Bukayo Saka', 'ARS', 'Arsenal', 200, '2019/20', '2024/25'),
  row('Declan Rice', 'WHU', 'West Ham', 204, '2017/18', '2022/23'),
  row('Declan Rice', 'ARS', 'Arsenal', 70, '2023/24', '2024/25'),
  row('Kai Havertz', 'CHE', 'Chelsea', 91, '2020/21', '2022/23'),
  row('Kai Havertz', 'ARS', 'Arsenal', 70, '2023/24', '2024/25'),
  row('Cole Palmer', 'MCI', 'Man City', 19, '2021/22', '2022/23'),
  row('Cole Palmer', 'CHE', 'Chelsea', 70, '2023/24', '2024/25'),
  row('Marcus Rashford', 'MUN', 'Man United', 300, '2015/16', '2024/25'),
  row('Bruno Fernandes', 'MUN', 'Man United', 220, '2019/20', '2024/25'),
  row('Paul Pogba', 'MUN', 'Man United', 3, '2011/12', '2011/12'),
  row('Paul Pogba', 'MUN', 'Man United', 152, '2016/17', '2021/22'),
  row('Cristiano Ronaldo', 'MUN', 'Man United', 196, '2003/04', '2008/09'),
  row('Cristiano Ronaldo', 'MUN', 'Man United', 40, '2021/22', '2021/22'),
  row('Alexis Sanchez', 'ARS', 'Arsenal', 122, '2014/15', '2017/18'),
  row('Alexis Sanchez', 'MUN', 'Man United', 32, '2017/18', '2018/19'),
  row('Mesut Ozil', 'ARS', 'Arsenal', 184, '2013/14', '2020/21'),
  row('Aaron Ramsey', 'ARS', 'Arsenal', 262, '2008/09', '2018/19'),
  row('Theo Walcott', 'ARS', 'Arsenal', 270, '2005/06', '2017/18'),
  row('Theo Walcott', 'EVE', 'Everton', 76, '2017/18', '2020/21'),
  row('Theo Walcott', 'SOU', 'Southampton', 37, '2020/21', '2022/23'),
  row('Olivier Giroud', 'ARS', 'Arsenal', 180, '2012/13', '2017/18'),
  row('Olivier Giroud', 'CHE', 'Chelsea', 75, '2017/18', '2020/21'),
  row('Fernando Torres', 'LIV', 'Liverpool', 102, '2007/08', '2010/11'),
  row('Fernando Torres', 'CHE', 'Chelsea', 110, '2010/11', '2014/15'),
  row('Luis Suarez', 'LIV', 'Liverpool', 110, '2010/11', '2013/14'),
  row('Xabi Alonso', 'LIV', 'Liverpool', 143, '2004/05', '2008/09'),
  row('Javier Mascherano', 'WHU', 'West Ham', 5, '2006/07', '2006/07'),
  row('Javier Mascherano', 'LIV', 'Liverpool', 94, '2006/07', '2009/10'),
  row('Pepe Reina', 'LIV', 'Liverpool', 219, '2005/06', '2012/13'),
  row('Dirk Kuyt', 'LIV', 'Liverpool', 208, '2006/07', '2011/12'),
  row('Stewart Downing', 'MID', 'Middlesbrough', 181, '2001/02', '2008/09'),
  row('Stewart Downing', 'AVL', 'Aston Villa', 63, '2009/10', '2010/11'),
  row('Stewart Downing', 'LIV', 'Liverpool', 65, '2011/12', '2012/13'),
  row('Stewart Downing', 'WHU', 'West Ham', 79, '2013/14', '2014/15'),
  row('Stewart Downing', 'MID', 'Middlesbrough', 0),
  row('Gareth Southgate', 'CRY', 'Palace', 108, '1992/93', '1994/95'),
  row('Gareth Southgate', 'AVL', 'Aston Villa', 192, '1995/96', '2000/01'),
  row('Gareth Southgate', 'MID', 'Middlesbrough', 160, '2001/02', '2005/06'),
  row('Bryan Robson', 'MUN', 'Man United', 22, '1992/93', '1993/94'),
  row('Bryan Robson', 'MID', 'Middlesbrough', 25, '1996/97', '1996/97'),
  row('Juninho', 'MID', 'Middlesbrough', 126, '1995/96', '2003/04'),
  row('Fabrizio Ravanelli', 'MID', 'Middlesbrough', 33, '1996/97', '1996/97'),
  row('Fabrizio Ravanelli', 'DER', 'Derby', 31, '1997/98', '1998/99'),
  row('Paulo Wanchope', 'DER', 'Derby', 72, '1996/97', '1998/99'),
  row('Paulo Wanchope', 'WHU', 'West Ham', 35, '1999/00', '1999/00'),
  row('Paulo Wanchope', 'MCI', 'Man City', 64, '2000/01', '2003/04'),
  row('Matt Le Tissier', 'SOU', 'Southampton', 270, '1992/93', '2001/02'),
  row('James Beattie', 'SOU', 'Southampton', 187, '1998/99', '2004/05'),
  row('James Beattie', 'EVE', 'Everton', 76, '2004/05', '2006/07'),
  row('James Beattie', 'SHU', 'Sheffield United', 23, '2007/08', '2007/08'),
  row('James Beattie', 'STK', 'Stoke', 38, '2009/10', '2010/11'),
  row('Rickie Lambert', 'SOU', 'Southampton', 128, '2012/13', '2013/14'),
  row('Rickie Lambert', 'LIV', 'Liverpool', 25, '2014/15', '2014/15'),
  row('Rickie Lambert', 'WHU', 'West Ham', 25, '2015/16', '2015/16'),
  row('Jay Rodriguez', 'SOU', 'Southampton', 157, '2012/13', '2016/17'),
  row('Jay Rodriguez', 'WHU', 'West Ham', 34, '2017/18', '2018/19'),
  row('Jay Rodriguez', 'BUR', 'Burnley', 140, '2019/20', '2023/24'),
  row('Charlie Adam', 'BLA', 'Blackburn', 35, '2009/10', '2010/11'),
  row('Charlie Adam', 'LIV', 'Liverpool', 28, '2011/12', '2011/12'),
  row('Charlie Adam', 'STK', 'Stoke', 154, '2012/13', '2018/19'),
  row('Glenn Whelan', 'STK', 'Stoke', 291, '2008/09', '2016/17'),
  row('Ryan Shawcross', 'STK', 'Stoke', 317, '2007/08', '2017/18'),
  row('Asmir Begovic', 'STK', 'Stoke', 172, '2009/10', '2014/15'),
  row('Asmir Begovic', 'CHE', 'Chelsea', 19, '2015/16', '2016/17'),
  row('Asmir Begovic', 'BOU', 'Bournemouth', 76, '2017/18', '2019/20'),
  row('Craig Gardner', 'BIR', 'Birmingham', 58, '2009/10', '2010/11'),
  row('Craig Gardner', 'SUN', 'Sunderland', 81, '2011/12', '2013/14'),
  row('Craig Gardner', 'WBA', 'West Brom', 78, '2014/15', '2016/17'),
  row('Craig Gardner', 'BIR', 'Birmingham', 0),
  row('Craig Gardner', 'AVL', 'Aston Villa', 10, '2010/11', '2010/11'),
  row('Darren Bent', 'IPS', 'Ipswich', 0),
  row('Darren Bent', 'CHA', 'Charlton', 68, '2005/06', '2006/07'),
  row('Darren Bent', 'TOT', 'Spurs', 79, '2007/08', '2008/09'),
  row('Darren Bent', 'SUN', 'Sunderland', 58, '2009/10', '2010/11'),
  row('Darren Bent', 'AVL', 'Aston Villa', 61, '2010/11', '2012/13'),
  row('Darren Bent', 'FUL', 'Fulham', 24, '2013/14', '2013/14'),
  row('Darren Bent', 'BHA', 'Brighton', 0),
  row('Clint Dempsey', 'FUL', 'Fulham', 184, '2006/07', '2012/13'),
  row('Clint Dempsey', 'TOT', 'Spurs', 29, '2012/13', '2012/13'),
  row('Bobby Zamora', 'WHU', 'West Ham', 130, '2003/04', '2007/08'),
  row('Bobby Zamora', 'FUL', 'Fulham', 91, '2008/09', '2011/12'),
  row('Bobby Zamora', 'QPR', 'QPR', 33, '2011/12', '2014/15'),
  row('Bobby Zamora', 'BHA', 'Brighton', 26, '2015/16', '2015/16'),
  row('Scott Parker', 'CHA', 'Charlton', 119, '1999/00', '2003/04'),
  row('Scott Parker', 'CHE', 'Chelsea', 15, '2003/04', '2004/05'),
  row('Scott Parker', 'NEW', 'Newcastle', 55, '2005/06', '2006/07'),
  row('Scott Parker', 'WHU', 'West Ham', 113, '2007/08', '2010/11'),
  row('Scott Parker', 'TOT', 'Spurs', 50, '2011/12', '2012/13'),
  row('Scott Parker', 'FUL', 'Fulham', 50, '2013/14', '2014/15'),
  row('Ledley King', 'TOT', 'Spurs', 268, '1999/00', '2011/12'),
  row('Robbie Keane', 'COV', 'Coventry', 31, '1999/00', '1999/00'),
  row('Robbie Keane', 'INT', 'Inter', 0),
  row('Robbie Keane', 'LEE', 'Leeds', 46, '2000/01', '2001/02'),
  row('Robbie Keane', 'TOT', 'Spurs', 238, '2002/03', '2010/11'),
  row('Robbie Keane', 'LIV', 'Liverpool', 19, '2008/09', '2008/09'),
  row('Robbie Keane', 'WHU', 'West Ham', 9, '2010/11', '2010/11'),
  row('Robbie Keane', 'AVL', 'Aston Villa', 6, '2011/12', '2011/12'),
  row('Andy Cole', 'NEW', 'Newcastle', 70, '1993/94', '1994/95'),
  row('Andy Cole', 'MUN', 'Man United', 195, '1994/95', '2001/02'),
  row('Andy Cole', 'BLA', 'Blackburn', 83, '2001/02', '2003/04'),
  row('Andy Cole', 'FUL', 'Fulham', 31, '2004/05', '2004/05'),
  row('Andy Cole', 'MCI', 'Man City', 22, '2005/06', '2005/06'),
  row('Andy Cole', 'POR', 'Portsmouth', 18, '2006/07', '2006/07'),
  row('Andy Cole', 'SUN', 'Sunderland', 7, '2007/08', '2007/08'),
  row('Dwight McNeil', 'BUR', 'Burnley', 134, '2018/19', '2021/22'),
  row('Dwight McNeil', 'EVE', 'Everton', 90, '2022/23', '2024/25'),
  row('James Tarkowski', 'BUR', 'Burnley', 198, '2016/17', '2021/22'),
  row('James Tarkowski', 'EVE', 'Everton', 100, '2022/23', '2024/25'),
  row('Ben Mee', 'BUR', 'Burnley', 247, '2014/15', '2021/22'),
  row('Ben Mee', 'BRE', 'Brentford', 50, '2022/23', '2023/24'),
  row('Chris Wood', 'LEI', 'Leicester', 7, '2013/14', '2014/15'),
  row('Chris Wood', 'BUR', 'Burnley', 144, '2017/18', '2021/22'),
  row('Chris Wood', 'NEW', 'Newcastle', 35, '2022/23', '2022/23'),
  row('Chris Wood', 'NFO', 'Forest', 70, '2023/24', '2024/25'),
  row('Stuart Pearce', 'NFO', 'Forest', 154, '1992/93', '1996/97'),
  row('Stuart Pearce', 'NEW', 'Newcastle', 37, '1997/98', '1998/99'),
  row('Stuart Pearce', 'WHU', 'West Ham', 42, '1999/00', '2000/01'),
  row('Stuart Pearce', 'MCI', 'Man City', 38, '2001/02', '2001/02'),
  row('Stan Collymore', 'NFO', 'Forest', 65, '1993/94', '1994/95'),
  row('Stan Collymore', 'LIV', 'Liverpool', 63, '1995/96', '1996/97'),
  row('Stan Collymore', 'AVL', 'Aston Villa', 45, '1997/98', '1998/99'),
  row('Stan Collymore', 'LEI', 'Leicester', 6, '1999/00', '1999/00'),
  row('Stan Collymore', 'BRA', 'Bradford', 0),
  row('Stan Collymore', 'BRD', 'Bradford', 7, '2000/01', '2000/01'),
  row('Brian Deane', 'SHU', 'Sheffield United', 40, '1992/93', '1992/93'),
  row('Brian Deane', 'LEE', 'Leeds', 138, '1993/94', '1996/97'),
  row('Brian Deane', 'SHU', 'Sheffield United', 24, '1997/98', '1997/98'),
  row('Brian Deane', 'BEN', 'Benfica', 0),
  row('Brian Deane', 'MID', 'Middlesbrough', 59, '1998/99', '2000/01'),
  row('Brian Deane', 'LEI', 'Leicester', 15, '2001/02', '2001/02'),
  row('Brian Deane', 'WHU', 'West Ham', 26, '2003/04', '2003/04'),
  row('Paolo Di Canio', 'SHW', 'Sheffield Wednesday', 41, '1997/98', '1998/99'),
  row('Paolo Di Canio', 'WHU', 'West Ham', 118, '1999/00', '2002/03'),
  row('Paolo Di Canio', 'CHA', 'Charlton', 31, '2003/04', '2003/04'),
  row('Les Ferdinand', 'QPR', 'QPR', 163, '1992/93', '1994/95'),
  row('Les Ferdinand', 'NEW', 'Newcastle', 68, '1995/96', '1996/97'),
  row('Les Ferdinand', 'TOT', 'Spurs', 118, '1997/98', '2002/03'),
  row('Les Ferdinand', 'WHU', 'West Ham', 14, '2002/03', '2002/03'),
  row('Les Ferdinand', 'LEI', 'Leicester', 29, '2003/04', '2003/04'),
  row('Les Ferdinand', 'BOL', 'Bolton', 12, '2004/05', '2004/05'),
  row('Les Ferdinand', 'REA', 'Reading', 0),
  row('Ian Wright', 'ARS', 'Arsenal', 221, '1992/93', '1997/98'),
  row('Ian Wright', 'WHU', 'West Ham', 22, '1998/99', '1998/99'),
  row('Ian Wright', 'CEL', 'Celtic', 0),
  row('Ian Wright', 'BUR', 'Burnley', 15, '1999/00', '1999/00'),
  row('Tony Cottee', 'EVE', 'Everton', 99, '1992/93', '1993/94'),
  row('Tony Cottee', 'WHU', 'West Ham', 85, '1994/95', '1995/96'),
  row('Tony Cottee', 'LEI', 'Leicester', 25, '1996/97', '1996/97'),
  row('Tony Cottee', 'NOR', 'Norwich', 6, '1996/97', '1996/97'),
  row('Chris Sutton', 'NOR', 'Norwich', 48, '1992/93', '1993/94'),
  row('Chris Sutton', 'BLA', 'Blackburn', 130, '1994/95', '1998/99'),
  row('Chris Sutton', 'CHE', 'Chelsea', 28, '1999/00', '1999/00'),
  row('Chris Sutton', 'CEL', 'Celtic', 0),
  row('Chris Sutton', 'BIR', 'Birmingham', 10, '2006/07', '2006/07'),
  row('Chris Sutton', 'AVL', 'Aston Villa', 8, '2006/07', '2006/07'),
  row('Tim Cahill', 'EVE', 'Everton', 226, '2004/05', '2011/12'),
  row('Mikel Arteta', 'EVE', 'Everton', 162, '2004/05', '2010/11'),
  row('Mikel Arteta', 'ARS', 'Arsenal', 110, '2011/12', '2015/16'),
  row('Leon Osman', 'EVE', 'Everton', 352, '2003/04', '2015/16'),
  row('Phil Jagielka', 'SHU', 'Sheffield United', 40, '2006/07', '2006/07'),
  row('Phil Jagielka', 'EVE', 'Everton', 322, '2007/08', '2018/19'),
  row('Phil Jagielka', 'SHU', 'Sheffield United', 40, '2019/20', '2019/20'),
  row('Seamus Coleman', 'EVE', 'Everton', 370, '2009/10', '2024/25'),
  row('Ross Barkley', 'EVE', 'Everton', 150, '2011/12', '2017/18'),
  row('Ross Barkley', 'CHE', 'Chelsea', 58, '2017/18', '2021/22'),
  row('Ross Barkley', 'AVL', 'Aston Villa', 32, '2020/21', '2020/21'),
  row('Ross Barkley', 'LUT', 'Luton', 32, '2023/24', '2023/24'),
  row('Ross Barkley', 'AVL', 'Aston Villa', 40, '2024/25', '2024/25'),
];

/** Merge seed rows: same player+club with different seasons = multiple spells. */
export function getCleanPlayerClubSeed(): PlayerClubApp[] {
  const map = new Map<string, PlayerClubApp>();

  for (const r of RETRO_PLAYER_CLUB_SEED) {
    if (!r.appearances || r.appearances <= 0) continue;
    if (!r.clubCode || r.clubCode.length > 3) continue;

    const key = `${r.playerKey}::${r.clubCode}`;
    const spell: ClubSpell = {
      firstSeason: r.firstSeason,
      lastSeason: r.lastSeason,
      appearances: r.appearances,
    };
    const prev = map.get(key);

    if (!prev) {
      map.set(key, {
        playerName: r.playerName,
        playerKey: r.playerKey,
        clubCode: r.clubCode,
        clubName: r.clubName,
        appearances: r.appearances,
        firstSeason: r.firstSeason,
        lastSeason: r.lastSeason,
        spells: [spell],
      });
      continue;
    }

    const dup = prev.spells.find(
      (s) => s.firstSeason === spell.firstSeason && s.lastSeason === spell.lastSeason
    );
    if (dup) {
      if (spell.appearances > dup.appearances) dup.appearances = spell.appearances;
    } else {
      prev.spells.push(spell);
    }
    prev.appearances = prev.spells.reduce((sum, s) => sum + s.appearances, 0);
  }

  return Array.from(map.values()).map((r) => {
    const spells = [...r.spells].sort((a, b) => {
      const ay = parseSeasonStart(a.firstSeason || a.lastSeason || '');
      const by = parseSeasonStart(b.firstSeason || b.lastSeason || '');
      return (ay ?? 0) - (by ?? 0);
    });
    return {
      ...r,
      spells,
      firstSeason: spells[0]?.firstSeason ?? r.firstSeason,
      lastSeason: spells[spells.length - 1]?.lastSeason ?? r.lastSeason,
      appearances: spells.reduce((sum, s) => sum + s.appearances, 0),
    };
  });
}

function parseSeasonStart(season: string): number | null {
  const m = String(season || '')
    .trim()
    .match(/^(\d{2,4})\s*\/\s*(\d{2})$/);
  if (!m) return null;
  let y = Number(m[1]);
  if (y < 100) y += y >= 50 ? 1900 : 2000;
  return y;
}
