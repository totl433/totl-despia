import type { Meta, StoryObj } from '@storybook/react';
import { ProfileHeader } from './ProfileHeader';

const meta: Meta<typeof ProfileHeader> = {
  title: 'Components/Profile/ProfileHeader',
  component: ProfileHeader,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ProfileHeader>;

export const Default: Story = {
  args: {
    name: 'Jof',
    email: 'jof@example.com',
    stats: {
      ocp: 74,
      miniLeaguesCount: 10,
      weeksStreak: 15,
      loading: false,
    },
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    name: 'Jof',
    email: 'jof@example.com',
    stats: {
      ocp: 0,
      miniLeaguesCount: 0,
      weeksStreak: 0,
      loading: true,
    },
    loading: true,
  },
};

export const LongName: Story = {
  args: {
    name: 'Jonathan Middleton',
    email: 'jonathan.middleton@example.com',
    stats: {
      ocp: 74,
      miniLeaguesCount: 10,
      weeksStreak: 15,
      loading: false,
    },
    loading: false,
  },
};

export const NoName: Story = {
  args: {
    email: 'user@example.com',
    stats: {
      ocp: 50,
      miniLeaguesCount: 5,
      weeksStreak: 8,
      loading: false,
    },
    loading: false,
  },
};

