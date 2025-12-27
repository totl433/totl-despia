import { LeaderboardCard } from './LeaderboardCard';
import { StreakCard } from './StreakCard';
import Section from './Section';
import { HorizontalScrollContainer } from './HorizontalScrollContainer';
import { useGameweekState } from '../hooks/useGameweekState';

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
          score={lastGwRank?.score}
          gw={lastGwRank?.gw}
          totalFixtures={lastGwRank?.totalFixtures}
          variant="lastGw"
          isLive={isLastGwLive}
        />
        <LeaderboardCard
          title="5-WEEK FORM"
          badgeSrc="/assets/5-week-form-badge.png"
          badgeAlt="5-Week Form Badge"
          linkTo="/global?tab=form5"
          rank={fiveGwRank?.rank ?? null}
          total={fiveGwRank?.total ?? null}
          isLive={isCurrentGwLive}
        />
        <LeaderboardCard
          title="10-WEEK FORM"
          badgeSrc="/assets/10-week-form-badge.png"
          badgeAlt="10-Week Form Badge"
          linkTo="/global?tab=form10"
          rank={tenGwRank?.rank ?? null}
          total={tenGwRank?.total ?? null}
          isLive={isCurrentGwLive}
        />
        <LeaderboardCard
          title="SEASON RANK"
          badgeSrc="/assets/season-rank-badge.png"
          badgeAlt="Season Rank Badge"
          linkTo="/global?tab=overall"
          rank={seasonRank?.rank ?? null}
          total={seasonRank?.total ?? null}
          isLive={isCurrentGwLive}
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

