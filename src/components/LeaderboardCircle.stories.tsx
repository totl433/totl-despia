import type { Meta, StoryObj } from '@storybook/react';
import LeaderboardCircle from './LeaderboardCircle';

const meta = {
  title: 'Components/LeaderboardCircle',
  component: LeaderboardCircle,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof LeaderboardCircle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LastGW: Story = {
  args: {
    to: '/global?tab=lastgw',
    rank: 54,
    total: 110,
    label: 'GW20',
    bgColor: 'bg-blue-500',
    gw: 20,
  },
};

export const FiveForm: Story = {
  args: {
    to: '/global?tab=form5',
    rank: 12,
    total: 87,
    label: '5 Form',
    bgColor: 'bg-emerald-500',
  },
};

export const TenForm: Story = {
  args: {
    to: '/global?tab=form10',
    rank: 8,
    total: 65,
    label: '10 Form',
    bgColor: 'bg-teal-500',
  },
};

export const Overall: Story = {
  args: {
    to: '/global?tab=overall',
    rank: 23,
    total: 250,
    label: 'Overall',
    bgColor: 'bg-[#1C8376]',
  },
};

export const FirstPlace: Story = {
  args: {
    to: '/global?tab=overall',
    rank: 1,
    total: 250,
    label: 'Overall',
    bgColor: 'bg-[#1C8376]',
  },
};

export const SecondPlace: Story = {
  args: {
    to: '/global?tab=overall',
    rank: 2,
    total: 250,
    label: 'Overall',
    bgColor: 'bg-[#1C8376]',
  },
};

export const ThirdPlace: Story = {
  args: {
    to: '/global?tab=overall',
    rank: 3,
    total: 250,
    label: 'Overall',
    bgColor: 'bg-[#1C8376]',
  },
};

export const NoRank: Story = {
  args: {
    to: '/global?tab=form5',
    rank: null,
    total: 87,
    label: '5 Form',
    bgColor: 'bg-emerald-500',
  },
};

export const AllCircles: Story = {
  render: () => (
    <div className="flex flex-row gap-3 sm:gap-4 lg:gap-6 justify-between items-start w-full px-2 sm:px-0 max-w-md">
      <LeaderboardCircle
        to="/global?tab=lastgw"
        rank={54}
        total={110}
        label="GW20"
        bgColor="bg-blue-500"
        gw={20}
      />
      <LeaderboardCircle
        to="/global?tab=form5"
        rank={12}
        total={87}
        label="5 Form"
        bgColor="bg-emerald-500"
      />
      <LeaderboardCircle
        to="/global?tab=form10"
        rank={8}
        total={65}
        label="10 Form"
        bgColor="bg-teal-500"
      />
      <LeaderboardCircle
        to="/global?tab=overall"
        rank={23}
        total={250}
        label="Overall"
        bgColor="bg-[#1C8376]"
      />
    </div>
  ),
};


