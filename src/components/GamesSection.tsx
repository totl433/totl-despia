import { useMemo } from 'react';
import type { ReactNode } from 'react';
import Section from './Section';
import { type Fixture as FixtureCardFixture, type LiveScore as FixtureCardLiveScore } from './FixtureCard';
import LiveGamesToggle from './LiveGamesToggle';
import DateGroupedFixtures from './DateGroupedFixtures';

interface GamesSectionProps {
  isInApiTestLeague: boolean;
  fixtures: Array<{ id: string; gw: number; fixture_index: number; test_gw?: number | null; [key: string]: any }>;
  fixtureCards: Array<{ fixture: FixtureCardFixture; liveScore: FixtureCardLiveScore | null; pick: "H" | "D" | "A" | undefined }>;
  hasLiveGames: boolean;
  showLiveOnly: boolean;
  onToggleLiveOnly: (value: boolean) => void;
  scoreComponent: ReactNode | null;
  fixturesLoading: boolean;
  hasCheckedCache: boolean;
  currentGw: number | null;
}

export function GamesSection({
  isInApiTestLeague,
  fixtures,
  fixtureCards,
  hasLiveGames,
  showLiveOnly,
  onToggleLiveOnly,
  scoreComponent,
  fixturesLoading,
  hasCheckedCache,
  currentGw
}: GamesSectionProps) {
  // Calculate title with GW number: "Gameweek (XX)" format
  const title = useMemo(() => {
    if (fixtures.length === 0) return "Games";
    
    // Always use the GW number from fixtures or currentGw, no test week distinction
    const gw = currentGw ?? fixtures[0]?.gw ?? 1;
    return `Gameweek ${gw}`;
  }, [fixtures, currentGw]);

  return (
    <Section 
      title={title}
      className="mt-8"
      headerRight={scoreComponent}
      showInfoIcon={false}
    >
      {(!hasCheckedCache || fixturesLoading) ? (
        <div className="p-4 text-slate-500">Loading fixtures...</div>
      ) : fixtures.length === 0 ? (
        <div className="p-4 text-slate-500">No fixtures yet.</div>
      ) : fixtures.length > 0 ? (
        <DateGroupedFixtures
          fixtureCards={fixtureCards}
          isTestApi={isInApiTestLeague}
          showPickButtons={true}
          headerRightElement={hasLiveGames ? (
            <LiveGamesToggle value={showLiveOnly} onChange={onToggleLiveOnly} />
          ) : undefined}
        />
      ) : null}
    </Section>
  );
}

