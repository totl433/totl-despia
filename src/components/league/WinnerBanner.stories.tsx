import type { Meta, StoryObj } from '@storybook/react';
import WinnerBanner from './WinnerBanner';

const meta: Meta<typeof WinnerBanner> = {
  title: 'League/WinnerBanner',
  component: WinnerBanner,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof WinnerBanner>;

export const Winner: Story = {
  args: {
    winnerName: 'Carl',
    isDraw: false,
  },
};

export const Draw: Story = {
  args: {
    winnerName: 'Carl',
    isDraw: true,
  },
};

