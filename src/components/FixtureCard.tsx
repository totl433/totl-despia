import React from "react";
import { getMediumName } from "../lib/teamNames";

// Helper function to format minute display
function formatMinuteDisplay(status: string, minute: number | null | undefined, isTestApi: boolean = false): string {
  if (status === 'FINISHED') {
    return 'FT';
  }
  if (status === 'PAUSED') {
    return 'HT';
  }
  if (status === 'IN_PLAY') {
    if (minute === null || minute === undefined) {
      return 'LIVE';
    }
    // For test API, always show actual minutes
    if (isTestApi) {
      return `${minute}'`;
    }
    // First half: 1-45 minutes
    if (minute >= 1 && minute <= 45) {
      return 'First Half';
    }
    // Stoppage time in first half: > 45 but before halftime (typically 45-50)
    if (minute > 45 && minute <= 50) {
      return '45+';
    }
    // Second half: after halftime, typically minute > 50
    if (minute > 50) {
      return 'Second Half';
    }
  }
  return 'LIVE';
}

export type Fixture = {
  id: string;
  gw: number;
  fixture_index: number;
  home_code?: string | null;
  away_code?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  kickoff_time?: string | null;
  api_match_id?: number | null;
};

export type LiveScore = {
  status: string;
  minute: number | null;
  homeScore: number;
  awayScore: number;
  home_team?: string | null;
  away_team?: string | null;
  goals?: Array<{ team: string; scorer: string; minute: number | null }>;
  red_cards?: Array<{ team: string; player: string; minute: number | null }>;
};

export interface FixtureCardProps {
  fixture: Fixture;
  pick?: "H" | "D" | "A";
  liveScore?: LiveScore | null;
  isTestApi?: boolean;
  showPickButtons?: boolean;
}

