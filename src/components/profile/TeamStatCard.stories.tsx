import type { Meta, StoryObj } from '@storybook/react';
import { TeamStatCard } from './TeamStatCard';

const meta: Meta<typeof TeamStatCard> = {
  title: 'Components/Profile/TeamStatCard',
  component: TeamStatCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TeamStatCard>;

export const MostCorrect: Story = {
  args: {
    label: 'Most correctly predicted team',
    teamCode: 'LIV',
    teamName: 'Liverpool',
    percentage: 78,
    isCorrect: true,
    subcopy: "You've got them figured out.",
  },
};

export const MostIncorrect: Story = {
  args: {
    label: 'Most incorrectly picked team',
    teamCode: 'MCI',
    teamName: 'Manchester City',
    percentage: 67.5,
    isCorrect: false,
    subcopy: "They keep letting you down.",
  },
};

export const WithDecimal: Story = {
  args: {
    label: 'Most correctly predicted team',
    teamCode: 'ARS',
    teamName: 'Arsenal',
    percentage: 78.45,
    isCorrect: true,
    subcopy: "Safe pair of hands.",
  },
};

export const Loading: Story = {
  args: {
    label: 'Most correctly predicted team',
    teamCode: null,
    teamName: '',
    percentage: 0,
    isCorrect: true,
    loading: true,
  },
};

