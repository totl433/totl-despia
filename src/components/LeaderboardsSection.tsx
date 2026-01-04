import { LeaderboardCard } from './LeaderboardCard';
import { StreakCard } from './StreakCard';
import Section from './Section';
import { HorizontalScrollContainer } from './HorizontalScrollContainer';
import { useLiveScores } from '../hooks/useLiveScores';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { GameweekState } from '../lib/gameweekState';

interface LeaderboardsSectionProps {
  lastGwRank: { rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null;
  fiveGwRank: { rank: number; total: number; isTied: boolean } | null;
  tenGwRank: { rank: number; total: number; isTied: boolean } | null;
  seasonRank: { rank: number; total: number; isTied: boolean } | null;
  userStreakData: { streak: number; last10GwScores: Array<{ gw: number; score: number | null }> } | null;
  latestGw: number | null;
  currentGw: number | null; // Current active gameweek
  effectiveGameState: GameweekState | null; // Game state from HomePage (already loaded from cache)
  lastGwGameState: GameweekState | null; // Game state for last GW (from HomePage cache)
  currentGwLiveScore: { score: number; totalFixtures: number } | null; // Pre-calculated live score for current GW
  lastGwLiveScore: { score: number; totalFixtures: number } | null; // Pre-calculated live score for last GW
}

export function LeaderboardsSection({
  lastGwRank,
  fiveGwRank,
  tenGwRank,
  seasonRank,
  userStreakData,
  latestGw,
  currentGw,
  effectiveGameState,
  lastGwGameState,
  currentGwLiveScore,
  lastGwLiveScore,
}: LeaderboardsSectionProps) {
  // Use game state and live scores passed from HomePage (already loaded from cache)
  const isCurrentGwLive = effectiveGameState === 'LIVE';
  const isLastGwLive = lastGwGameState === 'LIVE';
  
  // Subscribe to real-time updates (background refresh)
  const { liveScores: currentGwLiveScores } = useLiveScores(currentGw ?? undefined);
  const { liveScores: lastGwLiveScores } = useLiveScores(lastGwRank?.gw ?? undefined);
  const { user } = useAuth();
  
  // State for real-time updates (initialized from props)
  const [currentGwLiveScoreState, setCurrentGwLiveScoreState] = useState<{ score: number; totalFixtures: number } | null>(currentGwLiveScore);
  const [lastGwLiveScoreState, setLastGwLiveScoreState] = useState<{ score: number; totalFixtures: number } | null>(lastGwLiveScore);
  
  // Update state when props change (cache updates)
  useEffect(() => {
    if (currentGwLiveScore) {
      setCurrentGwLiveScoreState(currentGwLiveScore);
    }
  }, [currentGwLiveScore]);
  
  useEffect(() => {
    if (lastGwLiveScore) {
      setLastGwLiveScoreState(lastGwLiveScore);
    }
  }, [lastGwLiveScore]);
  
  // Update live scores from hook data (background refresh - only if hook has updates)
  useEffect(() => {
    if (!currentGw || !isCurrentGwLive || currentGwLiveScores.size === 0 || !user?.id) {
      return;
    }
    
    let alive = true;
    
    (async () => {
      const outcomes = new Map<number, "H" | "D" | "A">();
      let totalFixtures = 0;
      
      currentGwLiveScores.forEach((liveScore) => {
        if (liveScore.gw === currentGw) {
          totalFixtures++;
          if (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED') {
            const fixtureIndex = liveScore.fixture_index;
            if (liveScore.home_score !== null && liveScore.away_score !== null) {
              let outcome: "H" | "D" | "A";
              if (liveScore.home_score > liveScore.away_score) {
                outcome = "H";
              } else if (liveScore.home_score < liveScore.away_score) {
                outcome = "A";
              } else {
                outcome = "D";
              }
              outcomes.set(fixtureIndex, outcome);
            }
          }
        }
      });
      
      if (outcomes.size === 0) return;
      
      const { data: userPicks } = await supabase
        .from("app_picks")
        .select("fixture_index, pick")
        .eq("gw", currentGw)
        .eq("user_id", user.id);
      
      if (!alive || !userPicks) return;
      
      let score = 0;
      userPicks.forEach((pick) => {
        const outcome = outcomes.get(pick.fixture_index);
        if (outcome && pick.pick === outcome) {
          score++;
        }
      });
      
      const { data: fixtures } = await supabase
        .from("app_fixtures")
        .select("fixture_index")
        .eq("gw", currentGw);
      
      const total = fixtures?.length || totalFixtures;
      
      if (alive) {
        setCurrentGwLiveScoreState({ score, totalFixtures: total });
      }
    })();
    
    return () => { alive = false; };
  }, [currentGw, isCurrentGwLive, currentGwLiveScores, user?.id]);
  
  useEffect(() => {
    if (!lastGwRank?.gw || !isLastGwLive || lastGwLiveScores.size === 0 || !user?.id) {
      return;
    }
    
    let alive = true;
    
    (async () => {
      const outcomes = new Map<number, "H" | "D" | "A">();
      
      lastGwLiveScores.forEach((liveScore) => {
        if (liveScore.gw === lastGwRank.gw) {
          if (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED') {
            const fixtureIndex = liveScore.fixture_index;
            if (liveScore.home_score !== null && liveScore.away_score !== null) {
              let outcome: "H" | "D" | "A";
              if (liveScore.home_score > liveScore.away_score) {
                outcome = "H";
              } else if (liveScore.home_score < liveScore.away_score) {
                outcome = "A";
              } else {
                outcome = "D";
              }
              outcomes.set(fixtureIndex, outcome);
            }
          }
        }
      });
      
      if (outcomes.size === 0) return;
      
      const { data: userPicks } = await supabase
        .from("app_picks")
        .select("fixture_index, pick")
        .eq("gw", lastGwRank.gw)
        .eq("user_id", user.id);
      
      if (!alive || !userPicks) return;
      
      let score = 0;
      userPicks.forEach((pick) => {
        const outcome = outcomes.get(pick.fixture_index);
        if (outcome && pick.pick === outcome) {
          score++;
        }
      });
      
      if (alive) {
        setLastGwLiveScoreState({ score, totalFixtures: lastGwRank.totalFixtures });
      }
    })();
    
    return () => { alive = false; };
  }, [lastGwRank?.gw, isLastGwLive, lastGwLiveScores, user?.id, lastGwRank?.totalFixtures]);

  return (
    <Section 
      title="Leaderboards" 
      className="mt-6"
      infoTitle="Leaderboards"
      infoDescription={`The leaderboards are where all TOTL players are ranked. Your position is based on OCP (Overall Correct Predictions).

Joined late? No stress — after 5 and 10 weeks you'll show up in the Form leaderboards.

How To Play →`}
    >
      {/* Mobile: Horizontal scroll */}
      <div className="lg:hidden">
        <HorizontalScrollContainer>
          <LeaderboardCard
            title="Last GW"
            linkTo="/global?tab=lastgw"
            rank={lastGwRank?.rank ?? null}
            total={lastGwRank?.total ?? null}
            score={lastGwLiveScoreState?.score ?? lastGwLiveScore?.score ?? lastGwRank?.score}
            gw={lastGwRank?.gw}
            totalFixtures={lastGwRank?.totalFixtures}
            variant="lastGw"
            isActiveLive={isLastGwLive && (lastGwLiveScoreState !== null || lastGwLiveScore !== null)}
          />
          <LeaderboardCard
            title="5-WEEK FORM"
            badgeSrc="/assets/5-week-form-badge.png"
            badgeAlt="5-Week Form Badge"
            linkTo="/global?tab=form5"
            rank={fiveGwRank?.rank ?? null}
            total={fiveGwRank?.total ?? null}
          />
          <LeaderboardCard
            title="10-WEEK FORM"
            badgeSrc="/assets/10-week-form-badge.png"
            badgeAlt="10-Week Form Badge"
            linkTo="/global?tab=form10"
            rank={tenGwRank?.rank ?? null}
            total={tenGwRank?.total ?? null}
          />
          <LeaderboardCard
            title="SEASON RANK"
            badgeSrc="/assets/season-rank-badge.png"
            badgeAlt="Season Rank Badge"
            linkTo="/global?tab=overall"
            rank={seasonRank?.rank ?? null}
            total={seasonRank?.total ?? null}
            isActiveLive={isCurrentGwLive && (currentGwLiveScoreState !== null || currentGwLiveScore !== null)}
          />
          {userStreakData && (
            <StreakCard
              streak={userStreakData.streak}
              last10GwScores={userStreakData.last10GwScores}
              latestGw={latestGw ?? 1}
            />
          )}
        </HorizontalScrollContainer>
      </div>

      {/* Desktop: Single row with flex */}
      <div className="hidden lg:flex lg:flex-row lg:gap-2">
        <LeaderboardCard
          title="Last GW"
          linkTo="/global?tab=lastgw"
          rank={lastGwRank?.rank ?? null}
          total={lastGwRank?.total ?? null}
            score={lastGwLiveScoreState?.score ?? lastGwLiveScore?.score ?? lastGwRank?.score}
            gw={lastGwRank?.gw}
            totalFixtures={lastGwRank?.totalFixtures}
            variant="lastGw"
            isActiveLive={isLastGwLive && (lastGwLiveScoreState !== null || lastGwLiveScore !== null)}
        />
        <LeaderboardCard
          title="5-WEEK FORM"
          badgeSrc="/assets/5-week-form-badge.png"
          badgeAlt="5-Week Form Badge"
          linkTo="/global?tab=form5"
          rank={fiveGwRank?.rank ?? null}
          total={fiveGwRank?.total ?? null}
        />
        <LeaderboardCard
          title="10-WEEK FORM"
          badgeSrc="/assets/10-week-form-badge.png"
          badgeAlt="10-Week Form Badge"
          linkTo="/global?tab=form10"
          rank={tenGwRank?.rank ?? null}
          total={tenGwRank?.total ?? null}
        />
        <LeaderboardCard
          title="SEASON RANK"
          badgeSrc="/assets/season-rank-badge.png"
          badgeAlt="Season Rank Badge"
          linkTo="/global?tab=overall"
          rank={seasonRank?.rank ?? null}
          total={seasonRank?.total ?? null}
            isActiveLive={isCurrentGwLive && (currentGwLiveScoreState !== null || currentGwLiveScore !== null)}
        />
        {userStreakData && (
          <StreakCard
            streak={userStreakData.streak}
            last10GwScores={userStreakData.last10GwScores}
            latestGw={latestGw ?? 1}
          />
        )}
      </div>
    </Section>
  );
}

