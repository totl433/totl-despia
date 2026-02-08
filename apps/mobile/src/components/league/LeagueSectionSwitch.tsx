import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TotlText, useTokens } from '@totl/ui';

import type { RootStackParamList } from '../../navigation/AppNavigator';

type Section = 'miniLeague' | 'chat';

export default function LeagueSectionSwitch({
  active,
  leagueId,
  name,
}: {
  active: Section;
  leagueId: string;
  name: string;
}) {
  const t = useTokens();
  const navigation = useNavigation<any>();

  const pillStyle = (selected: boolean) => ({
    flex: 1,
    height: 36,
    borderRadius: 999,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: selected ? '#1C8376' : 'transparent',
  });

  const textStyle = (selected: boolean) => ({
    color: selected ? '#FFFFFF' : t.color.muted,
    fontFamily: 'Gramatika-Medium',
    fontWeight: '700' as const,
    fontSize: 13,
    lineHeight: 13,
  });

  return (
    <View style={{ paddingHorizontal: t.space[4], paddingBottom: t.space[2] }}>
      <View
        style={{
          flexDirection: 'row',
          borderRadius: 999,
          borderWidth: 1,
          borderColor: t.color.border,
          backgroundColor: t.color.surface,
          padding: 3,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mini league section"
          onPress={() => {
            if (active === 'miniLeague') return;
            const params = { leagueId: String(leagueId), name: String(name) } satisfies RootStackParamList['LeagueDetail'];
            if (typeof navigation.replace === 'function') navigation.replace('LeagueDetail', params);
            else navigation.navigate('LeagueDetail', params);
          }}
          style={({ pressed }) => ({
            flex: 1,
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <View style={pillStyle(active === 'miniLeague')}>
            <TotlText style={textStyle(active === 'miniLeague')}>Mini league</TotlText>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chat section"
          onPress={() => {
            if (active === 'chat') return;
            const params = { leagueId: String(leagueId), name: String(name) } satisfies RootStackParamList['LeagueChat'];
            if (typeof navigation.replace === 'function') navigation.replace('LeagueChat', params);
            else navigation.navigate('LeagueChat', params);
          }}
          style={({ pressed }) => ({
            flex: 1,
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <View style={pillStyle(active === 'chat')}>
            <TotlText style={textStyle(active === 'chat')}>Chat</TotlText>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

