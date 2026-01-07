import React from "react";
import { getMediumName, areTeamNamesSimilar } from "../lib/teamNames";

// Helper function to extract surname from full name
function getSurname(fullName: string | null | undefined): string {
  if (!fullName) return 'Unknown';
  const trimmed = fullName.trim();
  // Handle special cases like "Own Goal"
  if (trimmed.toLowerCase().includes('own goal') || trimmed.toLowerCase().includes('(og)')) {
    return trimmed;
  }
  // Split by spaces and get the last word (surname)
  const parts = trimmed.split(/\s+/);
  if (parts.length === 0) return trimmed;
  if (parts.length === 1) return trimmed; // Single name, return as is
  return parts[parts.length - 1]; // Return last word (surname)
}

// Helper function to format minute display
function formatMinuteDisplay(status: string, minute: number | null | undefined): string {
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
    // Always show actual minute from API
    return `${minute}'`;
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
  pickPercentages?: { H: number; D: number; A: number } | null;
}

export const FixtureCard: React.FC<FixtureCardProps> = ({
  fixture: f,
  pick,
  liveScore,
  isTestApi: _isTestApi = false,
  showPickButtons = true,
  pickPercentages = null,
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
  // Always show pick buttons if showPickButtons is true (don't require pick to exist)
  // This allows users to make picks even if they haven't picked yet
  const showPickButtonsSection = showPickButtons;
  
  // Team name styling flags
  const homeIsWinning = hasLiveScore && (isOngoing || isFinished) && liveScore.homeScore > liveScore.awayScore;
  const awayIsWinning = hasLiveScore && (isOngoing || isFinished) && liveScore.awayScore > liveScore.homeScore;

  // Determine button states (use live score if available, or result for finished non-API games)
  const getButtonState = (side: "H" | "D" | "A") => {
    const isPicked = pick === side;
    let isCorrectResult = false;
    if (liveScore) {
      // Check if we have a direct result (for non-API fixtures from app_gw_results)
      if ((liveScore as any).result) {
        isCorrectResult = (liveScore as any).result === side;
      } else {
        // Use score comparison for API fixtures
        if (side === 'H' && liveScore.homeScore > liveScore.awayScore) isCorrectResult = true;
        else if (side === 'A' && liveScore.awayScore > liveScore.homeScore) isCorrectResult = true;
        else if (side === 'D' && liveScore.homeScore === liveScore.awayScore) isCorrectResult = true;
      }
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
    const base = "h-16 rounded-xl border text-sm font-medium transition-all select-none";
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
      // Normalize goal team name - handle case variations like "Paris Saint-germain" vs "Paris Saint-Germain"
      const normalizedGoalTeam = getMediumName(goalTeam);
      // Also get raw normalized version for better matching
      const goalTeamNormalized = goalTeam.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const normalizedHomeTeam = liveScore.home_team ? getMediumName(liveScore.home_team) : homeName;
      const normalizedAwayTeam = liveScore.away_team ? getMediumName(liveScore.away_team) : awayName;
      const homeTeamNormalized = normalizedHomeTeam.toLowerCase().replace(/[^a-z0-9]/g, '');
      const awayTeamNormalized = normalizedAwayTeam.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const goalTeamNoPrefix = removePrefix(normalizedGoalTeam);
      const homeTeamNoPrefix = removePrefix(normalizedHomeTeam);
      const awayTeamNoPrefix = removePrefix(normalizedAwayTeam);
      
      // Helper to check if goal team name starts with fixture team name
      const goalStartsWithTeam = (goalTeamName: string, teamNameToMatch: string) => {
        const goalLower = goalTeamName.toLowerCase().trim();
        const teamLower = teamNameToMatch.toLowerCase().trim();
        return goalLower === teamLower || goalLower.startsWith(teamLower + ' ');
      };
      
      // Use shared utility function for team name matching (handles "PSG" vs "Paris Saint-Germain", etc.)
      
      // Try to match to home team - check all variations
      const homeTeamVariations = [
        homeName,
        normalizedHomeTeam,
        f.home_team || '',
        f.home_name || '',
        liveScore.home_team || ''
      ].filter(Boolean);
      
      // Check normalized versions for PSG matching (handles "parissaintgermain" variations)
      const matchesHomeNormalized = goalTeamNormalized === homeTeamNormalized ||
                                     (goalTeamNormalized.includes('parissaintgermain') && homeTeamNormalized === 'psg') ||
                                     (homeTeamNormalized.includes('parissaintgermain') && goalTeamNormalized === 'psg') ||
                                     (goalTeamNormalized.includes('parissaintgermain') && homeTeamNormalized.includes('parissaintgermain'));
      
      const matchesAwayNormalized = goalTeamNormalized === awayTeamNormalized ||
                                    (goalTeamNormalized.includes('parissaintgermain') && awayTeamNormalized === 'psg') ||
                                    (awayTeamNormalized.includes('parissaintgermain') && goalTeamNormalized === 'psg') ||
                                    (goalTeamNormalized.includes('parissaintgermain') && awayTeamNormalized.includes('parissaintgermain'));
      
      const matchesHome = normalizedGoalTeam === normalizedHomeTeam ||
             goalTeamNoPrefix === homeTeamNoPrefix ||
             goalStartsWithTeam(normalizedGoalTeam, normalizedHomeTeam) ||
             goalStartsWithTeam(goalTeamNoPrefix, homeTeamNoPrefix) ||
             normalizedGoalTeam === getMediumName(f.home_team || '') ||
             normalizedGoalTeam === getMediumName(f.home_name || '') ||
             goalTeam.toLowerCase() === homeName.toLowerCase() ||
             matchesHomeNormalized ||
             homeTeamVariations.some(variant => 
               goalTeam.toLowerCase() === variant.toLowerCase() ||
               areTeamNamesSimilar(goalTeam, variant) ||
               areTeamNamesSimilar(normalizedGoalTeam, getMediumName(variant))
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
             matchesAwayNormalized ||
             awayTeamVariations.some(variant => 
               goalTeam.toLowerCase() === variant.toLowerCase() ||
               areTeamNamesSimilar(goalTeam, variant) ||
               areTeamNamesSimilar(normalizedGoalTeam, getMediumName(variant))
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
    // The score is the source of truth - if our assignments don't match, fix them
    const finalHomeCount = homeGoalsByName.length;
    const finalAwayCount = awayGoalsByName.length;
    const totalGoals = allGoals.length;
    
    // If total goals don't match score, we have a problem - but still try to fix assignments
    if (totalGoals !== (homeScore + awayScore)) {
      console.warn('[FixtureCard] Goal count mismatch:', {
        totalGoals,
        homeScore,
        awayScore,
        expectedTotal: homeScore + awayScore
      });
    }
    
    // Force correction: ensure home/away goal counts match the score exactly
    // If they don't match, reassign goals to make them match
    if (finalHomeCount !== homeScore || finalAwayCount !== awayScore) {
      console.log('[FixtureCard] Score-based correction needed:', {
        homeCount: finalHomeCount,
        homeScore,
        awayCount: finalAwayCount,
        awayScore,
        totalGoals
      });
      
      // Calculate what we need
      const homeGoalsNeeded = homeScore - finalHomeCount;
      const awayGoalsNeeded = awayScore - finalAwayCount;
      
      if (homeGoalsNeeded > 0 && awayGoalsNeeded < 0) {
        // Need to move goals from away to home
        const toMove = Math.min(Math.abs(awayGoalsNeeded), homeGoalsNeeded);
        const sortedAwayGoals = [...awayGoalsByName].sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
        for (let i = 0; i < toMove; i++) {
          const goal = sortedAwayGoals[i];
          const index = awayGoalsByName.indexOf(goal);
          if (index > -1) {
            awayGoalsByName.splice(index, 1);
            homeGoalsByName.push(goal);
            console.log('[FixtureCard] Moved goal from away to home:', goal.scorer, goal.minute);
          }
        }
      } else if (awayGoalsNeeded > 0 && homeGoalsNeeded < 0) {
        // Need to move goals from home to away
        const toMove = Math.min(Math.abs(homeGoalsNeeded), awayGoalsNeeded);
        const sortedHomeGoals = [...homeGoalsByName].sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
        for (let i = 0; i < toMove; i++) {
          const goal = sortedHomeGoals[i];
          const index = homeGoalsByName.indexOf(goal);
          if (index > -1) {
            homeGoalsByName.splice(index, 1);
            awayGoalsByName.push(goal);
            console.log('[FixtureCard] Moved goal from home to away:', goal.scorer, goal.minute);
          }
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
    

    // Group goals by scorer, tracking which minutes are own goals
    const goalsByScorer = new Map<string, Array<{ minute: number; isOwnGoal: boolean }>>();
    teamGoals.forEach((goal: any) => {
      const scorer = goal.scorer || 'Unknown';
      const minute = goal.minute;
      const isOwnGoal = goal.isOwnGoal === true;
      if (!goalsByScorer.has(scorer)) {
        goalsByScorer.set(scorer, []);
      }
      if (minute !== null && minute !== undefined) {
        goalsByScorer.get(scorer)!.push({ minute, isOwnGoal });
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
        {Array.from(goalsByScorer.entries()).map(([scorer, goalData], idx) => {
          // Sort by minute
          const sortedGoalData = goalData.sort((a, b) => a.minute - b.minute);
          const surname = getSurname(scorer);
          // Format minutes with (OG) for own goals
          const minutesDisplay = sortedGoalData.map(g => 
            g.isOwnGoal ? `${g.minute}' (OG)` : `${g.minute}'`
          ).join(', ');
          return (
            <span key={idx} className="text-xs text-slate-600">
              {surname} {minutesDisplay}
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
                  {formatMinuteDisplay(liveScore!.status, liveScore!.minute)}
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
          <div className={`${getButtonClass(homeState)} flex flex-col items-center justify-center`}>
            <span className={`${homeState.isCorrect ? "font-bold" : ""} ${homeState.isWrong && isFinished ? "line-through decoration-2 decoration-white" : ""}`}>
              Home Win
            </span>
            {pickPercentages !== null && (
              <span className="text-xs font-bold opacity-80 mt-0.5">{pickPercentages.H}%</span>
            )}
          </div>
          <div className={`${getButtonClass(drawState)} flex flex-col items-center justify-center`}>
            <span className={`${drawState.isCorrect ? "font-bold" : ""} ${drawState.isWrong && isFinished ? "line-through decoration-2 decoration-white" : ""}`}>
              Draw
            </span>
            {pickPercentages !== null && (
              <span className="text-xs font-bold opacity-80 mt-0.5">{pickPercentages.D}%</span>
            )}
          </div>
          <div className={`${getButtonClass(awayState)} flex flex-col items-center justify-center`}>
            <span className={`${awayState.isCorrect ? "font-bold" : ""} ${awayState.isWrong && isFinished ? "line-through decoration-2 decoration-white" : ""}`}>
              Away Win
            </span>
            {pickPercentages !== null && (
              <span className="text-xs font-bold opacity-80 mt-0.5">{pickPercentages.A}%</span>
            )}
          </div>
        </div>
      )}
      {/* Show percentages even when pick buttons are hidden (e.g., when game is LIVE) */}
      {!showPickButtonsSection && pickPercentages !== null && (
        <div className="grid grid-cols-3 gap-3 relative mt-3">
          <div className={`${getButtonClass(homeState)} flex flex-col items-center justify-center`}>
            <span className={`${homeState.isCorrect ? "font-bold" : ""} ${homeState.isWrong && isFinished ? "line-through decoration-2 decoration-white" : ""}`}>
              Home Win
            </span>
            <span className="text-xs font-bold opacity-80 mt-0.5">{pickPercentages.H}%</span>
          </div>
          <div className={`${getButtonClass(drawState)} flex flex-col items-center justify-center`}>
            <span className={`${drawState.isCorrect ? "font-bold" : ""} ${drawState.isWrong && isFinished ? "line-through decoration-2 decoration-white" : ""}`}>
              Draw
            </span>
            <span className="text-xs font-bold opacity-80 mt-0.5">{pickPercentages.D}%</span>
          </div>
          <div className={`${getButtonClass(awayState)} flex flex-col items-center justify-center`}>
            <span className={`${awayState.isCorrect ? "font-bold" : ""} ${awayState.isWrong && isFinished ? "line-through decoration-2 decoration-white" : ""}`}>
              Away Win
            </span>
            <span className="text-xs font-bold opacity-80 mt-0.5">{pickPercentages.A}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

