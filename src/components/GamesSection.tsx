import { ReactNode, useMemo } from 'react';
import Section from './Section';
import { FixtureCard, type Fixture as FixtureCardFixture, type LiveScore as FixtureCardLiveScore } from './FixtureCard';
import LiveGamesToggle from './LiveGamesToggle';

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
  // Calculate subtitle: "Game Week XX" format
  const subtitle = useMemo(() => {
    if (fixtures.length === 0) return undefined;
    
    // Always use the GW number from fixtures or currentGw, no test week distinction
    const gw = currentGw ?? fixtures[0]?.gw ?? 1;
    return `Game Week ${gw}`;
  }, [fixtures, currentGw]);

  return (
    <Section 
      title="Games"
      subtitle={subtitle}
      className="mt-6"
      headerRight={
        <div className="flex items-center gap-3">
          {hasLiveGames && (
            <LiveGamesToggle value={showLiveOnly} onChange={onToggleLiveOnly} />
          )}
          {scoreComponent}
        </div>
      }
    >
      {(!hasCheckedCache || fixturesLoading) ? (
        <div className="p-4 text-slate-500">Loading fixtures...</div>
      ) : fixtures.length === 0 ? (
        <div className="p-4 text-slate-500">No fixtures yet.</div>
      ) : fixtures.length > 0 ? (
        <div className="flex flex-col rounded-xl border bg-white overflow-hidden shadow-sm">
          {fixtureCards.map(({ fixture, liveScore, pick }, index) => (
            <div key={fixture.id} className={index < fixtureCards.length - 1 ? 'relative' : ''}>
              {index < fixtureCards.length - 1 && (
                <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-200 z-10" />
              )}
              <FixtureCard
                fixture={fixture}
                pick={pick}
                liveScore={liveScore}
                isTestApi={isInApiTestLeague}
                showPickButtons={true}
              />
            </div>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

