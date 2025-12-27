import { LeaderboardCard } from './LeaderboardCard';
import { StreakCard } from './StreakCard';
import Section from './Section';
import { HorizontalScrollContainer } from './HorizontalScrollContainer';
import { useGameweekState } from '../hooks/useGameweekState';
import { useLiveScores } from '../hooks/useLiveScores';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface LeaderboardsSectionProps {
  lastGwRank: { rank: number; total: number; score: number; gw: number; totalFixtures: number; isTied: boolean } | null;
  fiveGwRank: { rank: number; total: number; isTied: boolean } | null;
  tenGwRank: { rank: number; total: number; isTied: boolean } | null;
  seasonRank: { rank: number; total: number; isTied: boolean } | null;
  userStreakData: { streak: number; last10GwScores: Array<{ gw: number; score: number | null }> } | null;
  latestGw: number | null;
  currentGw: number | null; // Current active gameweek
}

export function LeaderboardsSection({
  lastGwRank,
  fiveGwRank,
  tenGwRank,
  seasonRank,
  userStreakData,
  latestGw,
  currentGw
}: LeaderboardsSectionProps) {
  // Check if the current GW is LIVE (first game kicked off, last game hasn't ended)
  // All leaderboards (form, season) include the current GW, so if current GW is LIVE, all are live
  const { state: currentGwState } = useGameweekState(currentGw ?? null);
  const isCurrentGwLive = currentGwState === 'LIVE';
  
  // Check if the Last GW is currently LIVE (for the Last GW card specifically)
  const { state: lastGwState } = useGameweekState(lastGwRank?.gw ?? null);
  const isLastGwLive = lastGwState === 'LIVE';
  
  // Check for active live scores (ACTIVE LIVE = live scores are being used to calculate points)
  const { liveScores: currentGwLiveScores } = useLiveScores(currentGw ?? undefined);
  const { liveScores: lastGwLiveScores } = useLiveScores(lastGwRank?.gw ?? undefined);
  const { user } = useAuth();
  
  // Calculate live scores for current GW
  const [currentGwLiveScore, setCurrentGwLiveScore] = useState<{ score: number; totalFixtures: number } | null>(null);
  const [lastGwLiveScore, setLastGwLiveScore] = useState<{ score: number; totalFixtures: number } | null>(null);
  
  // Calculate live score for current GW
  useEffect(() => {
    if (!currentGw || !isCurrentGwLive || currentGwLiveScores.size === 0 || !user?.id) {
      setCurrentGwLiveScore(null);
      return;
    }
    
    let alive = true;
    
    (async () => {
      // Convert live scores to outcomes (derive H/D/A from current scores during games)
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
      
      if (outcomes.size === 0) {
        if (alive) setCurrentGwLiveScore(null);
        return;
      }
      
      // Get user's picks for current GW
      const { data: userPicks } = await supabase
        .from("app_picks")
        .select("fixture_index, pick")
        .eq("gw", currentGw)
        .eq("user_id", user.id);
      
      if (!alive || !userPicks) return;
      
      // Calculate score
      let score = 0;
      userPicks.forEach((pick) => {
        const outcome = outcomes.get(pick.fixture_index);
        if (outcome && pick.pick === outcome) {
          score++;
        }
      });
      
      // Get total fixtures count from app_fixtures
      const { data: fixtures } = await supabase
        .from("app_fixtures")
        .select("fixture_index")
        .eq("gw", currentGw);
      
      const total = fixtures?.length || totalFixtures;
      
      if (alive) {
        setCurrentGwLiveScore({ score, totalFixtures: total });
      }
    })();
    
    return () => { alive = false; };
  }, [currentGw, isCurrentGwLive, currentGwLiveScores, user?.id]);
  
  // Calculate live score for last GW
  useEffect(() => {
    if (!lastGwRank?.gw || !isLastGwLive || lastGwLiveScores.size === 0 || !user?.id) {
      setLastGwLiveScore(null);
      return;
    }
    
    let alive = true;
    
    (async () => {
      // Convert live scores to outcomes
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
      
      if (outcomes.size === 0) {
        if (alive) setLastGwLiveScore(null);
        return;
      }
      
      // Get user's picks for last GW
      const { data: userPicks } = await supabase
        .from("app_picks")
        .select("fixture_index, pick")
        .eq("gw", lastGwRank.gw)
        .eq("user_id", user.id);
      
      if (!alive || !userPicks) return;
      
      // Calculate score
      let score = 0;
      userPicks.forEach((pick) => {
        const outcome = outcomes.get(pick.fixture_index);
        if (outcome && pick.pick === outcome) {
          score++;
        }
      });
      
      if (alive) {
        setLastGwLiveScore({ score, totalFixtures: lastGwRank.totalFixtures });
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
      <HorizontalScrollContainer>
        <LeaderboardCard
          title="Last GW"
          linkTo="/global?tab=lastgw"
          rank={lastGwRank?.rank ?? null}
          total={lastGwRank?.total ?? null}
          score={lastGwLiveScore?.score ?? lastGwRank?.score}
          gw={lastGwRank?.gw}
          totalFixtures={lastGwRank?.totalFixtures}
          variant="lastGw"
          isActiveLive={isLastGwLive && lastGwLiveScore !== null}
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
          isActiveLive={isCurrentGwLive && currentGwLiveScore !== null}
        />
        {userStreakData && (
          <StreakCard
            streak={userStreakData.streak}
            last10GwScores={userStreakData.last10GwScores}
            latestGw={latestGw ?? 1}
          />
        )}
      </HorizontalScrollContainer>
    </Section>
  );
}

