import type { Meta, StoryObj } from '@storybook/react';
import { ProfileStats } from './ProfileStats';

const meta: Meta<typeof ProfileStats> = {
  title: 'Components/Profile/ProfileStats',
  component: ProfileStats,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ProfileStats>;

export const Default: Story = {
  args: {
    ocp: 74,
    miniLeaguesCount: 10,
    weeksStreak: 15,
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    ocp: 0,
    miniLeaguesCount: 0,
    weeksStreak: 0,
    loading: true,
  },
};

export const LowValues: Story = {
  args: {
    ocp: 5,
    miniLeaguesCount: 1,
    weeksStreak: 1,
    loading: false,
  },
};

export const HighValues: Story = {
  args: {
    ocp: 150,
    miniLeaguesCount: 25,
    weeksStreak: 38,
    loading: false,
  },
};

