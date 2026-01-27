import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { Pressable } from 'react-native';
import { Screen, TotlText, useTokens } from '@totl/ui';

import PageHeader from '../components/PageHeader';

const meta: Meta<typeof PageHeader> = {
  title: 'App/PageHeader',
  component: PageHeader,
  decorators: [
    (Story) => (
      <Screen fullBleed>
        <Story />
      </Screen>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

function AddButton({ onPress }: { onPress: () => void }) {
  const t = useTokens();
  const SIZE = 46;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add"
      style={({ pressed }) => ({
        width: SIZE,
        height: SIZE,
        borderRadius: 999,
        backgroundColor: t.color.brand,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 22, lineHeight: 22 }}>+</TotlText>
    </Pressable>
  );
}

export const TitleOnly: Story = {
  args: {
    title: 'Predictions',
  },
};

export const TitleAndSubtitle: Story = {
  args: {
    title: 'Mini Leagues',
    subtitle: 'Create or join a private league with friends. Let the rivalry begin.',
  },
};

export const WithRightAction: Story = {
  args: {
    title: 'Mini Leagues',
    subtitle: 'Create or join a private league with friends. Let the rivalry begin.',
    rightAction: <AddButton onPress={() => {}} />,
  },
};

