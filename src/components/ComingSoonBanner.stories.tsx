import type { Meta, StoryObj } from '@storybook/react';
import GameweekBanner from './ComingSoonBanner';

const meta: Meta<typeof GameweekBanner> = {
  title: 'Components/GameweekBanner',
  component: GameweekBanner,
};

export default meta;

type Story = StoryObj<typeof GameweekBanner>;

export const Default: Story = {
  args: {
    gameweek: 15,
    message: 'Fixtures will be published soon.',
  },
};

export const CustomMessage: Story = {
  args: {
    gameweek: 20,
    message: 'The next gameweek fixtures are being prepared.',
  },
};

export const Live: Story = {
  args: {
    gameweek: 14,
    variant: 'live',
    linkTo: '/predictions',
    deadlineText: 'Mon, 2 Dec, 18:15',
  },
};

export const LiveNoDeadline: Story = {
  args: {
    gameweek: 14,
    variant: 'live',
    linkTo: '/predictions',
  },
};

