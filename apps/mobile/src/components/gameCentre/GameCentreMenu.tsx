import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TotlText, useTokens } from '@totl/ui';

import HeaderTotlLogo from '../HeaderTotlLogo';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useViewerSeason } from '../../lib/useViewerSeason';
import { playersDayKey } from '../../lib/retroPlayers/day';
import { readSharedPlayersScores } from '../../lib/retroPlayers/scores';
import { playersOverallRank, playersStreak } from '../../lib/retroPlayers/stats';
import { PLAYERS_MENU_PLAYERS_XML, PLAYERS_MENU_THE_XML } from './playersMenuWordmark';

type Destination = 'players' | 'predictions' | 'leagues' | 'leaderboards' | 'season' | 'profile';

function Chevron({ color }: { color: string }) {
  return <Ionicons name="chevron-forward" size={18} color={color} />;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        height: 28,
        paddingHorizontal: 6,
        borderRadius: 42,
        backgroundColor: 'rgba(88,89,89,0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {children as any}
    </View>
  );
}

/**
 * The side menu (Figma 272:33946). Every row opens a screen that the bottom bar used to,
 * through the same routes; The Players shows the same streak and rank as its Home card.
 */
export default function GameCentreMenu({ onNavigate }: { onNavigate: (go: () => void) => void }) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { seasonLabel } = useViewerSeason();

  const { data: authUser } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
    staleTime: 60_000,
  });
  const userId = authUser?.id ? String(authUser.id) : null;

  const { data: profile } = useQuery({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });

  const { data: playersScoresByUser } = useQuery({
    queryKey: ['players-shared-scores', userId],
    enabled: !!userId,
    queryFn: readSharedPlayersScores,
    staleTime: 60_000,
  });
  const streak = userId && playersScoresByUser ? playersStreak(playersScoresByUser[userId] ?? {}, playersDayKey()) : 0;
  const rank = userId && playersScoresByUser ? playersOverallRank(playersScoresByUser, userId) : null;

  const go = React.useCallback(
    (destination: Destination) => {
      onNavigate(() => {
        switch (destination) {
          case 'players':
            navigation.navigate('RetroTotlDailyPlayersFlow');
            return;
          case 'predictions':
            navigation.navigate('Tabs', { screen: 'Predictions', params: { screen: 'HomeMain' } });
            return;
          case 'leagues':
            navigation.navigate('Tabs', { screen: 'Leagues', params: { screen: 'LeaguesList' } });
            return;
          case 'leaderboards':
            navigation.navigate('Tabs', { screen: 'BrandedLeaderboards' });
            return;
          case 'season':
            navigation.navigate('Tabs', { screen: 'Global' });
            return;
          case 'profile':
            navigation.navigate('Profile');
        }
      });
    },
    [navigation, onNavigate]
  );

  const ink = t.color.text;
  const rows: Array<{ key: Destination; label: string }> = [
    { key: 'predictions', label: 'Predictions' },
    { key: 'leagues', label: 'Mini leagues' },
    { key: 'leaderboards', label: 'Leaderboards' },
    { key: 'season', label: seasonLabel },
  ];
  const name = profile?.name?.trim() || 'Profile';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.color.background,
        paddingTop: insets.top + 12,
        paddingBottom: Math.max(insets.bottom, 16) + 12,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <HeaderTotlLogo width={76} height={68} />
      </View>

      <View style={{ flex: 1, marginTop: 80, justifyContent: 'space-between' }}>
        <View style={{ gap: 31 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={[
              'The Players, daily quiz',
              streak >= 1 ? `${streak} day streak` : null,
              rank ? `ranked ${rank}` : null,
            ]
              .filter(Boolean)
              .join(', ')}
            onPress={() => go('players')}
            style={({ pressed }) => ({ paddingHorizontal: 20, gap: 12, opacity: pressed ? 0.7 : 1 })}
          >
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 10.8 }}>
                <SvgXml xml={PLAYERS_MENU_THE_XML} width={45.33} height={27.46} color={ink} />
                <SvgXml xml={PLAYERS_MENU_PLAYERS_XML} width={115.2} height={27.46} color={ink} />
              </View>
              <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 16, lineHeight: 19, letterSpacing: -0.05, color: t.color.muted }}>
                Daily Quiz
              </TotlText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {streak >= 1 ? (
                  <Pill>
                    <Text style={{ fontSize: 16 }}>🔥</Text>
                    <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 14, lineHeight: 19, color: ink }}>{streak}</TotlText>
                  </Pill>
                ) : null}
                {rank ? (
                  <Pill>
                    <Ionicons name="globe-outline" size={14} color={ink} />
                    {/* System font, as in the design's SF Pro pill. */}
                    <Text style={{ fontSize: 14, fontWeight: '500', color: ink }}>{rank}</Text>
                  </Pill>
                ) : null}
              </View>
              <Chevron color={ink} />
            </View>
          </Pressable>

          <View style={{ borderTopWidth: 1, borderTopColor: t.color.border, paddingTop: 24, gap: 22 }}>
            {rows.map((row) => (
              <Pressable
                key={row.key}
                accessibilityRole="button"
                onPress={() => go(row.key)}
                style={({ pressed }) => ({
                  paddingHorizontal: 20,
                  minHeight: 28,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <TotlText style={{ fontSize: 20, lineHeight: 24, color: ink }}>{row.label}</TotlText>
                <Chevron color={ink} />
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}, profile`}
          onPress={() => go('profile')}
          style={({ pressed }) => ({
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFCC8A' }}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{ width: 32, height: 32 }} resizeMode="cover" />
              ) : null}
            </View>
            <TotlText numberOfLines={1} style={{ flexShrink: 1, fontSize: 20, lineHeight: 24, color: ink }}>
              {name}
            </TotlText>
          </View>
          <Chevron color={ink} />
        </Pressable>
      </View>
    </View>
  );
}
