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
    gameweek: 17,
    variant: 'live',
    linkTo: '/predictions',
    // Use a future date to show countdown (format: "Day, Month Day, HH:MM")
    deadlineText: (() => {
      const future = new Date();
      future.setDate(future.getDate() + 2);
      future.setHours(18, 15, 0, 0);
      const weekday = future.toLocaleDateString(undefined, { weekday: 'short' });
      const month = future.toLocaleDateString(undefined, { month: 'short' });
      const day = future.getDate();
      const hours = String(future.getUTCHours()).padStart(2, '0');
      const minutes = String(future.getUTCMinutes()).padStart(2, '0');
      return `${weekday}, ${month} ${day}, ${hours}:${minutes}`;
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
    // Example with 2 days, 6 hours, 45 minutes remaining
    deadlineText: (() => {
      const future = new Date();
      future.setDate(future.getDate() + 2);
      future.setHours(future.getHours() + 6);
      future.setMinutes(future.getMinutes() + 45);
      const weekday = future.toLocaleDateString(undefined, { weekday: 'short' });
      const month = future.toLocaleDateString(undefined, { month: 'short' });
      const day = future.getDate();
      const hours = String(future.getUTCHours()).padStart(2, '0');
      const minutes = String(future.getUTCMinutes()).padStart(2, '0');
      return `${weekday}, ${month} ${day}, ${hours}:${minutes}`;
    })(),
  },
};
