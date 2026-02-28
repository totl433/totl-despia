import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, TotlText, useTokens } from '@totl/ui';
import WinnerShimmer from '../components/WinnerShimmer';

function ShimmerDemo({ tint }: { tint: 'white' | 'gold' }) {
  const t = useTokens();
  return (
    <Screen>
      <View style={{ height: 60, borderRadius: 12, overflow: 'hidden', position: 'relative', marginBottom: 16 }}>
        <LinearGradient
          colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint={tint} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <TotlText style={{ color: '#FFFFFF', fontFamily: t.font.medium, fontSize: 16 }}>
            Winner!
          </TotlText>
        </View>
      </View>
    </Screen>
  );
}

const meta: Meta<typeof WinnerShimmer> = {
  title: 'App/WinnerShimmer',
  component: WinnerShimmer,
};

export default meta;
type Story = StoryObj<typeof WinnerShimmer>;

export const WhiteTint: Story = {
  render: () => <ShimmerDemo tint="white" />,
};

export const GoldTint: Story = {
  render: () => <ShimmerDemo tint="gold" />,
};
