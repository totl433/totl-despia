import type { Meta, StoryObj } from '@storybook/react';
import GameweekFixturesCard from './GameweekFixturesCard';
import type { Fixture, LiveScore } from './FixtureCard';

const meta: Meta<typeof GameweekFixturesCard> = {
  title: 'Components/GameweekFixturesCard',
  component: GameweekFixturesCard,
  parameters: {
    layout: 'padded',
    viewport: {
      defaultViewport: 'desktop',
    },
  },
};

export default meta;
type Story = StoryObj<typeof GameweekFixturesCard>;

// Sample fixtures for GW14
const sampleFixtures: Fixture[] = [
  {
    id: '1',
    gw: 14,
    fixture_index: 0,
    home_code: 'ARS',
    away_code: 'CHE',
    home_team: 'Arsenal',
    away_team: 'Chelsea',
    home_name: 'Arsenal',
    away_name: 'Chelsea',
    kickoff_time: '2024-12-15T12:30:00Z',
  },
  {
    id: '2',
    gw: 14,
    fixture_index: 1,
    home_code: 'MCI',
    away_code: 'LIV',
    home_team: 'Man City',
    away_team: 'Liverpool',
    home_name: 'Man City',
    away_name: 'Liverpool',
    kickoff_time: '2024-12-15T15:00:00Z',
  },
  {
    id: '3',
    gw: 14,
    fixture_index: 2,
    home_code: 'MUN',
    away_code: 'TOT',
    home_team: 'Man United',
    away_team: 'Spurs',
    home_name: 'Man United',
    away_name: 'Spurs',
    kickoff_time: '2024-12-15T17:30:00Z',
  },
  {
    id: '4',
    gw: 14,
    fixture_index: 3,
    home_code: 'NEW',
    away_code: 'BHA',
    home_team: 'Newcastle',
    away_team: 'Brighton',
    home_name: 'Newcastle',
    away_name: 'Brighton',
    kickoff_time: '2024-12-16T15:00:00Z',
  },
  {
    id: '5',
    gw: 14,
    fixture_index: 4,
    home_code: 'AVL',
    away_code: 'WHU',
    home_team: 'Villa',
    away_team: 'West Ham',
    home_name: 'Villa',
    away_name: 'West Ham',
    kickoff_time: '2024-12-16T17:30:00Z',
  },
  {
    id: '6',
    gw: 14,
    fixture_index: 5,
    home_code: 'EVE',
    away_code: 'CRY',
    home_team: 'Everton',
    away_team: 'Palace',
    home_name: 'Everton',
    away_name: 'Palace',
    kickoff_time: '2024-12-17T15:00:00Z',
  },
  {
    id: '7',
    gw: 14,
    fixture_index: 6,
    home_code: 'FUL',
    away_code: 'WOL',
    home_team: 'Fulham',
    away_team: 'Wolves',
    home_name: 'Fulham',
    away_name: 'Wolves',
    kickoff_time: '2024-12-17T15:00:00Z',
  },
  {
    id: '8',
    gw: 14,
    fixture_index: 7,
    home_code: 'BOU',
    away_code: 'BRE',
    home_team: 'Bournemouth',
    away_team: 'Brentford',
    home_name: 'Bournemouth',
    away_name: 'Brentford',
    kickoff_time: '2024-12-17T15:00:00Z',
  },
  {
    id: '9',
    gw: 14,
    fixture_index: 8,
    home_code: 'NFO',
    away_code: 'BUR',
    home_team: 'Forest',
    away_team: 'Burnley',
    home_name: 'Forest',
    away_name: 'Burnley',
    kickoff_time: '2024-12-17T15:00:00Z',
  },
  {
    id: '10',
    gw: 14,
    fixture_index: 9,
    home_code: 'LEE',
    away_code: 'AVL',
    home_team: 'Leeds',
    away_team: 'Villa',
    home_name: 'Leeds',
    away_name: 'Villa',
    kickoff_time: '2024-12-17T17:30:00Z',
  },
];

// Sample picks
const samplePicks: Record<number, "H" | "D" | "A"> = {
  0: 'H', // Arsenal vs Chelsea - Home
  1: 'D', // Man City vs Liverpool - Draw
  2: 'A', // Man United vs Spurs - Away
  3: 'H', // Newcastle vs Brighton - Home
  4: 'H', // Villa vs West Ham - Home
  5: 'D', // Everton vs Palace - Draw
  6: 'A', // Fulham vs Wolves - Away
  7: 'H', // Bournemouth vs Brentford - Home
  8: 'H', // Forest vs Burnley - Home
  9: 'A', // Leeds vs Villa - Away
};

