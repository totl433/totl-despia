import TeamBadge from '../TeamBadge';
import PickChip from './PickChip';
import { getMediumName } from '../../lib/teamNames';

export type Fixture = {
  id?: string;
  gw: number;
  fixture_index: number;
  home_team: string;
  away_team: string;
  home_code?: string | null;
  away_code?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  home_crest?: string | null;
  away_crest?: string | null;
  kickoff_time?: string | null;
};

export type PickRow = {
  user_id: string;
  gw: number;
  fixture_index: number;
  pick: "H" | "D" | "A";
};

export type LiveScore = {
  homeScore: number;
  awayScore: number;
  status: string;
  minute?: number | null;
};

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

// Helper function to get initials
function initials(name: string) {
  const parts = (name || "?").trim().split(/\s+/);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface LeagueFixtureCardProps {
  fixture: Fixture;
  picks: PickRow[];
  members: Array<{ id: string; name: string }>;
  outcome: "H" | "D" | "A" | null;
  liveScore?: LiveScore | null;
  submittedMap: Map<string, boolean>;
  picksGw: number;
  isApiTestLeague?: boolean;
}

/**
 * LeagueFixtureCard - Displays a single fixture with team badges, score/time, and member picks as chips
 * Used in GW Picks tab
 */
export default function LeagueFixtureCard({
  fixture: f,
  picks,
  members,
  outcome,
  liveScore,
  submittedMap,
  picksGw,
  isApiTestLeague = false,
}: LeagueFixtureCardProps) {
  // Get team names - always use medium names
  const homeKey = f.home_code || f.home_team || f.home_name || "";
  const awayKey = f.away_code || f.away_team || f.away_name || "";
  const homeName = getMediumName(homeKey) || f.home_name || f.home_team || "Home";
  const awayName = getMediumName(awayKey) || f.away_name || f.away_team || "Away";

  // Format kickoff time
  const timeOf = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };
  const timeStr = timeOf(f.kickoff_time);

  // Determine game state
  const isLive = !!(liveScore && liveScore.status === 'IN_PLAY');
  const isHalfTime = !!(liveScore && (liveScore.status === 'PAUSED' || liveScore.status === 'HALF_TIME' || liveScore.status === 'HT'));
  const isFinished = !!(liveScore && liveScore.status === 'FINISHED');
  const isOngoing = isLive || isHalfTime;

  // Determine actual result (from live score or outcome)
  let actualResult: "H" | "D" | "A" | null = null;
  if (isApiTestLeague && liveScore) {
    if (liveScore.homeScore > liveScore.awayScore) actualResult = 'H';
    else if (liveScore.awayScore > liveScore.homeScore) actualResult = 'A';
    else if (liveScore.homeScore === liveScore.awayScore) actualResult = 'D';
  } else {
    actualResult = outcome;
  }

  // Render chips for a specific pick type (H/D/A)
  const toChips = (want: "H" | "D" | "A") => {
    const filtered = picks.filter((p) => p.pick === want);
    
    // Group chips into rows of maximum 4
    const chipsPerRow = 4;
    const rows = [];
    
    for (let i = 0; i < filtered.length; i += chipsPerRow) {
      const rowChips = filtered.slice(i, i + chipsPerRow);
      rows.push(rowChips);
    }
    
    // Overlap amount for larger avatars (36px)
    const overlapAmount = 12;
    
    return (
      <div className="flex flex-col gap-1">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex items-center justify-center">
            {row.map((p, idx) => {
              const m = members.find((mm) => mm.id === p.user_id);
              const letter = initials(m?.name ?? "?");
              const hasSubmitted = submittedMap.has(`${p.user_id}:${picksGw}`);
              const isCorrect = actualResult && actualResult === want ? true : null;
              
              // Always apply overlapping effect
              return (
                <span 
                  key={p.user_id}
                  className="inline-block"
                  style={{
                    marginLeft: idx > 0 ? `-${overlapAmount}px` : '0',
                    position: 'relative',
                    zIndex: idx
                  }}
                >
                  <PickChip 
                    letter={letter}
                    userId={p.user_id}
                    userName={m?.name}
                    correct={isCorrect} 
                    unicorn={isCorrect === true} 
                    hasSubmitted={hasSubmitted} 
                    isLive={isLive} 
                    isOngoing={isOngoing} 
                    isFinished={isFinished} 
                  />
                </span>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <li className="border-t first:border-t-0">
      <div className="p-4 bg-white dark:bg-slate-800 relative">
        {/* LIVE indicator - red dot top left for live games */}
        {(isLive || isHalfTime) && (
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pb-6">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-red-600">LIVE</span>
          </div>
        )}
        {/* FT indicator for finished games */}
        {isFinished && !isLive && !isHalfTime && (
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10 pb-6">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">FT</span>
          </div>
        )}
        
        {/* Fixture display */}
        <div className={`grid grid-cols-3 items-center ${isOngoing ? 'pt-4' : ''}`}>
          <div className="flex items-center justify-center">
            <span className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 truncate">{homeName}</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <TeamBadge 
              code={f.home_code || undefined}
              crest={f.home_crest || undefined}
              size={24}
              className="h-6 w-6"
            />
            <div className="text-[15px] sm:text-base font-semibold text-slate-600 dark:text-slate-300">
              {liveScore && (isLive || isHalfTime || isFinished) ? (
                <span className="font-bold text-base text-slate-900 dark:text-slate-100">
                  {liveScore.homeScore} - {liveScore.awayScore}
                </span>
              ) : (
                <span>{timeStr}</span>
              )}
            </div>
            <TeamBadge 
              code={f.away_code || undefined}
              crest={f.away_crest || undefined}
              size={24}
              className="h-6 w-6"
            />
          </div>
          <div className="flex items-center justify-center">
            <span className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100 truncate">{awayName}</span>
          </div>
        </div>
        
        {/* Score indicator */}
        {liveScore && (isOngoing || isFinished) && (
          <div className="flex justify-center mt-1">
            <span className={`text-[10px] font-semibold ${isOngoing ? 'text-red-600' : 'text-slate-500 dark:text-slate-400'}`}>
              {formatMinuteDisplay(liveScore.status, liveScore.minute)}
            </span>
          </div>
        )}
        
        {/* Pips underneath */}
        <div className="mt-2 grid grid-cols-3">
          <div className="relative min-h-[48px]">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              {toChips("H")}
            </div>
          </div>
          <div className="relative min-h-[48px]">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              {toChips("D")}
            </div>
          </div>
          <div className="relative min-h-[48px]">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              {toChips("A")}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

