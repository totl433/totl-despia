import type { Meta, StoryObj } from '@storybook/react';
import { PageHeader } from './PageHeader';

const meta: Meta<typeof PageHeader> = {
  title: 'Components/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const AllHeaders: Story = {
  render: () => (
    <div className="space-y-8 p-6 bg-slate-50">
      <div>
        <h3 className="text-sm font-semibold text-slate-500 mb-4">All Page Headers (DxLactos Font)</h3>
        <div className="space-y-4 bg-white p-6 rounded-lg shadow-sm">
          <PageHeader title="Profile" as="h1" />
          <PageHeader title="Notification Centre" as="h1" />
          <PageHeader title="Mini Leagues" as="h2" />
          <PageHeader title="Leaderboard" as="h2" />
          <PageHeader title="Predictions Centre" as="h2" />
          <PageHeader title="Predictions Center" as="h2" />
          <PageHeader title="How To Play" as="h2" />
        </div>
      </div>
    </div>
  ),
};

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

