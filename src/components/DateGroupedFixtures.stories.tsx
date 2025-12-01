import type { Meta, StoryObj } from '@storybook/react';
import DateGroupedFixtures from './DateGroupedFixtures';

const meta: Meta<typeof DateGroupedFixtures> = {
  title: 'Components/DateGroupedFixtures',
  component: DateGroupedFixtures,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof DateGroupedFixtures>;

const sampleFixtures = [
  {
    fixture: {
      id: '1',
      gw: 14,
      fixture_index: 0,
      home_team: 'Bournemouth',
      away_team: 'Everton',
      home_code: 'BOU',
      away_code: 'EVE',
      kickoff_time: '2025-12-02T19:30:00Z',
    },
    liveScore: null,
    pick: 'H' as const,
  },
  {
    fixture: {
      id: '2',
      gw: 14,
      fixture_index: 1,
      home_team: 'Fulham',
      away_team: 'Man City',
      home_code: 'FUL',
      away_code: 'MCI',
      kickoff_time: '2025-12-02T19:30:00Z',
    },
    liveScore: null,
    pick: 'D' as const,
  },
  {
    fixture: {
      id: '3',
      gw: 14,
      fixture_index: 2,
      home_team: 'Newcastle',
      away_team: 'Spurs',
      home_code: 'NEW',
      away_code: 'TOT',
      kickoff_time: '2025-12-03T20:15:00Z',
    },
    liveScore: null,
    pick: 'A' as const,
  },
];

export const Default: Story = {
  args: {
    fixtureCards: sampleFixtures,
    isTestApi: false,
    showPickButtons: true,
  },
};

export const SingleDate: Story = {
  args: {
    fixtureCards: sampleFixtures.slice(0, 2),
    isTestApi: false,
    showPickButtons: true,
  },
};

export const MultipleDates: Story = {
  args: {
    fixtureCards: sampleFixtures,
    isTestApi: false,
    showPickButtons: true,
  },
};

