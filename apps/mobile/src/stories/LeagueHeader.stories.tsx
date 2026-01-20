import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { Screen } from '@totl/ui';
import LeagueHeader from '../components/league/LeagueHeader';

const meta: Meta<typeof LeagueHeader> = {
  title: 'league/LeagueHeader',
  component: LeagueHeader,
  decorators: [
    (Story) => (
      <Screen fullBleed>
        <Story />
      </Screen>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof LeagueHeader>;

export const Default: Story = {
  args: {
    title: 'Prem Predictions',
    subtitle: 'Gameweek 22',
    avatarUri: null,
    onPressBack: () => {},
    onPressMenu: () => {},
  },
};

