import type { Meta, StoryObj } from '@storybook/react';
import GWCard from './GWCard';

const meta: Meta<typeof GWCard> = {
  title: 'Components/GWCard',
  component: GWCard,
};

export default meta;

type Story = StoryObj<typeof GWCard>;

export const WithScore: Story = {
  args: {
    gw: 14,
    score: 8,
    submitted: true,
  },
};

export const NoScore: Story = {
  args: {
    gw: 15,
    score: null,
    submitted: false,
  },
};

export const SubmittedZero: Story = {
  args: {
    gw: 16,
    score: null,
    submitted: true,
  },
};

































