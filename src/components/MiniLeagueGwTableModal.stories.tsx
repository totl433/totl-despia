import type { Meta, StoryObj } from '@storybook/react';
import MiniLeagueGwTableModal from './MiniLeagueGwTableModal';

const meta: Meta<typeof MiniLeagueGwTableModal> = {
  title: 'Components/MiniLeagueGwTableModal',
  component: MiniLeagueGwTableModal,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof MiniLeagueGwTableModal>;

// Use valid UUID format for member IDs
const generateUUID = (seed: number) => {
  // Generate a deterministic UUID v4-like string for Storybook
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (32 hex digits total)
  const part1 = seed.toString(16).padStart(8, '0');
  const part2 = (seed * 2).toString(16).padStart(4, '0');
  const part3 = '4' + (seed * 3).toString(16).padStart(3, '0');
  const part4 = ['8', '9', 'a', 'b'][seed % 4] + (seed * 4).toString(16).padStart(3, '0');
  const part5 = (seed * 5).toString(16).padStart(12, '0');
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
};

// Mock data for Storybook
const createMockData = (memberIds: string[], gw: number, isLive: boolean = false) => {
  const fixtures = [
    { id: '1', gw, fixture_index: 0, home_name: 'Arsenal', away_name: 'Liverpool', home_team: 'Arsenal', away_team: 'Liverpool', home_code: 'ARS', away_code: 'LIV', kickoff_time: '2025-01-18T15:00:00Z', api_match_id: 1001 },
    { id: '2', gw, fixture_index: 1, home_name: 'Chelsea', away_name: 'Manchester City', home_team: 'Chelsea', away_team: 'Manchester City', home_code: 'CHE', away_code: 'MCI', kickoff_time: '2025-01-18T15:00:00Z', api_match_id: 1002 },
    { id: '3', gw, fixture_index: 2, home_name: 'Tottenham', away_name: 'Newcastle', home_team: 'Tottenham', away_team: 'Newcastle', home_code: 'TOT', away_code: 'NEW', kickoff_time: '2025-01-18T15:00:00Z', api_match_id: 1003 },
    { id: '4', gw, fixture_index: 3, home_name: 'Brighton', away_name: 'Fulham', home_team: 'Brighton', away_team: 'Fulham', home_code: 'BHA', away_code: 'FUL', kickoff_time: '2025-01-18T15:00:00Z', api_match_id: 1004 },
    { id: '5', gw, fixture_index: 4, home_name: 'Everton', away_name: 'Aston Villa', home_team: 'Everton', away_team: 'Aston Villa', home_code: 'EVE', away_code: 'AVL', kickoff_time: '2025-01-18T15:00:00Z', api_match_id: 1005 },
  ];

  // For live GWs, only some fixtures have results (not all finished)
  // For completed GWs, all fixtures have results
  const results = isLive
    ? [
        // Only first 3 fixtures have results (live state)
        { gw, fixture_index: 0, result: 'H' as const },
        { gw, fixture_index: 1, result: 'D' as const },
        { gw, fixture_index: 2, result: 'A' as const },
        // Fixtures 3 and 4 don't have results yet (still playing)
      ]
    : [
        // All fixtures have results (completed state)
        { gw, fixture_index: 0, result: 'H' as const },
        { gw, fixture_index: 1, result: 'D' as const },
        { gw, fixture_index: 2, result: 'A' as const },
        { gw, fixture_index: 3, result: 'H' as const },
        { gw, fixture_index: 4, result: 'D' as const },
      ];

  // Picks: Alice gets 4 correct (1 unicorn), Bob gets 3, Charlie gets 2
  // Fixture 2 (A) - only Alice picked it correctly = unicorn for Alice
  // For live GWs, only include picks for fixtures that have results
  const basePicks = [
    // Alice's picks
    { user_id: memberIds[0], gw, fixture_index: 0, pick: 'H' as const },
    { user_id: memberIds[0], gw, fixture_index: 1, pick: 'D' as const },
    { user_id: memberIds[0], gw, fixture_index: 2, pick: 'A' as const }, // Only Alice correct = unicorn
    { user_id: memberIds[0], gw, fixture_index: 3, pick: 'H' as const },
    { user_id: memberIds[0], gw, fixture_index: 4, pick: 'D' as const },
    // Bob's picks
    { user_id: memberIds[1], gw, fixture_index: 0, pick: 'H' as const },
    { user_id: memberIds[1], gw, fixture_index: 1, pick: 'D' as const },
    { user_id: memberIds[1], gw, fixture_index: 2, pick: 'H' as const }, // wrong
    { user_id: memberIds[1], gw, fixture_index: 3, pick: 'H' as const },
    { user_id: memberIds[1], gw, fixture_index: 4, pick: 'A' as const }, // wrong
    // Charlie's picks
    { user_id: memberIds[2], gw, fixture_index: 0, pick: 'A' as const }, // wrong
    { user_id: memberIds[2], gw, fixture_index: 1, pick: 'D' as const },
    { user_id: memberIds[2], gw, fixture_index: 2, pick: 'H' as const }, // wrong
    { user_id: memberIds[2], gw, fixture_index: 3, pick: 'A' as const }, // wrong
    { user_id: memberIds[2], gw, fixture_index: 4, pick: 'H' as const }, // wrong
  ];

  // Add picks for additional members if provided
  const allPicks = [...basePicks];
  if (memberIds.length > 3) {
    for (let i = 3; i < memberIds.length; i++) {
      // Each additional member gets some picks
      allPicks.push(
        { user_id: memberIds[i], gw, fixture_index: 0, pick: 'H' as const },
        { user_id: memberIds[i], gw, fixture_index: 1, pick: 'D' as const },
        { user_id: memberIds[i], gw, fixture_index: 2, pick: 'A' as const },
        { user_id: memberIds[i], gw, fixture_index: 3, pick: 'H' as const },
        { user_id: memberIds[i], gw, fixture_index: 4, pick: 'D' as const },
      );
    }
  }

  // For live GWs, filter picks to only include fixtures with results
  const picks = isLive
    ? allPicks.filter(p => p.fixture_index < 3) // Only first 3 fixtures have results
    : allPicks;

  return { fixtures, picks, results, displayGw: gw, isLive };
};

export const Default: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    leagueId: '00000000-0000-0000-0000-000000000001',
    leagueName: 'Test Mini League',
    members: [
      { id: generateUUID(1), name: 'Alice' },
      { id: generateUUID(2), name: 'Bob' },
      { id: generateUUID(3), name: 'Charlie' },
    ],
    currentUserId: generateUUID(1),
    currentGw: 18,
    mockData: createMockData([generateUUID(1), generateUUID(2), generateUUID(3)], 18),
  },
};

