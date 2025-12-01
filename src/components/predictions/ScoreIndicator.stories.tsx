import type { Meta, StoryObj } from '@storybook/react';
import ScoreIndicator from './ScoreIndicator';

const meta: Meta<typeof ScoreIndicator> = {
  title: 'Predictions/ScoreIndicator',
  component: ScoreIndicator,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ScoreIndicator>;

export const Default: Story = {
  args: {
    score: 7,
    total: 10,
  },
};

export const WithTopPercent: Story = {
  args: {
    score: 8,
    total: 10,
    topPercent: 15,
  },
};

export const PerfectScore: Story = {
  args: {
    score: 10,
    total: 10,
    topPercent: 1,
  },
};

export const LowScore: Story = {
  args: {
    score: 2,
    total: 10,
    topPercent: 85,
  },
};

