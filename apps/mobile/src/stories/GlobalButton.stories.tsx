import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';
import { Screen } from '@totl/ui';
import { View } from 'react-native';

import GlobalButton from '../components/GlobalButton';

const meta: Meta<typeof GlobalButton> = {
  title: 'primitives/GlobalButton',
  component: GlobalButton,
  decorators: [
    (Story) => (
      <Screen fullBleed style={{ padding: 16 }}>
        <View style={{ gap: 12 }}>
          <Story />
        </View>
      </Screen>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof GlobalButton>;

export const Primary: Story = {
  args: { title: 'Create or Join', variant: 'primary', size: 'md', onPress: () => {} },
};

export const SecondaryInactive: Story = {
  args: { title: 'Join', variant: 'secondary', size: 'sm', active: false, disabled: true, onPress: () => {} },
};

export const SecondaryActive: Story = {
  args: { title: 'Join', variant: 'secondary', size: 'sm', active: true, disabled: false, onPress: () => {} },
};

