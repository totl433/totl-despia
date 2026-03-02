import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { Screen } from '@totl/ui';
import MiniLeaguesHeader from '../components/miniLeagues/MiniLeaguesHeader';

const meta: Meta<typeof MiniLeaguesHeader> = {
  title: 'miniLeagues/MiniLeaguesHeader',
  component: MiniLeaguesHeader,
  decorators: [
    (Story) => (
      <Screen fullBleed>
        <Story />
      </Screen>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof MiniLeaguesHeader>;

export const Default: Story = {
  args: {
    onPressAdd: () => {},
  },
};

