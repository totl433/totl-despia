import { useMemo } from 'react';
import type { ReactNode } from 'react';
import DateHeader from './DateHeader';
import { FixtureCard, type Fixture as FixtureCardFixture, type LiveScore as FixtureCardLiveScore } from './FixtureCard';

interface DateGroupedFixturesProps {
  fixtureCards: Array<{ fixture: FixtureCardFixture; liveScore: FixtureCardLiveScore | null; pick: "H" | "D" | "A" | undefined }>;
  isTestApi?: boolean;
  showPickButtons?: boolean;
  headerRightElement?: ReactNode;
}

export default function DateGroupedFixtures({
  fixtureCards,
  isTestApi = false,
  showPickButtons = true,
  headerRightElement,
}: DateGroupedFixturesProps) {
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, typeof fixtureCards>();
    
    fixtureCards.forEach(({ fixture, liveScore, pick }) => {
      const dateKey = fixture.kickoff_time
        ? new Date(fixture.kickoff_time).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })
        : 'No date';
      
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push({ fixture, liveScore, pick });
    });
    
    // Sort dates chronologically
    const sortedDates = Array.from(groups.keys()).sort((a, b) => {
      if (a === 'No date') return 1;
      if (b === 'No date') return -1;
      const dateA = new Date(groups.get(a)![0].fixture.kickoff_time!);
      const dateB = new Date(groups.get(b)![0].fixture.kickoff_time!);
      return dateA.getTime() - dateB.getTime();
    });
    
    return sortedDates.map(dateKey => ({
      date: dateKey,
      cards: groups.get(dateKey)!,
    }));
  }, [fixtureCards]);

  if (groupedByDate.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {groupedByDate.map(({ date, cards }, dateIdx) => (
        <div key={date} className={dateIdx > 0 ? 'mt-4' : ''}>
          <DateHeader date={date} rightElement={dateIdx === 0 ? headerRightElement : undefined} />
          <div className="flex flex-col rounded-xl border bg-white overflow-hidden shadow-sm">
            {cards.map(({ fixture, liveScore, pick }, cardIdx) => (
              <div key={fixture.id} className={cardIdx < cards.length - 1 ? 'relative' : ''}>
                {cardIdx < cards.length - 1 && (
                  <div className="absolute bottom-0 left-4 right-4 h-px bg-slate-200 z-10" />
                )}
                <FixtureCard
                  fixture={fixture}
                  pick={pick}
                  liveScore={liveScore}
                  isTestApi={isTestApi}
                  showPickButtons={showPickButtons}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

