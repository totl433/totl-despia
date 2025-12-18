import type { Meta, StoryObj } from '@storybook/react';
import { StreakStatCard } from './StreakStatCard';

const meta: Meta<typeof StreakStatCard> = {
  title: 'Components/Profile/StreakStatCard',
  component: StreakStatCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof StreakStatCard>;

export const Default: Story = {
  args: {
    label: 'Most consecutive weeks in the top 25%',
    streakCount: 4,
    gwRange: 'GW6–GW10',
  },
};

export const WithSubcopy: Story = {
  args: {
    label: 'Most consecutive weeks in the top 25%',
    streakCount: 4,
    gwRange: 'GW6–GW10',
    subcopy: "Your purple patch.",
  },
};

export const WithExtraLine: Story = {
  args: {
    label: 'Most consecutive weeks in the top 25%',
    streakCount: 7,
    gwRange: 'GW1–GW7',
    extraLine: "You were cooking.",
    subcopy: "Form of your life.",
  },
};

export const Loading: Story = {
  args: {
    label: 'Most consecutive weeks in the top 25%',
    streakCount: 0,
    gwRange: '',
    loading: true,
  },
};

