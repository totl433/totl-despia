import type { Meta, StoryObj } from '@storybook/react';
import { FixtureCard, type Fixture, type LiveScore } from './FixtureCard';

const meta: Meta<typeof FixtureCard> = {
  title: 'Components/FixtureCard',
  component: FixtureCard,
};

export default meta;

type Story = StoryObj<typeof FixtureCard>;

const sampleFixture: Fixture = {
  id: '1',
  gw: 12,
  fixture_index: 1,
  home_code: 'ARS',
  away_code: 'CHE',
  home_team: 'Arsenal',
  away_team: 'Chelsea',
  home_name: 'Arsenal',
  away_name: 'Chelsea',
  kickoff_time: '2024-01-15T15:00:00Z',
};

// Not started fixture
export const NotStarted: Story = {
  args: {
    fixture: sampleFixture,
    pick: 'H',
    liveScore: null,
    isTestApi: false,
    showPickButtons: true,
  },
};

// Not started, no pick
export const NotStartedNoPick: Story = {
  args: {
    fixture: sampleFixture,
    pick: undefined,
    liveScore: null,
    isTestApi: false,
    showPickButtons: true,
  },
};

// Live fixture with correct pick
const liveFixture: Fixture = {
  ...sampleFixture,
  fixture_index: 2,
};

const liveScore: LiveScore = {
  status: 'IN_PLAY',
  minute: 35,
  homeScore: 2,
  awayScore: 1,
  home_team: 'Arsenal',
  away_team: 'Chelsea',
  goals: [
    { team: 'Arsenal', scorer: 'Saka', minute: 15 },
    { team: 'Arsenal', scorer: 'Odegaard', minute: 28 },
    { team: 'Chelsea', scorer: 'Palmer', minute: 32 },
  ],
};

export const LiveCorrectPick: Story = {
  args: {
    fixture: liveFixture,
    pick: 'H',
    liveScore: liveScore,
    isTestApi: false,
    showPickButtons: true,
  },
};

// Live fixture with wrong pick
export const LiveWrongPick: Story = {
  args: {
    fixture: liveFixture,
    pick: 'A',
    liveScore: liveScore,
    isTestApi: false,
    showPickButtons: true,
  },
};

// Finished fixture with correct pick (shiny)
const finishedFixture: Fixture = {
  ...sampleFixture,
  fixture_index: 3,
};

const finishedScore: LiveScore = {
  status: 'FINISHED',
  minute: 90,
  homeScore: 3,
  awayScore: 1,
  home_team: 'Arsenal',
  away_team: 'Chelsea',
  goals: [
    { team: 'Arsenal', scorer: 'Saka', minute: 15 },
    { team: 'Arsenal', scorer: 'Odegaard', minute: 28 },
    { team: 'Chelsea', scorer: 'Palmer', minute: 32 },
    { team: 'Arsenal', scorer: 'Saka', minute: 67 },
  ],
  red_cards: [
    { team: 'Chelsea', player: 'Sterling', minute: 78 },
  ],
};

export const FinishedCorrectPick: Story = {
  args: {
    fixture: finishedFixture,
    pick: 'H',
    liveScore: finishedScore,
    isTestApi: false,
    showPickButtons: true,
  },
};

// Finished fixture with wrong pick
export const FinishedWrongPick: Story = {
  args: {
    fixture: finishedFixture,
    pick: 'A',
    liveScore: finishedScore,
    isTestApi: false,
    showPickButtons: true,
  },
};

// Finished fixture, correct but didn't pick
export const FinishedCorrectNotPicked: Story = {
  args: {
    fixture: finishedFixture,
    pick: undefined,
    liveScore: finishedScore,
    isTestApi: false,
    showPickButtons: true,
  },
};

// Half time
const halftimeScore: LiveScore = {
  status: 'PAUSED',
  minute: 45,
  homeScore: 1,
  awayScore: 1,
  home_team: 'Arsenal',
  away_team: 'Chelsea',
  goals: [
    { team: 'Arsenal', scorer: 'Saka', minute: 15 },
    { team: 'Chelsea', scorer: 'Palmer', minute: 32 },
  ],
};

export const HalfTime: Story = {
  args: {
    fixture: {
      ...sampleFixture,
      fixture_index: 4,
    },
    pick: 'D',
    liveScore: halftimeScore,
    isTestApi: false,
    showPickButtons: true,
  },
};

// Test API fixture
export const TestApiFixture: Story = {
  args: {
    fixture: {
      ...sampleFixture,
      fixture_index: 5,
    },
    pick: 'H',
    liveScore: {
      status: 'IN_PLAY',
      minute: 23,
      homeScore: 1,
      awayScore: 0,
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      goals: [
        { team: 'Arsenal', scorer: 'Saka', minute: 15 },
      ],
    },
    isTestApi: true,
    showPickButtons: true,
  },
};

// No pick buttons
export const NoPickButtons: Story = {
  args: {
    fixture: finishedFixture,
    pick: 'H',
    liveScore: finishedScore,
    isTestApi: false,
    showPickButtons: false,
  },
};



































