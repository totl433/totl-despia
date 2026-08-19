import type { Meta, StoryObj } from '@storybook/react';
import SwipeCard from './SwipeCard';

const meta: Meta<typeof SwipeCard> = {
  title: 'Predictions/SwipeCard',
  component: SwipeCard,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => (
      <div style={{ width: 390, height: 640 }}>
        <Story />
      </div>
    ),
  ],
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

export const CoventryVsIpswich: Story = {
  args: {
    fixture: {
      ...sampleFixture,
      id: 'cov-ips',
      home_team: 'Coventry City',
      away_team: 'Ipswich Town',
      home_code: 'COV',
      away_code: 'IPS',
      home_name: 'Coventry City',
      away_name: 'Ipswich Town',
    },
    homeColor: '#059DD9',
    awayColor: '#3A64A3',
  },
};

export const HullStripes: Story = {
  args: {
    fixture: {
      ...sampleFixture,
      id: 'hul-che',
      home_team: 'Hull City',
      home_code: 'HUL',
      home_name: 'Hull City',
    },
    homeColor: '#F18A01',
    awayColor: '#034694',
  },
};

