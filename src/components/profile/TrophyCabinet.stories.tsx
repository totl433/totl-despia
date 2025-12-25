import type { Meta, StoryObj } from '@storybook/react';
import { TrophyCabinet } from './TrophyCabinet';

const meta: Meta<typeof TrophyCabinet> = {
  title: 'Components/Profile/TrophyCabinet',
  component: TrophyCabinet,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TrophyCabinet>;

export const Default: Story = {
  args: {
    lastGw: 3,
    form5: 2,
    form10: 1,
    overall: 0,
  },
};

export const ManyTrophies: Story = {
  args: {
    lastGw: 5,
    form5: 4,
    form10: 3,
    overall: 2,
  },
};

export const NoTrophies: Story = {
  args: {
    lastGw: 0,
    form5: 0,
    form10: 0,
    overall: 0,
  },
};

export const Loading: Story = {
  args: {
    lastGw: 0,
    form5: 0,
    form10: 0,
    overall: 0,
    loading: true,
  },
};

