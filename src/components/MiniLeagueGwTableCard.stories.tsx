import type { Meta, StoryObj } from '@storybook/react';
import MiniLeagueGwTableCard from './MiniLeagueGwTableCard';
import type { Fixture } from './FixtureCard';

const meta: Meta<typeof MiniLeagueGwTableCard> = {
  title: 'Components/MiniLeagueGwTableCard',
  component: MiniLeagueGwTableCard,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof MiniLeagueGwTableCard>;

// Use valid UUID format for member IDs
const generateUUID = (seed: number) => {
  const part1 = seed.toString(16).padStart(8, '0');
  const part2 = (seed * 2).toString(16).padStart(4, '0');
  const part3 = '4' + (seed * 3).toString(16).padStart(3, '0');
  const part4 = ['8', '9', 'a', 'b'][seed % 4] + (seed * 4).toString(16).padStart(3, '0');
  const part5 = (seed * 5).toString(16).padStart(12, '0');
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
};

// Mock data helper
const createMockData = (memberIds: string[], gw: number, isLive: boolean = false) => {
  const fixtures: Fixture[] = [
    { id: '1', gw, fixture_index: 0, home_name: 'Arsenal', away_name: 'Liverpool', home_team: 'Arsenal', away_team: 'Liverpool', home_code: 'ARS', away_code: 'LIV', kickoff_time: '2025-01-18T15:00:00Z', api_match_id: 1001 },
    { id: '2', gw, fixture_index: 1, home_name: 'Chelsea', away_name: 'Manchester City', home_team: 'Chelsea', away_team: 'Manchester City', home_code: 'CHE', away_code: 'MCI', kickoff_time: '2025-01-18T15:00:00Z', api_match_id: 1002 },
    { id: '3', gw, fixture_index: 2, home_name: 'Tottenham', away_name: 'Newcastle', home_team: 'Tottenham', away_team: 'Newcastle', home_code: 'TOT', away_code: 'NEW', kickoff_time: '2025-01-18T15:00:00Z', api_match_id: 1003 },
    { id: '4', gw, fixture_index: 3, home_name: 'Brighton', away_name: 'Fulham', home_team: 'Brighton', away_team: 'Fulham', home_code: 'BHA', away_code: 'FUL', kickoff_time: '2025-01-18T15:00:00Z', api_match_id: 1004 },
    { id: '5', gw, fixture_index: 4, home_name: 'Everton', away_name: 'Aston Villa', home_team: 'Everton', away_team: 'Aston Villa', home_code: 'EVE', away_code: 'AVL', kickoff_time: '2025-01-18T15:00:00Z', api_match_id: 1005 },
  ];

  const results = isLive
    ? [
        { gw, fixture_index: 0, result: 'H' as const },
        { gw, fixture_index: 1, result: 'D' as const },
        { gw, fixture_index: 2, result: 'A' as const },
      ]
    : [
        { gw, fixture_index: 0, result: 'H' as const },
        { gw, fixture_index: 1, result: 'D' as const },
        { gw, fixture_index: 2, result: 'A' as const },
        { gw, fixture_index: 3, result: 'H' as const },
        { gw, fixture_index: 4, result: 'D' as const },
      ];

  const basePicks = [
    { user_id: memberIds[0], gw, fixture_index: 0, pick: 'H' as const },
    { user_id: memberIds[0], gw, fixture_index: 1, pick: 'D' as const },
    { user_id: memberIds[0], gw, fixture_index: 2, pick: 'A' as const },
    { user_id: memberIds[0], gw, fixture_index: 3, pick: 'H' as const },
    { user_id: memberIds[0], gw, fixture_index: 4, pick: 'D' as const },
    { user_id: memberIds[1], gw, fixture_index: 0, pick: 'H' as const },
    { user_id: memberIds[1], gw, fixture_index: 1, pick: 'D' as const },
    { user_id: memberIds[1], gw, fixture_index: 2, pick: 'H' as const },
    { user_id: memberIds[1], gw, fixture_index: 3, pick: 'H' as const },
    { user_id: memberIds[1], gw, fixture_index: 4, pick: 'A' as const },
    { user_id: memberIds[2], gw, fixture_index: 0, pick: 'A' as const },
    { user_id: memberIds[2], gw, fixture_index: 1, pick: 'D' as const },
    { user_id: memberIds[2], gw, fixture_index: 2, pick: 'H' as const },
    { user_id: memberIds[2], gw, fixture_index: 3, pick: 'A' as const },
    { user_id: memberIds[2], gw, fixture_index: 4, pick: 'H' as const },
  ];

  const picks = isLive
    ? basePicks.filter(p => p.fixture_index < 3)
    : basePicks;

  // Calculate rows from picks and results
  const outcomes = new Map<number, "H" | "D" | "A">();
  results.forEach(r => {
    if (r.result) outcomes.set(r.fixture_index, r.result);
  });
  
  const rows = memberIds.map(mid => ({
    user_id: mid,
    name: `User ${mid.slice(0, 8)}`,
    score: 0,
    unicorns: 0,
  }));
  
  const picksByFixture = new Map<number, Array<{ user_id: string; pick: "H" | "D" | "A" }>>();
  picks.forEach(p => {
    const arr = picksByFixture.get(p.fixture_index) ?? [];
    arr.push({ user_id: p.user_id, pick: p.pick });
    picksByFixture.set(p.fixture_index, arr);
  });
  
  outcomes.forEach((outcome, idx) => {
    const thesePicks = picksByFixture.get(idx) ?? [];
    const correctIds = thesePicks.filter(p => p.pick === outcome).map(p => p.user_id);
    correctIds.forEach(uid => {
      const row = rows.find(r => r.user_id === uid);
      if (row) row.score += 1;
    });
    if (correctIds.length === 1 && memberIds.length >= 3) {
      const row = rows.find(r => r.user_id === correctIds[0]);
      if (row) row.unicorns += 1;
    }
  });
  
  rows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns || a.name.localeCompare(b.name));

  return { fixtures, picks, results, displayGw: gw, isLive, rows };
};

