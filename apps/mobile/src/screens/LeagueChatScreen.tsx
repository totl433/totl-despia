import React from 'react';
import { Alert, Share, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, useTokens } from '@totl/ui';
import type { HomeSnapshot } from '@totl/domain';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { LeaguesStackParamList } from '../navigation/LeaguesNavigator';
import { resolveLeagueAvatarUri } from '../lib/leagueAvatars';
import LeagueHeader from '../components/league/LeagueHeader';
import LeagueChatTab from '../components/chat/LeagueChatTab';
import LeagueInviteSheet from '../components/league/LeagueInviteSheet';
import LeagueOverflowMenu, { type LeagueOverflowAction } from '../components/league/LeagueOverflowMenu';
import LeagueSectionSwitch from '../components/league/LeagueSectionSwitch';
import { env } from '../env';
import CenteredSpinner from '../components/CenteredSpinner';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';
import { resolveLeagueStartGw } from '../lib/leagueStart';

export default function LeagueChatScreen() {
  const route = useRoute<any>();
  const params = route.params as LeaguesStackParamList['LeagueChat'];
  const t = useTokens();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const leagueId = String(params.leagueId);
  const leagueName = String(params.name ?? '');

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteMode, setInviteMode] = React.useState<'league' | 'chat'>('league');
  const [leavingLeague, setLeavingLeague] = React.useState(false);

  const { optimisticallyClear } = useLeagueUnreadCounts();
  React.useEffect(() => {
    optimisticallyClear(leagueId);
  }, [leagueId, optimisticallyClear]);

  const { data: home } = useQuery<HomeSnapshot>({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });
  const currentGw = home?.currentGw ?? home?.viewingGw ?? null;

  type LeagueMembersResponse = Awaited<ReturnType<typeof api.getLeague>>;
  const { data: leagueDetails, isLoading, error } = useQuery<LeagueMembersResponse>({
    enabled: true,
    queryKey: ['league', leagueId],
    queryFn: () => api.getLeague(leagueId),
  });

  const leagueMeta = (leagueDetails?.league ?? null) as null | { id?: string; name?: string; code?: string; created_at?: string | null; avatar?: string | null };
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

  const headerAvatarUri = React.useMemo(() => {
    const a = resolveLeagueAvatarUri(leagueMeta?.avatar);
    return a ?? null;
  }, [leagueMeta?.avatar]);

  const handleMenuAction = React.useCallback(
    async (action: LeagueOverflowAction) => {
      setMenuOpen(false);

      if (action === 'shareLeagueCode') {
        try {
          const shareText = `Join my mini league "${leagueName || 'my mini league'}" on TotL!`;
          const code = leagueMeta?.code ? String(leagueMeta.code) : null;
          const base = String(env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
          const url = code && base ? `${base}/league/${encodeURIComponent(code)}` : null;
          await Share.share({ message: url ? `${shareText}\n${url}` : `${shareText}\nCode: ${code ?? ''}`.trim() });
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
          navigation.navigate('LeaguesList');
        } catch (e: any) {
          Alert.alert('Couldn’t leave league', e?.message ?? 'Failed to leave league. Please try again.', [{ text: 'OK' }]);
        } finally {
          setLeavingLeague(false);
        }
        return;
      }

      if (action === 'inviteLeague' || action === 'inviteChat') {
        setInviteMode(action === 'inviteChat' ? 'chat' : 'league');
        // Respect the same time-based membership restrictions.
        try {
          const gw = typeof currentGw === 'number' ? currentGw : null;
          const createdAt = typeof leagueMeta?.created_at === 'string' ? leagueMeta.created_at : null;
          const startGw = gw ? await resolveLeagueStartGw({ id: leagueId, name: leagueName, created_at: createdAt }, gw) : null;
          const locked = gw !== null && startGw !== null && gw - startGw >= 4;
          if (locked) {
            Alert.alert(
              'League Locked',
              'This league has been running for more than 4 gameweeks. New members can only be added during the first 4 gameweeks.',
              [{ text: 'OK' }]
            );
            return;
          }
          setInviteOpen(true);
        } catch {
          setInviteOpen(true);
        }
        return;
      }
    },
    [currentGw, leagueId, leagueMeta?.code, leagueMeta?.created_at, leavingLeague, leagueName, navigation, queryClient]
  );

  if (isLoading && !leagueDetails && !error) {
    return (
      <Screen fullBleed>
        <CenteredSpinner loading />
      </Screen>
    );
  }

  return (
    <Screen fullBleed>
      <View style={{ flex: 1 }}>
        <LeagueHeader
          title={leagueName}
          subtitle="Chat"
          avatarUri={headerAvatarUri}
          onPressBack={() => navigation.goBack()}
          onPressMenu={() => setMenuOpen(true)}
        />

        <LeagueSectionSwitch active="chat" leagueId={leagueId} name={leagueName} />

        <View style={{ flex: 1 }}>
          <LeagueChatTab leagueId={leagueId} members={membersForChat} />
        </View>

        <LeagueOverflowMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onAction={handleMenuAction}
          showBadgeActions={false}
          showResetBadge={false}
        />

        {leagueMeta?.code ? (
          <LeagueInviteSheet
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            leagueName={leagueName}
            leagueCode={String(leagueMeta.code)}
            title={inviteMode === 'chat' ? 'Invite to chat' : 'Invite to mini league'}
            shareTextOverride={
              inviteMode === 'chat'
                ? `Join the chat for "${leagueName || 'my mini league'}" on TotL!`
                : undefined
            }
            urlOverride={
              inviteMode === 'chat'
                ? `${String(env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')}/league/${encodeURIComponent(String(leagueMeta.code))}?tab=chat`
                : undefined
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}

