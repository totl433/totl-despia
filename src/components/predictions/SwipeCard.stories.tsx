import type { Meta, StoryObj } from '@storybook/react';
import SwipeCard from './SwipeCard';

const meta: Meta<typeof SwipeCard> = {
  title: 'Predictions/SwipeCard',
  component: SwipeCard,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof SwipeCard>;

const sampleFixture = {
  id: '1',
  fixture_index: 0,
  home_team: 'Arsenal',
  away_team: 'Chelsea',
  home_code: 'ARS',
  away_code: 'CHE',
  home_name: 'Arsenal',
  away_name: 'Chelsea',
  kickoff_time: '2025-12-15T15:00:00Z',
};

export const Default: Story = {
  args: {
    fixture: sampleFixture,
    homeColor: '#EF0107',
    awayColor: '#034694',
    showSwipeHint: true,
  },
};

export const NoKickoffTime: Story = {
  args: {
    fixture: {
      ...sampleFixture,
      kickoff_time: null,
    },
    homeColor: '#EF0107',
    awayColor: '#034694',
  },
};

