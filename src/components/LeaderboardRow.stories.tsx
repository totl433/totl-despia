import type { Meta, StoryObj } from '@storybook/react';
import { LeaderboardRow } from './LeaderboardRow';

const meta = {
  title: 'Components/LeaderboardRow',
  component: LeaderboardRow,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LeaderboardRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockRow = {
  user_id: 'user-1',
  name: 'John Doe',
  rank: 1,
  this_gw: 8,
  ocp: 45,
  formPoints: 25,
  points: 8,
};

const mockArray = [
  { ...mockRow, user_id: 'user-1', name: 'John Doe', rank: 1 },
  { ...mockRow, user_id: 'user-2', name: 'Jane Smith', rank: 2 },
  { ...mockRow, user_id: 'user-3', name: 'Bob Johnson', rank: 3 },
];

export const OverallTab: Story = {
  args: {
    row: mockRow,
    index: 0,
    array: mockArray,
    activeTab: 'overall',
    isCurrentUser: false,
    prevRanks: {},
    currRanks: { 'user-1': 1 },
    latestGw: 12,
  },
  render: (args) => (
    <table className="w-full">
      <tbody>
        <LeaderboardRow {...args} />
      </tbody>
    </table>
  ),
};

export const Form5Tab: Story = {
  args: {
    row: { ...mockRow, formPoints: 25 },
    index: 0,
    array: mockArray,
    activeTab: 'form5',
    isCurrentUser: false,
    prevRanks: {},
    currRanks: {},
    latestGw: 12,
  },
  render: (args) => (
    <table className="w-full">
      <tbody>
        <LeaderboardRow {...args} />
      </tbody>
    </table>
  ),
};

export const Form10Tab: Story = {
  args: {
    row: { ...mockRow, formPoints: 50 },
    index: 0,
    array: mockArray,
    activeTab: 'form10',
    isCurrentUser: false,
    prevRanks: {},
    currRanks: {},
    latestGw: 12,
  },
  render: (args) => (
    <table className="w-full">
      <tbody>
        <LeaderboardRow {...args} />
      </tbody>
    </table>
  ),
};

export const LastGwTab: Story = {
  args: {
    row: { ...mockRow, points: 8 },
    index: 0,
    array: mockArray,
    activeTab: 'lastgw',
    isCurrentUser: false,
    prevRanks: {},
    currRanks: {},
    latestGw: 12,
  },
  render: (args) => (
    <table className="w-full">
      <tbody>
        <LeaderboardRow {...args} />
      </tbody>
    </table>
  ),
};

export const CurrentUser: Story = {
  args: {
    row: { ...mockRow, user_id: 'current-user', name: 'You' },
    index: 2,
    array: mockArray,
    activeTab: 'overall',
    isCurrentUser: true,
    prevRanks: { 'current-user': 3 },
    currRanks: { 'current-user': 2 },
    latestGw: 12,
  },
  render: (args) => (
    <table className="w-full">
      <tbody>
        <LeaderboardRow {...args} />
      </tbody>
    </table>
  ),
};

export const TopRank: Story = {
  args: {
    row: { ...mockRow, rank: 1 },
    index: 0,
    array: mockArray,
    activeTab: 'overall',
    isCurrentUser: false,
    prevRanks: {},
    currRanks: { 'user-1': 1 },
    latestGw: 12,
  },
  render: (args) => (
    <table className="w-full">
      <tbody>
        <LeaderboardRow {...args} />
      </tbody>
    </table>
  ),
};

export const RankMovementUp: Story = {
  args: {
    row: { ...mockRow, rank: 2 },
    index: 1,
    array: mockArray,
    activeTab: 'overall',
    isCurrentUser: false,
    prevRanks: { 'user-1': 5 },
    currRanks: { 'user-1': 2 },
    latestGw: 12,
  },
  render: (args) => (
    <table className="w-full">
      <tbody>
        <LeaderboardRow {...args} />
      </tbody>
    </table>
  ),
};

export const RankMovementDown: Story = {
  args: {
    row: { ...mockRow, rank: 5 },
    index: 4,
    array: mockArray,
    activeTab: 'overall',
    isCurrentUser: false,
    prevRanks: { 'user-1': 2 },
    currRanks: { 'user-1': 5 },
    latestGw: 12,
  },
  render: (args) => (
    <table className="w-full">
      <tbody>
        <LeaderboardRow {...args} />
      </tbody>
    </table>
  ),
};

export const TiedRank: Story = {
  args: {
    row: { ...mockRow, rank: 3 },
    index: 2,
    array: [
      ...mockArray,
      { ...mockRow, user_id: 'user-4', name: 'Tied Player', rank: 3 },
    ],
    activeTab: 'overall',
    isCurrentUser: false,
    prevRanks: {},
    currRanks: { 'user-1': 3 },
    latestGw: 12,
  },
  render: (args) => (
    <table className="w-full">
      <tbody>
        <LeaderboardRow {...args} />
      </tbody>
    </table>
  ),
};















