import type { Meta, StoryObj } from '@storybook/react';
import { NotificationToggle } from './NotificationToggle';

const meta: Meta<typeof NotificationToggle> = {
  title: 'Components/Profile/NotificationToggle',
  component: NotificationToggle,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-white rounded-xl shadow-md p-6 max-w-md">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof NotificationToggle>;

export const Enabled: Story = {
  args: {
    id: 'chat-notifications',
    label: 'Chat Notifications',
    description: 'Get notified when someone sends a message in your mini-leagues',
    enabled: true,
    onChange: (enabled) => console.log('Toggled to:', enabled),
  },
};

export const Disabled: Story = {
  args: {
    id: 'chat-notifications',
    label: 'Chat Notifications',
    description: 'Get notified when someone sends a message in your mini-leagues',
    enabled: false,
    onChange: (enabled) => console.log('Toggled to:', enabled),
  },
};

export const NoDescription: Story = {
  args: {
    id: 'score-notifications',
    label: 'Score Notifications',
    enabled: true,
    onChange: (enabled) => console.log('Toggled to:', enabled),
  },
};

export const DisabledToggle: Story = {
  args: {
    id: 'system-notifications',
    label: 'System Notifications',
    description: 'Important updates and announcements',
    enabled: true,
    disabled: true,
    onChange: (enabled) => console.log('Toggled to:', enabled),
  },
};

