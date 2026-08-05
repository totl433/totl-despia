import type { Meta, StoryObj } from '@storybook/react';
import { TrophyCabinet } from './TrophyCabinet';

const meta: Meta<typeof TrophyCabinet> = {
  title: 'Components/Profile/TrophyCabinet',
  component: TrophyCabinet,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TrophyCabinet>;

export const Default: Story = {
  args: {
    gameweek: 4,
    monthly: 2,
    season: 1,
  },
};

export const ManyTrophies: Story = {
  args: {
    gameweek: 12,
    monthly: 5,
    season: 3,
  },
};

export const NoTrophies: Story = {
  args: {
    gameweek: 0,
    monthly: 0,
    season: 0,
  },
};

export const Loading: Story = {
  args: {
    gameweek: 0,
    monthly: 0,
    season: 0,
    loading: true,
  },
};