export const WithMoreMembers: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    leagueId: '00000000-0000-0000-0000-000000000002',
    leagueName: 'Big Mini League',
    members: [
      { id: generateUUID(1), name: 'Alice' },
      { id: generateUUID(2), name: 'Bob' },
      { id: generateUUID(3), name: 'Charlie' },
      { id: generateUUID(4), name: 'David' },
      { id: generateUUID(5), name: 'Eve' },
      { id: generateUUID(6), name: 'Frank' },
      { id: generateUUID(7), name: 'Grace' },
      { id: generateUUID(8), name: 'Henry' },
    ],
    currentUserId: generateUUID(1),
    currentGw: 18,
    mockData: createMockData([
      generateUUID(1), generateUUID(2), generateUUID(3), generateUUID(4),
      generateUUID(5), generateUUID(6), generateUUID(7), generateUUID(8),
    ], 18),
  },
};

export const LiveGameweek: Story = {
  args: {
    isOpen: true,
    onClose: () => {},
    leagueId: '00000000-0000-0000-0000-000000000003',
    leagueName: 'Live Mini League',
    members: [
      { id: generateUUID(1), name: 'Alice' },
      { id: generateUUID(2), name: 'Bob' },
      { id: generateUUID(3), name: 'Charlie' },
      { id: generateUUID(4), name: 'David' },
    ],
    currentUserId: generateUUID(1),
    currentGw: 18,
    mockData: createMockData([generateUUID(1), generateUUID(2), generateUUID(3), generateUUID(4)], 18, true), // isLive = true
  },
};

