import type { Meta, StoryObj } from '@storybook/react';
import GameweekBanner from './ComingSoonBanner';
import { formatDeadlineBannerText } from '../lib/kickoffDisplay';

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
    gameweek: 17,
    variant: 'live',
    linkTo: '/predictions',
    deadlineText: (() => {
      const future = new Date();
      future.setDate(future.getDate() + 2);
      future.setHours(18, 15, 0, 0);
      return formatDeadlineBannerText(new Date(future.getTime() + 75 * 60 * 1000).toISOString());
    })(),
  },
};

export const LiveNoDeadline: Story = {
  args: {
    gameweek: 17,
    variant: 'live',
    linkTo: '/predictions',
  },
};

export const LiveWithCountdown: Story = {
  args: {
    gameweek: 17,
    variant: 'live',
    linkTo: '/predictions',
    deadlineText: (() => {
      const future = new Date();
      future.setDate(future.getDate() + 2);
      future.setHours(future.getHours() + 6);
      future.setMinutes(future.getMinutes() + 45);
      return formatDeadlineBannerText(new Date(future.getTime() + 75 * 60 * 1000).toISOString());
    })(),
  },
};
