import type { Meta, StoryObj } from '@storybook/react';
import TeamBadge from './TeamBadge';

const meta: Meta<typeof TeamBadge> = {
  title: 'Components/TeamBadge',
  component: TeamBadge,
};

export default meta;

type Story = StoryObj<typeof TeamBadge>;

export const WithCode: Story = {
  args: {
    code: 'ARS',
    size: 28,
  },
};

export const WithCrest: Story = {
  args: {
    code: 'ARS',
    crest: 'https://crests.football-data.org/57.png',
    size: 28,
  },
};

export const CrestFallback: Story = {
  args: {
    code: 'ARS',
    crest: 'https://invalid-url.com/crest.png', // Will fallback to ClubBadge
    size: 28,
  },
};

export const NoCode: Story = {
  args: {
    size: 28,
  },
};

export const Large: Story = {
  args: {
    code: 'MCI',
    size: 120,
  },
};





















