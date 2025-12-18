import type { Meta, StoryObj } from '@storybook/react';
import { StatCard } from './StatCard';

const meta: Meta<typeof StatCard> = {
  title: 'Components/Profile/StatCard',
  component: StatCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
  args: {
    label: 'Gameweek (GW17)',
    value: "You were in the top 19% of players",
  },
};

export const WithSubcopy: Story = {
  args: {
    label: 'Gameweek (GW17)',
    value: "You finished in the top 19% of players",
    subcopy: "One good week can change everything.",
  },
};

export const BottomPercentile: Story = {
  args: {
    label: 'Gameweek (GW17)',
    value: "You landed in the bottom 42% this week",
    subcopy: "We go again.",
  },
};

export const Percentage: Story = {
  args: {
    label: 'Correct prediction rate',
    value: '51.45%',
    subcopy: "Better than guessing… just.",
  },
};

export const Number: Story = {
  args: {
    label: 'Avg points / week',
    value: '5.34',
    subcopy: "Slow and steady.",
  },
};

export const Loading: Story = {
  args: {
    label: 'Loading stat',
    value: '',
    loading: true,
  },
};

