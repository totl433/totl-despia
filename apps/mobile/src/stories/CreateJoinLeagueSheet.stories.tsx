import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { Screen } from '@totl/ui';

import CreateJoinLeagueSheet from '../components/miniLeagues/CreateJoinLeagueSheet';

const meta: Meta<typeof CreateJoinLeagueSheet> = {
  title: 'miniLeagues/CreateJoinLeagueSheet',
  component: CreateJoinLeagueSheet,
  decorators: [
    (Story) => (
      <Screen fullBleed style={{ padding: 16 }}>
        <Story />
      </Screen>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof CreateJoinLeagueSheet>;

export const Empty: Story = {
  args: {
    open: true,
    onClose: () => {},
    joinCode: '',
    setJoinCode: () => {},
    joinError: null,
    joining: false,
    onPressCreate: () => {},
    onPressJoin: () => {},
  },
};

export const CodeEntered: Story = {
  args: {
    open: true,
    onClose: () => {},
    joinCode: '12345',
    setJoinCode: () => {},
    joinError: null,
    joining: false,
    onPressCreate: () => {},
    onPressJoin: () => {},
  },
};

export const ErrorState: Story = {
  args: {
    open: true,
    onClose: () => {},
    joinCode: 'ABCDE',
    setJoinCode: () => {},
    joinError: 'League code not found.',
    joining: false,
    onPressCreate: () => {},
    onPressJoin: () => {},
  },
};

