import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Screen, TotlText, useTokens } from '@totl/ui';

import type { RootStackParamList } from '../navigation/AppNavigator';
import { getMiniLeagueInvite, joinLeagueByCode } from '../services/leagues';

type InviteLeague = {
  id: string;
  name: string;
};

/**
 * Confirmation screen for mini-league invite links.
 */
export default function JoinMiniLeagueScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'JoinMiniLeague'>>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const t = useTokens();
  const code = route.params.code.trim().toUpperCase();
  const [league, setLeague] = React.useState<InviteLeague | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [joining, setJoining] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const data = await getMiniLeagueInvite(code);
        if (cancelled) return;
        setLeague({ id: data.id, name: data.name });
      } catch (lookupError) {
        if (cancelled) return;
        setError(
          lookupError instanceof Error
            ? lookupError.message
            : 'This invite is invalid or the mini league is no longer available.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleJoin = async () => {
    if (joining) return;
    setJoining(true);
    setError(null);
    const result = await joinLeagueByCode(code);
    if (!result.ok) {
      setError(result.error);
      setJoining(false);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['leagues'] });
    navigation.replace('LeagueDetail', {
      leagueId: result.league.id,
      name: result.league.name,
      initialTab: 'predictions',
    });
  };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <TotlText variant="muted" style={{ textAlign: 'center', marginBottom: 10 }}>
          MINI LEAGUE INVITE
        </TotlText>
        <TotlText variant="heading" style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>
          {loading ? 'Opening invite…' : league?.name ?? 'Invite unavailable'}
        </TotlText>
        <TotlText variant="muted" style={{ textAlign: 'center', marginBottom: 28 }}>
          {loading
            ? 'Checking the invite.'
            : league
              ? `You've been invited to join ${league.name} on TOTL.`
              : error}
        </TotlText>

        {league ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleJoin()}
            disabled={joining}
            style={({ pressed }) => ({
              backgroundColor: t.color.brand,
              borderRadius: 12,
              paddingVertical: 15,
              alignItems: 'center',
              opacity: joining ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            <TotlText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
              {joining ? 'Joining…' : 'Join mini league'}
            </TotlText>
          </Pressable>
        ) : null}

        {error && league ? (
          <TotlText style={{ color: '#DC2626', textAlign: 'center', marginTop: 14 }}>{error}</TotlText>
        ) : null}

        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={{ padding: 16 }}>
          <TotlText variant="muted" style={{ textAlign: 'center' }}>
            Cancel
          </TotlText>
        </Pressable>
      </View>
    </Screen>
  );
}
