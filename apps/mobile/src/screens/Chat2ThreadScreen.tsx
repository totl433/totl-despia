import React from 'react';
import { Alert, Keyboard, Pressable, Share, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTokens } from '@totl/ui';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import LeagueChatTabV2 from '../components/chat/LeagueChatTabV2';
import LeagueInviteSheet from '../components/league/LeagueInviteSheet';
import LeagueOverflowMenu, { type LeagueOverflowAction } from '../components/league/LeagueOverflowMenu';
import CenteredSpinner from '../components/CenteredSpinner';
import { env } from '../env';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';
import { resolveLeagueAvatarUri } from '../lib/leagueAvatars';
import ChatStackHeaderTitle from '../components/chat/ChatStackHeaderTitle';

export default function Chat2ThreadScreen() {
  const route = useRoute<any>();
  const params = route.params as RootStackParamList['Chat2Thread'];
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const t = useTokens();

  const leagueId = String(params.leagueId);
  const leagueName = String(params.name ?? '');

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteMode, setInviteMode] = React.useState<'league' | 'chat'>('chat');
  const [leavingLeague, setLeavingLeague] = React.useState(false);

  const { optimisticallyClear } = useLeagueUnreadCounts();
  React.useEffect(() => {
    optimisticallyClear(leagueId);
  }, [leagueId, optimisticallyClear]);

  type LeagueMembersResponse = Awaited<ReturnType<typeof api.getLeague>>;
  const { data: leagueDetails, isLoading, error } = useQuery<LeagueMembersResponse>({
    enabled: true,
    queryKey: ['league', leagueId],
    queryFn: () => api.getLeague(leagueId),
  });
  const members = leagueDetails?.members ?? [];
  const membersForChat = React.useMemo(
    () =>
      members.map((m: any) => ({
        id: String(m.id),
        name: String(m.name ?? 'User'),
        avatar_url: typeof m.avatar_url === 'string' ? m.avatar_url : null,
      })),
    [members]
  );
  const leagueMeta = (leagueDetails?.league ?? null) as null | { id?: string; name?: string; code?: string; avatar?: string | null };
  const leagueCode = leagueMeta?.code ? String(leagueMeta.code) : null;

  const headerAvatarUri = React.useMemo(() => {
    const a = resolveLeagueAvatarUri(leagueMeta?.avatar);
    return a ?? null;
  }, [leagueMeta?.avatar]);

  const participantNamesLabel = React.useMemo(() => {
    const names = members
      .map((m: any) => String(m?.name ?? '').trim())
      .filter(Boolean);

    const seen = new Set<string>();
    const unique: string[] = [];
    names.forEach((n) => {
      const k = n.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      unique.push(n);
    });
    unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const MAX = 4;
    if (unique.length <= MAX) return unique.join(', ');
    return `${unique.slice(0, MAX).join(', ')} +${unique.length - MAX}`;
  }, [members]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <ChatStackHeaderTitle
          title={leagueName || 'Chat'}
          subtitle={participantNamesLabel || 'Chat'}
          avatarUri={headerAvatarUri}
        />
      ),
      headerRight: () => (
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setMenuOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Menu"
          hitSlop={10}
          style={({ pressed }) => ({ paddingHorizontal: 10, opacity: pressed ? 0.85 : 1 })}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={t.color.text} />
        </Pressable>
      ),
    });
  }, [headerAvatarUri, leagueName, navigation, participantNamesLabel, t.color.text]);

  const handleMenuAction = React.useCallback(
    async (action: LeagueOverflowAction) => {
      setMenuOpen(false);

      if (action === 'shareLeagueCode') {
        try {
          const shareText = `Join the chat for "${leagueName || 'my mini league'}" on TotL!`;
          const base = String(env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
          const url = leagueCode && base ? `${base}/league/${encodeURIComponent(leagueCode)}?tab=chat` : null;
          await Share.share({ message: url ? `${shareText}\n${url}` : `${shareText}\nCode: ${leagueCode ?? ''}`.trim() });
        } catch {
          // ignore
        }
        return;
      }

      if (action === 'leave') {
        if (leavingLeague) return;
        setLeavingLeague(true);
        try {
          const { data } = await supabase.auth.getUser();
          const userId = data.user?.id ? String(data.user.id) : null;
          if (!userId) throw new Error('Not logged in.');

          const { error: delErr } = await (supabase as any)
            .from('league_members')
            .delete()
            .eq('league_id', leagueId)
            .eq('user_id', userId);
          if (delErr) throw delErr;

          await queryClient.invalidateQueries({ queryKey: ['leagues'] });
          navigation.goBack();
        } catch (e: any) {
          Alert.alert('Couldn’t leave league', e?.message ?? 'Failed to leave league. Please try again.', [{ text: 'OK' }]);
        } finally {
          setLeavingLeague(false);
        }
        return;
      }

      if (action === 'inviteLeague' || action === 'inviteChat') {
        setInviteMode(action === 'inviteChat' ? 'chat' : 'league');
        setInviteOpen(true);
      }
    },
    [leagueCode, leagueId, leagueName, leavingLeague, navigation, queryClient]
  );

  if (isLoading && !leagueDetails && !error) {
    return (
      <View style={{ flex: 1 }}>
        <CenteredSpinner loading />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <LeagueChatTabV2
            leagueId={leagueId}
            members={membersForChat}
          />
        </View>

        <LeagueOverflowMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onAction={handleMenuAction}
          extraItems={[
            {
              key: 'view-mini-league',
              label: 'Go to mini league',
              icon: <Ionicons name="trophy-outline" size={18} color="#000000" />,
              onPress: () => {
                setMenuOpen(false);
                navigation.navigate('LeagueDetail' as any, { leagueId, name: leagueName });
              },
            },
          ]}
          showBadgeActions={false}
          showResetBadge={false}
          showCoreActions={false}
        />

        {leagueCode ? (
          <LeagueInviteSheet
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            leagueName={leagueName}
            leagueCode={leagueCode}
            title={inviteMode === 'chat' ? 'Invite to chat' : 'Invite to mini league'}
            shareTextOverride={inviteMode === 'chat' ? `Join the chat for "${leagueName || 'my mini league'}" on TotL!` : undefined}
            urlOverride={
              inviteMode === 'chat'
                ? `${String(env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')}/league/${encodeURIComponent(leagueCode)}?tab=chat`
                : undefined
            }
          />
        ) : null}
      </View>
    </View>
  );
}