export const FixtureCard: React.FC<FixtureCardProps> = ({
  fixture: f,
  pick,
  liveScore,
  isTestApi = false,
  showPickButtons = true,
}) => {
  // Always use medium names from teamNames.ts for consistency
  const homeKey = f.home_team || f.home_name || f.home_code || "";
  const awayKey = f.away_team || f.away_name || f.away_code || "";
  const homeName = getMediumName(homeKey);
  const awayName = getMediumName(awayKey);

  const kickoff = f.kickoff_time
    ? (() => {
        const d = new Date(f.kickoff_time);
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      })()
    : "—";

  // ============================================
  // COMPUTE ALL DISPLAY FLAGS FROM DATA
  // ============================================
  // Game state flags
  const hasLiveScore = !!liveScore;
  const isLive = hasLiveScore && liveScore.status === 'IN_PLAY';
  const isHalfTime = hasLiveScore && (liveScore.status === 'PAUSED' || liveScore.status === 'HALF_TIME' || liveScore.status === 'HT');
  const isFinished = hasLiveScore && liveScore.status === 'FINISHED';
  const isOngoing = isLive || isHalfTime;
  
  // Display flags
  const showLiveIndicator = isLive || isHalfTime;
  const showScore = hasLiveScore && (isOngoing || isFinished);
  const showKickoff = !showScore;
  // Show goals/red cards if we have live score data and the arrays exist (even if empty, let the render function decide)
  const showGoals = hasLiveScore && (isOngoing || isFinished) && !!liveScore.goals;
  const showRedCards = hasLiveScore && (isOngoing || isFinished) && !!liveScore.red_cards;
  const showPickButtonsSection = showPickButtons && (!isTestApi || pick !== undefined);
  
  // Team name styling flags
  const homeIsWinning = hasLiveScore && (isOngoing || isFinished) && liveScore.homeScore > liveScore.awayScore;
  const awayIsWinning = hasLiveScore && (isOngoing || isFinished) && liveScore.awayScore > liveScore.homeScore;

  // Determine button states (use live score if available)
  const getButtonState = (side: "H" | "D" | "A") => {
    const isPicked = pick === side;
    let isCorrectResult = false;
    if (liveScore) {
      if (side === 'H' && liveScore.homeScore > liveScore.awayScore) isCorrectResult = true;
      else if (side === 'A' && liveScore.awayScore > liveScore.homeScore) isCorrectResult = true;
      else if (side === 'D' && liveScore.homeScore === liveScore.awayScore) isCorrectResult = true;
    }
    const isCorrect = isPicked && isCorrectResult;
    const isWrong = isPicked && (isOngoing || isFinished) && !isCorrectResult;
    return { isPicked, isCorrectResult, isCorrect, isWrong };
  };

  const homeState = getButtonState("H");
  const drawState = getButtonState("D");
  const awayState = getButtonState("A");

  // Button styling helper
  const getButtonClass = (state: { isPicked: boolean; isCorrectResult: boolean; isCorrect: boolean; isWrong: boolean }) => {
    const base = "h-16 rounded-xl border text-sm font-medium transition-all flex items-center justify-center select-none";
    if (isLive || isOngoing) {
      // Game is live or ongoing
      if (state.isCorrect) {
        return `${base} bg-emerald-600 text-white border-emerald-600 animate-pulse shadow-lg shadow-emerald-500/50`;
      } else if (state.isWrong) {
        return `${base} bg-[#1C8376] text-white border-[#1C8376]`;
      } else if (state.isPicked) {
        return `${base} bg-[#1C8376] text-white border-[#1C8376]`;
      } else if (state.isCorrectResult && !state.isPicked) {
        return `${base} bg-slate-50 text-slate-600 border-2 border-slate-300 animate-pulse`;
      } else {
        return `${base} bg-slate-50 text-slate-600 border-slate-200`;
      }
    } else if (isFinished) {
      // Game is finished
      if (state.isCorrect) {
        return `${base} bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white shadow-2xl shadow-yellow-400/40 transform scale-110 rotate-1 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]`;
      } else if (state.isWrong) {
        return `${base} bg-[#1C8376] text-white border-[#1C8376]`;
      } else if (state.isCorrectResult && !state.isPicked) {
        return `${base} bg-slate-50 text-slate-600 border-4 border-emerald-600`;
      } else if (state.isPicked) {
        return `${base} bg-[#1C8376] text-white border-[#1C8376]`;
      } else {
        return `${base} bg-slate-50 text-slate-600 border-slate-200`;
      }
    } else {
      // Game hasn't started yet
      if (state.isPicked) {
        return `${base} bg-[#1C8376] text-white border-[#1C8376]`;
      } else {
        return `${base} bg-slate-50 text-slate-600 border-slate-200`;
      }
    }
  };

  // Helper to get red card count for a team
  const getRedCardCount = (teamName: string, isHome: boolean) => {
    if (!showRedCards) return 0;
    const allRedCards = liveScore.red_cards || [];
    
    if (allRedCards.length > 0) {
      console.log(`[FixtureCard] Red cards for ${teamName} (${isHome ? 'home' : 'away'}):`, {
        allRedCards,
        teamName,
        homeName,
        awayName,
        liveScoreHomeTeam: liveScore.home_team,
        liveScoreAwayTeam: liveScore.away_team
      });
    }
    
    const teamRedCards = allRedCards.filter((card: any) => {
      if (!card || !card.team) return false;
      const cardTeam = card.team || '';
      const normalizedCardTeam = getMediumName(cardTeam);
      const normalizedTeam = isHome 
        ? (liveScore.home_team ? getMediumName(liveScore.home_team) : homeName)
        : (liveScore.away_team ? getMediumName(liveScore.away_team) : awayName);
      
      const cardTeamNoPrefix = removePrefix(normalizedCardTeam);
      const teamNameNoPrefix = removePrefix(normalizedTeam);
      const fixtureTeamName = isHome ? homeName : awayName;
      const fixtureTeamNameNoPrefix = removePrefix(fixtureTeamName);
      
      // Helper to check if card team name starts with fixture team name (handles "Grêmio Fbpa" vs "Grêmio")
      const cardStartsWithTeam = (cardTeamName: string, teamNameToMatch: string) => {
        const cardLower = cardTeamName.toLowerCase().trim();
        const teamLower = teamNameToMatch.toLowerCase().trim();
        return cardLower === teamLower || cardLower.startsWith(teamLower + ' ');
      };
      
      return normalizedCardTeam === normalizedTeam ||
             normalizedCardTeam === teamName ||
             cardStartsWithTeam(normalizedCardTeam, normalizedTeam) ||
             cardStartsWithTeam(normalizedCardTeam, teamName) ||
             cardStartsWithTeam(normalizedCardTeam, fixtureTeamName) ||
             cardStartsWithTeam(cardTeamNoPrefix, teamNameNoPrefix) ||
             cardStartsWithTeam(cardTeamNoPrefix, fixtureTeamNameNoPrefix) ||
             cardTeamNoPrefix === teamNameNoPrefix ||
             cardTeamNoPrefix === fixtureTeamNameNoPrefix ||
             normalizedCardTeam === getMediumName(isHome ? (f.home_team || '') : (f.away_team || '')) ||
             normalizedCardTeam === getMediumName(isHome ? (f.home_name || '') : (f.away_name || '')) ||
             cardTeam.toLowerCase() === teamName.toLowerCase() ||
             cardTeam.toLowerCase() === fixtureTeamName.toLowerCase() ||
             (cardTeamNoPrefix && teamNameNoPrefix && cardTeamNoPrefix.toLowerCase() === teamNameNoPrefix.toLowerCase());
    });
    
    if (teamRedCards.length > 0) {
      console.log(`[FixtureCard] Filtered red cards for ${teamName}:`, teamRedCards);
    }
    
    return teamRedCards.length;
  };

  // Helper to remove common Brazilian football prefixes (Ca, Se, At, etc.) for matching
  const removePrefix = (name: string) => {
    // Remove common Brazilian prefixes: Ca (Clube Atlético), Se (Sociedade Esportiva), At (Atlético), etc.
    return name.replace(/^(Ca|Se|At|Es|Gr|Sc|Cr|Fc|Ac|Ad|Ap|Av|Bo|Br|Ce|Ch|Co|Cu|De|Ec|Fe|Fi|Fl|Fo|Fr|Fu|Ga|Go|Gu|He|Ho|Hu|In|It|Ja|Je|Ju|La|Le|Li|Lo|Lu|Ma|Me|Mi|Mo|Na|Ne|Ni|No|Nu|Ol|Os|Pa|Pe|Pi|Po|Pr|Pu|Qu|Ra|Re|Ri|Ro|Ru|Sa|Si|So|Su|Ta|Te|Ti|To|Tr|Tu|Un|Ur|Va|Ve|Vi|Vo|Vu|We|Wi|Wo|Wu|Xa|Xe|Xi|Xo|Xu|Ya|Ye|Yi|Yo|Yu|Za|Ze|Zi|Zo|Zu)\s+/i, '').trim();
  };

  // Helper to render goals timeline (red cards shown as icon above badge)
  const renderGoalsTimeline = (teamName: string, isHome: boolean) => {
    if (!showGoals) return null;

    const allGoals = liveScore.goals || [];
    const homeScore = liveScore.homeScore || 0;
    const awayScore = liveScore.awayScore || 0;
    
    // Count goals by team name matching (for name-based matching)
    const homeGoalsByName: any[] = [];
    const awayGoalsByName: any[] = [];
    const unmatchedGoals: any[] = [];
    
    allGoals.forEach((goal: any) => {
      if (!goal || !goal.team) {
        unmatchedGoals.push(goal);
        return;
      }
      
      const goalTeam = goal.team || '';
      const normalizedGoalTeam = getMediumName(goalTeam);
      const normalizedHomeTeam = liveScore.home_team ? getMediumName(liveScore.home_team) : homeName;
      const normalizedAwayTeam = liveScore.away_team ? getMediumName(liveScore.away_team) : awayName;
      
      const goalTeamNoPrefix = removePrefix(normalizedGoalTeam);
      const homeTeamNoPrefix = removePrefix(normalizedHomeTeam);
      const awayTeamNoPrefix = removePrefix(normalizedAwayTeam);
      
      // Helper to check if goal team name starts with fixture team name
      const goalStartsWithTeam = (goalTeamName: string, teamNameToMatch: string) => {
        const goalLower = goalTeamName.toLowerCase().trim();
        const teamLower = teamNameToMatch.toLowerCase().trim();
        return goalLower === teamLower || goalLower.startsWith(teamLower + ' ');
      };
      
      // Helper to check if names are similar (handles "PSG" vs "Paris Saint-Germain", etc.)
      const areSimilarNames = (name1: string, name2: string) => {
        const n1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
        const n2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (n1.length >= 3 && n2.length >= 3) {
          // Check if one contains the other
          if (n1.includes(n2) || n2.includes(n1)) {
            return true;
          }
        }
        
        // Special handling for common abbreviations
        const abbreviationMap: Record<string, string[]> = {
          'psg': ['parissaintgermain', 'paris saint germain', 'paris saint-germain'],
          'spurs': ['tottenham', 'tottenham hotspur'],
          'man city': ['manchester city'],
          'man united': ['manchester united'],
        };
        
        // Check if either name is an abbreviation of the other
        for (const [abbr, fullNames] of Object.entries(abbreviationMap)) {
          const n1IsAbbr = n1 === abbr;
          const n2IsAbbr = n2 === abbr;
          
          if (n1IsAbbr && fullNames.some(full => n2.includes(full.replace(/[^a-z0-9]/g, '')))) {
            return true;
          }
          if (n2IsAbbr && fullNames.some(full => n1.includes(full.replace(/[^a-z0-9]/g, '')))) {
            return true;
          }
        }
        
        return false;
      };
      
      // Try to match to home team - check all variations
      const homeTeamVariations = [
        homeName,
        normalizedHomeTeam,
        f.home_team || '',
        f.home_name || '',
        liveScore.home_team || ''
      ].filter(Boolean);
      
      const matchesHome = normalizedGoalTeam === normalizedHomeTeam ||
             goalTeamNoPrefix === homeTeamNoPrefix ||
             goalStartsWithTeam(normalizedGoalTeam, normalizedHomeTeam) ||
             goalStartsWithTeam(goalTeamNoPrefix, homeTeamNoPrefix) ||
             normalizedGoalTeam === getMediumName(f.home_team || '') ||
             normalizedGoalTeam === getMediumName(f.home_name || '') ||
             goalTeam.toLowerCase() === homeName.toLowerCase() ||
             homeTeamVariations.some(variant => 
               goalTeam.toLowerCase() === variant.toLowerCase() ||
               areSimilarNames(goalTeam, variant) ||
               areSimilarNames(normalizedGoalTeam, getMediumName(variant))
             );
      
      // Try to match to away team - check all variations
      const awayTeamVariations = [
        awayName,
        normalizedAwayTeam,
        f.away_team || '',
        f.away_name || '',
        liveScore.away_team || ''
      ].filter(Boolean);
      
      const matchesAway = normalizedGoalTeam === normalizedAwayTeam ||
             goalTeamNoPrefix === awayTeamNoPrefix ||
             goalStartsWithTeam(normalizedGoalTeam, normalizedAwayTeam) ||
             goalStartsWithTeam(goalTeamNoPrefix, awayTeamNoPrefix) ||
             normalizedGoalTeam === getMediumName(f.away_team || '') ||
             normalizedGoalTeam === getMediumName(f.away_name || '') ||
             goalTeam.toLowerCase() === awayName.toLowerCase() ||
             awayTeamVariations.some(variant => 
               goalTeam.toLowerCase() === variant.toLowerCase() ||
               areSimilarNames(goalTeam, variant) ||
               areSimilarNames(normalizedGoalTeam, getMediumName(variant))
             );
      
      if (matchesHome && !matchesAway) {
        homeGoalsByName.push(goal);
      } else if (matchesAway && !matchesHome) {
        awayGoalsByName.push(goal);
      } else {
        unmatchedGoals.push(goal);
      }
    });
    
    // Use score-based fallback for unmatched goals AND to correct misassigned goals
    // The API sometimes returns wrong teamId (e.g., Randal Kolo Muani showing as Spurs when he's PSG)
    const homeGoalCount = homeGoalsByName.length;
    const awayGoalCount = awayGoalsByName.length;
    const unmatchedCount = unmatchedGoals.length;
    
    // Calculate what we actually need based on the score
    const homeGoalsNeeded = homeScore - homeGoalCount;
    const awayGoalsNeeded = awayScore - awayGoalCount;
    
    // If we have unmatched goals, assign them based on what's needed
    if (unmatchedCount > 0) {
      let homeAssigned = 0;
      let awayAssigned = 0;
      
      unmatchedGoals.forEach((goal) => {
        if (homeAssigned < homeGoalsNeeded && homeGoalsNeeded > 0) {
          homeGoalsByName.push(goal);
          homeAssigned++;
        } else if (awayAssigned < awayGoalsNeeded && awayGoalsNeeded > 0) {
          awayGoalsByName.push(goal);
          awayAssigned++;
        }
      });
    }
    
    // CRITICAL: Re-check and correct misassigned goals using score
    // If the score doesn't match our assignments, we need to fix them
    const finalHomeCount = homeGoalsByName.length;
    const finalAwayCount = awayGoalsByName.length;
    
    // If we have too many goals assigned to one team, move the excess to the other
    if (finalHomeCount > homeScore && finalAwayCount < awayScore) {
      // Too many home goals, not enough away goals - move excess to away
      const excess = finalHomeCount - homeScore;
      const needed = awayScore - finalAwayCount;
      const toMove = Math.min(excess, needed);
      
      // Move the most recently scored goals (highest minute) from home to away
      const sortedHomeGoals = [...homeGoalsByName].sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
      for (let i = 0; i < toMove; i++) {
        const goal = sortedHomeGoals[i];
        const index = homeGoalsByName.indexOf(goal);
        if (index > -1) {
          homeGoalsByName.splice(index, 1);
          awayGoalsByName.push(goal);
        }
      }
    } else if (finalAwayCount > awayScore && finalHomeCount < homeScore) {
      // Too many away goals, not enough home goals - move excess to home
      const excess = finalAwayCount - awayScore;
      const needed = homeScore - finalHomeCount;
      const toMove = Math.min(excess, needed);
      
      // Move the most recently scored goals (highest minute) from away to home
      const sortedAwayGoals = [...awayGoalsByName].sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
      for (let i = 0; i < toMove; i++) {
        const goal = sortedAwayGoals[i];
        const index = awayGoalsByName.indexOf(goal);
        if (index > -1) {
          awayGoalsByName.splice(index, 1);
          homeGoalsByName.push(goal);
        }
      }
    }
    
    // Debug logging for PSG/Paris Saint-Germain
    if ((teamName.toLowerCase().includes('psg') || teamName.toLowerCase().includes('paris'))) {
      console.log('[FixtureCard] PSG goal matching debug:', {
        teamName,
        isHome,
        homeScore,
        awayScore,
        homeGoalCount: homeGoalsByName.length,
        awayGoalCount: awayGoalsByName.length,
        unmatchedCount,
        allGoals: allGoals.map((g: any) => ({ team: g.team, scorer: g.scorer, minute: g.minute, teamId: g.teamId })),
        homeGoals: homeGoalsByName.map((g: any) => ({ team: g.team, scorer: g.scorer, minute: g.minute })),
        awayGoals: awayGoalsByName.map((g: any) => ({ team: g.team, scorer: g.scorer, minute: g.minute }))
      });
    }
    
    // Select goals for the team we're rendering
    const teamGoals = isHome ? homeGoalsByName : awayGoalsByName;
    

    // Group goals by scorer
    const goalsByScorer = new Map<string, number[]>();
    teamGoals.forEach((goal: any) => {
      const scorer = goal.scorer || 'Unknown';
      const minute = goal.minute;
      if (!goalsByScorer.has(scorer)) {
        goalsByScorer.set(scorer, []);
      }
      if (minute !== null && minute !== undefined) {
        goalsByScorer.get(scorer)!.push(minute);
      }
    });

    // Debug logging for Grêmio
    if (teamName === 'Grêmio' && teamGoals.length > 0) {
      console.log('[FixtureCard] Grêmio goals debug:', {
        teamGoals,
        goalsByScorer: Array.from(goalsByScorer.entries()),
        goalsByScorerSize: goalsByScorer.size
      });
    }

    if (goalsByScorer.size === 0) return null;

    return (
      <div className={`mt-3 mb-2 flex flex-col ${isHome ? 'items-end' : 'items-start'} gap-0.5`}>
        {Array.from(goalsByScorer.entries()).map(([scorer, minutes], idx) => {
          const sortedMinutes = minutes.sort((a, b) => a - b);
          return (
            <span key={idx} className="text-[11px] text-slate-600">
              {scorer} {sortedMinutes.map(m => `${m}'`).join(', ')}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-4 !bg-white relative z-0">
      {/* LIVE indicator */}
      {showLiveIndicator && (
        <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pb-6">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-bold text-red-600">LIVE</span>
        </div>
      )}

      {/* Header: Home score/kickoff Away */}
      <div className={`flex flex-col px-2 pb-3 ${isOngoing ? 'pt-4' : 'pt-1'}`}>
        <div className="flex items-start justify-between">
          {/* Home Team */}
          <div className="flex-1 flex flex-col items-end">
            <div className="flex items-center gap-1 relative">
              <div className={`break-words ${homeIsWinning ? 'font-bold' : 'font-medium'}`}>
                {homeName}
              </div>
              <div className="relative flex flex-col items-center">
                <img 
                  src={`/assets/badges/${(f.home_code || homeKey).toUpperCase()}.png`} 
                  alt={homeName}
                  className="w-5 h-5"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0.35";
                  }}
                />
              </div>
            </div>
            {showGoals && renderGoalsTimeline(homeName, true)}
          </div>

          {/* Score / Kickoff Time */}
          <div className="px-4 flex flex-col items-center">
            {showScore ? (
              <>
                <div className="flex items-center gap-2 relative">
                  {/* Home score with red card */}
                  <div className="relative flex flex-col items-center">
                    {showRedCards && getRedCardCount(homeName, true) > 0 && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-1.5 h-2.5 bg-red-600 rounded-sm z-10"></div>
                    )}
                    <span className="font-bold text-base text-slate-900">
                      {liveScore!.homeScore}
                    </span>
                  </div>
                  <span className="font-bold text-base text-slate-900">-</span>
                  {/* Away score with red card */}
                  <div className="relative flex flex-col items-center">
                    {showRedCards && getRedCardCount(awayName, false) > 0 && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-1.5 h-2.5 bg-red-600 rounded-sm z-10"></div>
                    )}
                    <span className="font-bold text-base text-slate-900">
                      {liveScore!.awayScore}
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold mt-0.5 ${isOngoing ? 'text-red-600' : 'text-slate-500'}`}>
                  {formatMinuteDisplay(liveScore!.status, liveScore!.minute, isTestApi)}
                </span>
              </>
            ) : (
              showKickoff && <span className="text-slate-500 text-sm">{kickoff}</span>
            )}
          </div>

          {/* Away Team */}
          <div className="flex-1 flex flex-col items-start">
            <div className="flex items-center gap-1 relative">
              <div className="relative flex flex-col items-center">
                <img 
                  src={`/assets/badges/${(f.away_code || awayKey).toUpperCase()}.png`} 
                  alt={awayName}
                  className="w-5 h-5"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0.35";
                  }}
                />
              </div>
              <div className={`break-words ${awayIsWinning ? 'font-bold' : 'font-medium'}`}>
                {awayName}
              </div>
            </div>
            {showGoals && renderGoalsTimeline(awayName, false)}
          </div>
        </div>
      </div>

      {/* Pick buttons */}
      {showPickButtonsSection && (
        <div className="grid grid-cols-3 gap-3 relative">
          <div className={`${getButtonClass(homeState)} flex items-center justify-center`}>
            <span className={`${homeState.isCorrect ? "font-bold" : ""} ${homeState.isWrong && isFinished ? "line-through decoration-2 decoration-white" : ""}`}>
              Home Win
            </span>
          </div>
          <div className={`${getButtonClass(drawState)} flex items-center justify-center`}>
            <span className={`${drawState.isCorrect ? "font-bold" : ""} ${drawState.isWrong && isFinished ? "line-through decoration-2 decoration-white" : ""}`}>
              Draw
            </span>
          </div>
          <div className={`${getButtonClass(awayState)} flex items-center justify-center`}>
            <span className={`${awayState.isCorrect ? "font-bold" : ""} ${awayState.isWrong && isFinished ? "line-through decoration-2 decoration-white" : ""}`}>
              Away Win
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

