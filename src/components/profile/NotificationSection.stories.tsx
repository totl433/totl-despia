import type { Meta, StoryObj } from '@storybook/react';
import { NotificationSection } from './NotificationSection';

const meta: Meta<typeof NotificationSection> = {
  title: 'Components/Profile/NotificationSection',
  component: NotificationSection,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof NotificationSection>;

export const Default: Story = {
  args: {
    title: 'Chat Notifications',
    description: 'Control when you receive notifications for mini-league messages',
    options: [
      {
        id: 'chat-messages',
        label: 'New Messages',
        description: 'Get notified when someone sends a message in your mini-leagues',
        enabled: true,
      },
      {
        id: 'chat-mentions',
        label: 'Mentions',
        description: 'Get notified when someone mentions you in a message',
        enabled: false,
      },
    ],
    onToggle: (id, enabled) => console.log(`Toggled ${id} to ${enabled}`),
  },
};

export const GameNotifications: Story = {
  args: {
    title: 'Game Notifications',
    description: 'Stay updated on match results and scores',
    options: [
      {
        id: 'new-gameweek',
        label: 'New Gameweek Published',
        description: 'Get notified when a new gameweek is published and ready for predictions',
        enabled: true,
      },
      {
        id: 'score-updates',
        label: 'Score Updates',
        description: 'Get notified when match scores are updated',
        enabled: true,
      },
      {
        id: 'final-whistle',
        label: 'Final Whistle',
        description: 'Get notified when matches finish',
        enabled: true,
      },
      {
        id: 'gw-results',
        label: 'Gameweek Results',
        description: 'Get notified when a gameweek is finalized',
        enabled: false,
      },
    ],
    onToggle: (id, enabled) => console.log(`Toggled ${id} to ${enabled}`),
  },
};

export const SingleOption: Story = {
  args: {
    title: 'System Notifications',
    options: [
      {
        id: 'system-updates',
        label: 'System Updates',
        description: 'Important updates and announcements',
        enabled: true,
        disabled: true,
      },
    ],
    onToggle: (id, enabled) => console.log(`Toggled ${id} to ${enabled}`),
  },
};