// Sample live scores
const sampleLiveScores = new Map<number, LiveScore>([
  [0, {
    status: 'FINISHED',
    minute: 90,
    homeScore: 2,
    awayScore: 1,
    home_team: 'Arsenal',
    away_team: 'Chelsea',
    goals: [
      { team: 'Arsenal', scorer: 'Saka', minute: 15 },
      { team: 'Arsenal', scorer: 'Odegaard', minute: 45 },
      { team: 'Chelsea', scorer: 'Palmer', minute: 67 },
    ],
  }],
  [1, {
    status: 'IN_PLAY',
    minute: 35,
    homeScore: 1,
    awayScore: 1,
    home_team: 'Man City',
    away_team: 'Liverpool',
    goals: [
      { team: 'Man City', scorer: 'Haaland', minute: 12 },
      { team: 'Liverpool', scorer: 'Salah', minute: 28 },
    ],
  }],
  [2, {
    status: 'PAUSED',
    minute: 45,
    homeScore: 0,
    awayScore: 1,
    home_team: 'Man United',
    away_team: 'Spurs',
    goals: [
      { team: 'Spurs', scorer: 'Son', minute: 23 },
    ],
  }],
]);

export const Default: Story = {
  args: {
    gw: 14,
    fixtures: sampleFixtures,
    picks: samplePicks,
    liveScores: new Map([
      [0, {
        status: 'FINISHED',
        minute: 90,
        homeScore: 2,
        awayScore: 1,
        home_team: 'Arsenal',
        away_team: 'Chelsea',
        goals: [
          { team: 'Arsenal', scorer: 'Saka', minute: 15 },
          { team: 'Arsenal', scorer: 'Odegaard', minute: 45 },
          { team: 'Chelsea', scorer: 'Palmer', minute: 67 },
        ],
      }],
      [1, {
        status: 'FINISHED',
        minute: 90,
        homeScore: 2,
        awayScore: 1,
        home_team: 'Man City',
        away_team: 'Liverpool',
        goals: [
          { team: 'Man City', scorer: 'Haaland', minute: 12 },
          { team: 'Man City', scorer: 'Foden', minute: 65 },
          { team: 'Liverpool', scorer: 'Salah', minute: 28 },
        ],
      }],
      [2, {
        status: 'IN_PLAY',
        minute: 18,
        homeScore: 0,
        awayScore: 1,
        home_team: 'Man United',
        away_team: 'Spurs',
        goals: [
          { team: 'Spurs', scorer: 'Son', minute: 8 },
        ],
      }],
    ]),
  },
};

export const WithPicks: Story = {
  args: {
    gw: 14,
    fixtures: sampleFixtures,
    picks: samplePicks,
    liveScores: new Map(),
  },
};

export const WithLiveScores: Story = {
  args: {
    gw: 14,
    fixtures: sampleFixtures,
    picks: samplePicks,
    liveScores: sampleLiveScores,
  },
};

export const AllFinished: Story = {
  args: {
    gw: 14,
    fixtures: sampleFixtures,
    picks: samplePicks,
    liveScores: new Map([
      [0, {
        status: 'FINISHED',
        minute: 90,
        homeScore: 2,
        awayScore: 1,
        home_team: 'Arsenal',
        away_team: 'Chelsea',
      }],
      [1, {
        status: 'FINISHED',
        minute: 90,
        homeScore: 1,
        awayScore: 1,
        home_team: 'Man City',
        away_team: 'Liverpool',
      }],
      [2, {
        status: 'FINISHED',
        minute: 90,
        homeScore: 0,
        awayScore: 2,
        home_team: 'Man United',
        away_team: 'Spurs',
      }],
      [3, {
        status: 'FINISHED',
        minute: 90,
        homeScore: 3,
        awayScore: 0,
        home_team: 'Newcastle',
        away_team: 'Brighton',
      }],
      [4, {
        status: 'FINISHED',
        minute: 90,
        homeScore: 2,
        awayScore: 1,
        home_team: 'Villa',
        away_team: 'West Ham',
      }],
      [5, {
        status: 'FINISHED',
        minute: 90,
        homeScore: 1,
        awayScore: 1,
        home_team: 'Everton',
        away_team: 'Palace',
      }],
      [6, {
        status: 'FINISHED',
        minute: 90,
        homeScore: 0,
        awayScore: 2,
        home_team: 'Fulham',
        away_team: 'Wolves',
      }],
      [7, {
        status: 'FINISHED',
        minute: 90,
        homeScore: 2,
        awayScore: 0,
        home_team: 'Bournemouth',
        away_team: 'Brentford',
      }],
      [8, {
        status: 'FINISHED',
        minute: 90,
        homeScore: 3,
        awayScore: 1,
        home_team: 'Forest',
        away_team: 'Burnley',
      }],
      [9, {
        status: 'FINISHED',
        minute: 90,
        homeScore: 1,
        awayScore: 2,
        home_team: 'Leeds',
        away_team: 'Villa',
      }],
    ]),
  },
};

export const FewFixtures: Story = {
  args: {
    gw: 15,
    fixtures: sampleFixtures.slice(0, 3),
    picks: { 0: 'H', 1: 'D', 2: 'A' },
    liveScores: new Map(),
  },
};

export const Empty: Story = {
  args: {
    gw: 16,
    fixtures: [],
    picks: {},
    liveScores: new Map(),
  },
};

