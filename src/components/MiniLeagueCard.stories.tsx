import type { Meta, StoryObj } from '@storybook/react';
import { MiniLeagueCard, type LeagueRow, type LeagueData } from './MiniLeagueCard';

const meta: Meta<typeof MiniLeagueCard> = {
  title: 'Components/MiniLeagueCard',
  component: MiniLeagueCard,
};

export default meta;

type Story = StoryObj<typeof MiniLeagueCard>;

const sampleRow: LeagueRow = {
  id: '1',
  name: 'My League',
  code: 'ABCDE',
  memberCount: 5,
};

const sampleData: LeagueData = {
  id: '1',
  members: [
    { id: '1', name: 'John Doe' },
    { id: '2', name: 'Jane Smith' },
    { id: '3', name: 'Bob Johnson' },
    { id: '4', name: 'Alice Williams' },
    { id: '5', name: 'Charlie Brown' },
  ],
  userPosition: 2,
  positionChange: 'up',
  submittedMembers: new Set(['1', '2', '3']),
  sortedMemberIds: ['1', '2', '3', '4', '5'],
};

export const Default: Story = {
  args: {
    row: sampleRow,
    data: sampleData,
    unread: 0,
    submissions: {
      allSubmitted: false,
      submittedCount: 3,
      totalCount: 5,
    },
    leagueDataLoading: false,
    currentGw: 14,
  },
};

export const AllSubmitted: Story = {
  args: {
    row: sampleRow,
    data: sampleData,
    unread: 0,
    submissions: {
      allSubmitted: true,
      submittedCount: 5,
      totalCount: 5,
    },
    leagueDataLoading: false,
    currentGw: 14,
  },
};

export const WithUnread: Story = {
  args: {
    row: sampleRow,
    data: sampleData,
    unread: 5,
    submissions: {
      allSubmitted: false,
      submittedCount: 3,
      totalCount: 5,
    },
    leagueDataLoading: false,
    currentGw: 14,
  },
};

export const WithWinner: Story = {
  args: {
    row: sampleRow,
    data: {
      ...sampleData,
      latestGwWinners: new Set(['1']),
      latestRelevantGw: 14,
    },
    unread: 0,
    submissions: {
      allSubmitted: true,
      submittedCount: 5,
      totalCount: 5,
    },
    leagueDataLoading: false,
    currentGw: 14,
  },
};

export const Loading: Story = {
  args: {
    row: sampleRow,
    data: undefined,
    unread: 0,
    submissions: undefined,
    leagueDataLoading: true,
    currentGw: 14,
  },
};

export const NoPosition: Story = {
  args: {
    row: sampleRow,
    data: {
      ...sampleData,
      userPosition: null,
      positionChange: null,
    },
    unread: 0,
    submissions: {
      allSubmitted: false,
      submittedCount: 2,
      totalCount: 5,
    },
    leagueDataLoading: false,
    currentGw: 14,
  },
};

export const WithoutRanking: Story = {
  args: {
    row: sampleRow,
    data: sampleData,
    unread: 0,
    submissions: {
      allSubmitted: false,
      submittedCount: 3,
      totalCount: 5,
    },
    leagueDataLoading: false,
    currentGw: 14,
    showRanking: false,
  },
};

