import type { Meta, StoryObj } from '@storybook/react';
import { ParChartCard } from './ParChartCard';

const meta: Meta<typeof ParChartCard> = {
  title: 'Components/Profile/ParChartCard',
  component: ParChartCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ParChartCard>;

export const AbovePar: Story = {
  args: {
    gw: 10,
    userPoints: 8,
    averagePoints: 5.2,
    isLatest: false,
  },
};

export const BelowPar: Story = {
  args: {
    gw: 9,
    userPoints: 4,
    averagePoints: 5.8,
    isLatest: false,
  },
};

export const AtPar: Story = {
  args: {
    gw: 8,
    userPoints: 6,
    averagePoints: 6.0,
    isLatest: false,
  },
};

export const LatestAbovePar: Story = {
  args: {
    gw: 17,
    userPoints: 9,
    averagePoints: 5.5,
    isLatest: true,
  },
};

export const LatestBelowPar: Story = {
  args: {
    gw: 17,
    userPoints: 3,
    averagePoints: 6.2,
    isLatest: true,
  },
};

export const LargeDifference: Story = {
  args: {
    gw: 12,
    userPoints: 10,
    averagePoints: 4.1,
    isLatest: false,
  },
};

export const SmallDifference: Story = {
  args: {
    gw: 11,
    userPoints: 6,
    averagePoints: 5.9,
    isLatest: false,
  },
};

