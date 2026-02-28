import type { Meta, StoryObj } from '@storybook/react-native';
import React from 'react';
import { View, Pressable } from 'react-native';
import { Screen, TotlText, useTokens } from '@totl/ui';

function SectionSwitchDemo({ active }: { active: 'miniLeague' | 'chat' }) {
  const t = useTokens();
  const pillStyle = (selected: boolean) => ({
    flex: 1,
    height: 36,
    borderRadius: 999,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: selected ? t.color.brand : 'transparent',
  });
  const textStyle = (selected: boolean) => ({
    color: selected ? '#FFFFFF' : t.color.muted,
    fontFamily: t.font.medium,
    fontSize: 13,
    lineHeight: 13,
  });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', backgroundColor: t.color.surface2, borderRadius: 999, padding: 4 }}>
        <View style={pillStyle(active === 'miniLeague')}>
          <TotlText style={textStyle(active === 'miniLeague')}>Mini league</TotlText>
        </View>
        <View style={pillStyle(active === 'chat')}>
          <TotlText style={textStyle(active === 'chat')}>Chat</TotlText>
        </View>
      </View>
    </Screen>
  );
}

const meta: Meta = {
  title: 'League/LeagueSectionSwitch',
};

export default meta;
type Story = StoryObj;

export const MiniLeagueActive: Story = {
  render: () => <SectionSwitchDemo active="miniLeague" />,
};

export const ChatActive: Story = {
  render: () => <SectionSwitchDemo active="chat" />,
};