export const Default: Story = {
  args: {
    leagueId: '00000000-0000-0000-0000-000000000001',
    leagueCode: 'ABCDE',
    leagueName: 'Test Mini League',
    members: [
      { id: generateUUID(1), name: 'Alice' },
      { id: generateUUID(2), name: 'Bob' },
      { id: generateUUID(3), name: 'Charlie' },
    ],
    rows: [],
    currentUserId: generateUUID(1),
    currentGw: 18,
    avatar: null,
    sharedFixtures: [],
    sharedGwResults: {},
    mockData: createMockData([generateUUID(1), generateUUID(2), generateUUID(3)], 18),
  },
};

export const WithMoreMembers: Story = {
  args: {
    leagueId: '00000000-0000-0000-0000-000000000002',
    leagueCode: 'FGHIJ',
    leagueName: 'Big Mini League',
    members: [
      { id: generateUUID(1), name: 'Alice' },
      { id: generateUUID(2), name: 'Bob' },
      { id: generateUUID(3), name: 'Charlie' },
      { id: generateUUID(4), name: 'David' },
      { id: generateUUID(5), name: 'Eve' },
    ],
    rows: [],
    currentUserId: generateUUID(1),
    currentGw: 18,
    maxMemberCount: 5,
    avatar: null,
    sharedFixtures: [],
    sharedGwResults: {},
    mockData: createMockData([
      generateUUID(1), generateUUID(2), generateUUID(3), generateUUID(4), generateUUID(5),
    ], 18),
  },
};

export const LiveGameweek: Story = {
  args: {
    leagueId: '00000000-0000-0000-0000-000000000003',
    leagueCode: 'KLMNO',
    leagueName: 'Live Mini League',
    members: [
      { id: generateUUID(1), name: 'Alice' },
      { id: generateUUID(2), name: 'Bob' },
      { id: generateUUID(3), name: 'Charlie' },
      { id: generateUUID(4), name: 'David' },
    ],
    rows: [],
    currentUserId: generateUUID(1),
    currentGw: 18,
    avatar: null,
    sharedFixtures: [],
    sharedGwResults: {},
    mockData: createMockData([generateUUID(1), generateUUID(2), generateUUID(3), generateUUID(4)], 18, true),
  },
};

export const HorizontalScroll: Story = {
  render: () => {
    const members1 = [
      { id: generateUUID(1), name: 'Alice' },
      { id: generateUUID(2), name: 'Bob' },
      { id: generateUUID(3), name: 'Charlie' },
    ];
    const members2 = [
      { id: generateUUID(4), name: 'David' },
      { id: generateUUID(5), name: 'Eve' },
      { id: generateUUID(6), name: 'Frank' },
      { id: generateUUID(7), name: 'Grace' },
      { id: generateUUID(8), name: 'Henry' },
    ];
    const members3 = [
      { id: generateUUID(9), name: 'Ivy' },
    ];

    // Calculate max member count
    const maxMemberCount = Math.max(members1.length, members2.length, members3.length);

    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        <MiniLeagueGwTableCard
          leagueId="1"
          leagueCode="LEAG1"
          leagueName="League One (3 members)"
          members={members1}
          rows={[]}
          currentUserId={generateUUID(1)}
          currentGw={18}
          maxMemberCount={maxMemberCount}
          avatar={null}
          sharedFixtures={[]}
          sharedGwResults={{}}
          mockData={createMockData([generateUUID(1), generateUUID(2), generateUUID(3)], 18)}
        />
        <MiniLeagueGwTableCard
          leagueId="2"
          leagueCode="LEAG2"
          leagueName="League Two (8 members)"
          members={members2}
          rows={[]}
          currentUserId={generateUUID(4)}
          currentGw={18}
          maxMemberCount={maxMemberCount}
          avatar={null}
          sharedFixtures={[]}
          sharedGwResults={{}}
          mockData={createMockData([
            generateUUID(4), generateUUID(5), generateUUID(6), generateUUID(7), generateUUID(8)
          ], 18)}
        />
        <MiniLeagueGwTableCard
          leagueId="3"
          leagueCode="LEAG3"
          leagueName="League Three (1 member)"
          members={members3}
          rows={[]}
          currentUserId={generateUUID(9)}
          currentGw={18}
          maxMemberCount={maxMemberCount}
          avatar={null}
          sharedFixtures={[]}
          sharedGwResults={{}}
          mockData={createMockData([generateUUID(9)], 18)}
        />
      </div>
    );
  },
};

