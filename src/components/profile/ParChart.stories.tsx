import type { Meta, StoryObj } from '@storybook/react';
import { ParChart } from './ParChart';

const sampleData = Array.from({ length: 10 }).map((_, idx) => ({
  gw: idx + 8,
  userPoints: 4 + (idx % 5) + (idx % 3 === 0 ? 2 : 0),
  averagePoints: 5.2 + (idx % 3) * 0.3,
}));

const meta: Meta<typeof ParChart> = {
  title: 'Components/Profile/ParChart',
  component: ParChart,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ParChart>;

export const Default: Story = {
  args: {
    weeklyData: sampleData,
    latestGw: 17,
  },
};

export const MostlyAbovePar: Story = {
  args: {
    weeklyData: Array.from({ length: 10 }).map((_, idx) => ({
      gw: idx + 8,
      userPoints: 7 + (idx % 3),
      averagePoints: 5.0 + (idx % 2) * 0.5,
    })),
    latestGw: 17,
  },
};

export const MostlyBelowPar: Story = {
  args: {
    weeklyData: Array.from({ length: 10 }).map((_, idx) => ({
      gw: idx + 8,
      userPoints: 3 + (idx % 2),
      averagePoints: 5.5 + (idx % 3) * 0.3,
    })),
    latestGw: 17,
  },
};

export const MixedPerformance: Story = {
  args: {
    weeklyData: [
      { gw: 8, userPoints: 8, averagePoints: 5.2 },
      { gw: 9, userPoints: 4, averagePoints: 5.8 },
      { gw: 10, userPoints: 6, averagePoints: 6.0 },
      { gw: 11, userPoints: 9, averagePoints: 5.5 },
      { gw: 12, userPoints: 3, averagePoints: 6.2 },
      { gw: 13, userPoints: 7, averagePoints: 5.0 },
      { gw: 14, userPoints: 5, averagePoints: 5.5 },
      { gw: 15, userPoints: 10, averagePoints: 4.8 },
      { gw: 16, userPoints: 6, averagePoints: 5.9 },
      { gw: 17, userPoints: 8, averagePoints: 5.3 },
    ],
    latestGw: 17,
  },
};

export const FewWeeks: Story = {
  args: {
    weeklyData: [
      { gw: 15, userPoints: 7, averagePoints: 5.2 },
      { gw: 16, userPoints: 6, averagePoints: 5.8 },
      { gw: 17, userPoints: 9, averagePoints: 5.5 },
    ],
    latestGw: 17,
  },
};

