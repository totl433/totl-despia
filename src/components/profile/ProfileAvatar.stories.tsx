import type { Meta, StoryObj } from '@storybook/react';
import { ProfileAvatar } from './ProfileAvatar';

const meta: Meta<typeof ProfileAvatar> = {
  title: 'Components/Profile/ProfileAvatar',
  component: ProfileAvatar,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ProfileAvatar>;

export const Default: Story = {
  args: {
    name: 'Jof',
    email: 'jof@example.com',
    size: 'md',
  },
};

export const Small: Story = {
  args: {
    name: 'Jof',
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    name: 'Jof',
    size: 'lg',
  },
};

export const NoName: Story = {
  args: {
    email: 'user@example.com',
    size: 'md',
  },
};

export const NoNameOrEmail: Story = {
  args: {
    size: 'md',
  },
};

