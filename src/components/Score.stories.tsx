import type { Meta, StoryObj } from '@storybook/react';
import Score from './Score';

const meta: Meta<typeof Score> = {
  title: 'Components/Score',
  component: Score,
};

export default meta;

type Story = StoryObj<typeof Score>;

export const Default: Story = {
  args: {
    score: 1,
    total: 2,
  },
};

export const HighScore: Story = {
  args: {
    score: 8,
    total: 10,
  },
};

export const PerfectScore: Story = {
  args: {
    score: 10,
    total: 10,
  },
};
































