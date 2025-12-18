/**
 * Helper function to convert number to ordinal (1st, 2nd, 3rd, etc.)
 */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Helper function to get initials from name
 */
export function initials(name: string): string {
  const parts = (name || "?").trim().split(/\s+/);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Helper function to convert Set or Array to Set
 */
export function toStringSet(value?: Set<string> | string[] | undefined): Set<string> {
  if (!value) return new Set<string>();
  return value instanceof Set ? value : new Set(value);
}

/**
 * Calculate form ranking (5-week or 10-week) for a user
 * Single source of truth for form ranking calculations
 * Uses app_v_gw_points and app_v_ocp_overall (single source of truth per PR.md)
 */
export function calculateFormRank(
  userId: string,
  startGw: number,
  endGw: number,
  allGwPoints: Array<{user_id: string, gw: number, points: number}>,
  overall: Array<{user_id: string, name: string | null, ocp: number | null}>
): { rank: number; total: number; isTied: boolean } | null {
  if (endGw < startGw) return null;
  
  const formPoints = allGwPoints.filter(gp => gp.gw >= startGw && gp.gw <= endGw);
  const userData = new Map<string, { user_id: string; name: string; formPoints: number; weeksPlayed: Set<number> }>();
  
  // Initialize userData from overall (all users who have played)
  overall.forEach(o => {
    userData.set(o.user_id, {
      user_id: o.user_id,
      name: o.name ?? "User",
      formPoints: 0,
      weeksPlayed: new Set()
    });
  });
  
  // Add points for each GW in the form period
  formPoints.forEach(gp => {
    const user = userData.get(gp.user_id);
    if (user) {
      user.formPoints += gp.points ?? 0;
      user.weeksPlayed.add(gp.gw);
    }
  });
  
  // Filter to only users who played ALL weeks in the form period
  const sorted = Array.from(userData.values())
    .filter(u => {
      for (let g = startGw; g <= endGw; g++) {
        if (!u.weeksPlayed.has(g)) return false;
      }
      return true;
    })
    .sort((a, b) => b.formPoints - a.formPoints || a.name.localeCompare(b.name));
  
  if (sorted.length === 0) return null;
  
  let currentRank = 1;
  const ranked = sorted.map((player, index) => {
    if (index > 0 && sorted[index - 1].formPoints !== player.formPoints) {
      currentRank = index + 1;
    }
    return { ...player, rank: currentRank };
  });
  
  const userEntry = ranked.find(u => u.user_id === userId);
  if (!userEntry) return null;
  
  const rankCount = ranked.filter(r => r.rank === userEntry.rank).length;
  return {
    rank: userEntry.rank,
    total: ranked.length,
    isTied: rankCount > 1
  };
}

/**
 * Calculate last gameweek ranking for a user
 * Single source of truth for last GW ranking calculations
 * Uses app_v_gw_points (single source of truth per PR.md)
 */
export function calculateLastGwRank(
  userId: string,
  lastCompletedGw: number,
  allGwPoints: Array<{user_id: string, gw: number, points: number}>
): { rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null {
  if (!lastCompletedGw || allGwPoints.length === 0) return null;
  
  const lastGwData = allGwPoints.filter(gp => gp.gw === lastCompletedGw);
  if (lastGwData.length === 0) return null;
  
  const sorted = [...lastGwData].sort((a, b) => b.points - a.points);
  let currentRank = 1;
  const ranked = sorted.map((player, index) => {
    if (index > 0 && sorted[index - 1].points !== player.points) {
      currentRank = index + 1;
    }
    return { ...player, rank: currentRank };
  });
  
  const userEntry = ranked.find(r => r.user_id === userId);
  if (!userEntry) return null;
  
  const rankCount = ranked.filter(r => r.rank === userEntry.rank).length;
  return {
    rank: userEntry.rank,
    total: ranked.length,
    score: userEntry.points,
    gw: lastCompletedGw,
    totalFixtures: 10, // TODO: get actual fixture count
    isTied: rankCount > 1
  };
}

/**
 * Calculate season ranking for a user
 * Single source of truth for season ranking calculations
 * Uses app_v_ocp_overall (single source of truth per PR.md)
 */
export function calculateSeasonRank(
  userId: string,
  overall: Array<{user_id: string, name: string | null, ocp: number | null}>
): { rank: number; total: number; isTied: boolean } | null {
  if (overall.length === 0) return null;
  
  const sorted = [...overall].sort((a, b) => (b.ocp ?? 0) - (a.ocp ?? 0) || (a.name ?? "User").localeCompare(b.name ?? "User"));
  let currentRank = 1;
  const ranked = sorted.map((player, index) => {
    if (index > 0 && (sorted[index - 1].ocp ?? 0) !== (player.ocp ?? 0)) {
      currentRank = index + 1;
    }
    return { ...player, rank: currentRank };
  });
  
  const userEntry = ranked.find(o => o.user_id === userId);
  if (!userEntry) return null;
  
  const rankCount = ranked.filter(r => r.rank === userEntry.rank).length;
  return {
    rank: userEntry.rank,
    total: overall.length,
    isTied: rankCount > 1
  };
}


























