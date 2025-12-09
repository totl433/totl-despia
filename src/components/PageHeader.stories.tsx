import type { Meta, StoryObj } from '@storybook/react';
import { PageHeader } from './PageHeader';

const meta: Meta<typeof PageHeader> = {
  title: 'Components/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {
    title: 'Leaderboard',
  },
};

export const AsH1: Story = {
  args: {
    title: 'Profile',
    as: 'h1',
  },
};

export const AsH2: Story = {
  args: {
    title: 'Mini Leagues',
    as: 'h2',
  },
};

export const WithCustomClassName: Story = {
  args: {
    title: 'Notification Centre',
    className: 'mb-6',
  },
};

