import React from 'react';
import { Alert, Image, Pressable, Share, ScrollView, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, TotlText, useTokens } from '@totl/ui';
import type { Fixture, GwResultRow, HomeSnapshot, LiveScore, LiveStatus, Pick } from '@totl/domain';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
// Expo SDK 54: legacy async APIs (getInfoAsync/readAsStringAsync) moved under `expo-file-system/legacy`.
// Using the non-legacy import can surface deprecation errors in some runtimes.
import * as FileSystem from 'expo-file-system/legacy';
import { resolveLeagueAvatarUri } from '../lib/leagueAvatars';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/AppNavigator';
import LeagueHeader from '../components/league/LeagueHeader';
import LeagueTabBar, { type LeagueTabKey } from '../components/league/LeagueTabBar';
import LeagueGwTable, { type LeagueGwTableRow } from '../components/league/LeagueGwTable';
import LeagueWinnerBanner from '../components/league/LeagueWinnerBanner';
import LeagueGwControlsRow from '../components/league/LeagueGwControlsRow';
import LeagueRulesSheet from '../components/league/LeagueRulesSheet';
import LeagueSeasonTable, { type LeagueSeasonRow } from '../components/league/LeagueSeasonTable';
import LeaguePointsFormToggle from '../components/league/LeaguePointsFormToggle';
import LeagueSeasonRulesSheet from '../components/league/LeagueSeasonRulesSheet';
import LeaguePillButton from '../components/league/LeaguePillButton';
import LeagueSubmissionStatusCard from '../components/league/LeagueSubmissionStatusCard';
import type { LeaguePick } from '../components/league/LeaguePickPill';
import MiniFixtureCard from '../components/home/MiniFixtureCard';
import LeaguePickChipsRow from '../components/league/LeaguePickChipsRow';
import { TotlRefreshControl } from '../lib/refreshControl';
import LeagueOverflowMenu, { type LeagueOverflowAction } from '../components/league/LeagueOverflowMenu';
import LeagueInviteSheet from '../components/league/LeagueInviteSheet';
import LeagueManagementSheet, { type LeagueManagementMember } from '../components/league/LeagueManagementSheet';
import { env } from '../env';
import { resolveLeagueStartGw } from '../lib/leagueStart';
import { getGameweekStateFromSnapshot, type GameweekState } from '../lib/gameweekState';
import CenteredSpinner from '../components/CenteredSpinner';
import SectionHeaderRow from '../components/home/SectionHeaderRow';
import { Ionicons } from '@expo/vector-icons';
import { useLiveScores } from '../hooks/useLiveScores';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';
import { TEAM_BADGES } from '../lib/teamBadges';
import { getMediumName } from '../../../../src/lib/teamNames';
import {
  buildDevFixturePicks,
  DEV_FAKE_LEAGUE_MEMBERS,
  isDevFakeLeagueId,
} from '../lib/devFakeLeague';
import { useThemePreference } from '../context/ThemePreferenceContext';

const LEAGUE_TABS: LeagueTabKey[] = ['gwTable', 'predictions', 'season'];

function fixtureKickoffTimeLabel(kickoff: string | null | undefined) {
  if (!kickoff) return 'KO';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return 'KO';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatMinute(status: LiveStatus, minute: number | null | undefined) {
  if (status === 'FINISHED') return 'FT';
  if (status === 'PAUSED') return 'HT';
  if (status === 'IN_PLAY') return typeof minute === 'number' ? `${minute}'` : 'LIVE';
  return '';
}

function base64ToUint8Array(base64: string): Uint8Array {
  // RN-safe base64 decode (atob is available in Hermes/JSC for RN; if not, we'll fail loudly).
  const binary = globalThis.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function LeagueDetailScreen() {
  const route = useRoute<any>();
  const params = route.params as RootStackParamList['LeagueDetail'];
  const t = useTokens();
  const { isDark } = useThemePreference();
  const menuTextColor = isDark ? '#F8FAFC' : t.color.text;
  const { height: screenHeight } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<LeagueTabKey>(
    params.initialTab && LEAGUE_TABS.includes(params.initialTab) ? params.initialTab : 'gwTable'
  );
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [manageSheetOpen, setManageSheetOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteMode, setInviteMode] = React.useState<'league' | 'chat'>('league');
  const [avatarOverrideUri, setAvatarOverrideUri] = React.useState<string | null>(null);
  const [leavingLeague, setLeavingLeague] = React.useState(false);
  const [predictionsLayout, setPredictionsLayout] = React.useState<'expanded' | 'mini'>('expanded');
  const [miniExpandedFixtureId, setMiniExpandedFixtureId] = React.useState<string | null>(null);
  const chatMlHopCount = typeof params.chatMlHopCount === 'number' ? params.chatMlHopCount : 0;
  const isDevFakeLeague = isDevFakeLeagueId(String(params.leagueId));
  const predictionsScrollRef = React.useRef<ScrollView | null>(null);
  const predictionsScrollYRef = React.useRef(0);
  const fixtureNodeRefs = React.useRef<Record<string, View | null>>({});
  const miniLayoutTransition = React.useMemo(
    () => LinearTransition.springify().damping(42).stiffness(260).mass(0.7),
    []
  );

  type LeaguesResponse = Awaited<ReturnType<typeof api.listLeagues>>;
  type LeagueSummary = LeaguesResponse['leagues'][number];

  const { data: leagues } = useQuery({
    enabled: !isDevFakeLeague,
    queryKey: ['leagues'],
    queryFn: () => api.listLeagues(),
  });

  const leagueFromList = React.useMemo(() => {
    const list: LeagueSummary[] = leagues?.leagues ?? [];
    return list.find((l) => String(l.id) === String(params.leagueId)) ?? null;
  }, [leagues?.leagues, params.leagueId]);

  const avatarUriFromList =
    leagueFromList && typeof leagueFromList.avatar === 'string' && leagueFromList.avatar.startsWith('http')
      ? leagueFromList.avatar
      : null;

  const { data: home, refetch: refetchHome, isRefetching: homeRefetching } = useQuery<HomeSnapshot>({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
  });
  const viewingGw = home?.viewingGw ?? null;
  const currentGw = home?.currentGw ?? viewingGw ?? null;
  // Season standings should align to the GW context the user is currently viewing.
  const seasonGw = typeof viewingGw === 'number' ? viewingGw : currentGw;
  const seasonGwState = React.useMemo(() => {
    if (!home) return null;
    return getGameweekStateFromSnapshot({
      fixtures: home.fixtures ?? [],
      liveScores: home.liveScores ?? [],
      hasSubmittedViewingGw: !!home.hasSubmittedViewingGw,
      now: new Date(),
    });
  }, [home]);

  const [selectedGw, setSelectedGw] = React.useState<number | null>(null);
  React.useEffect(() => {
    // Default GW table behavior:
    // - If user is still viewing an older GW, use that GW.
    // - If user is on the newest GW, keep table on previous GW until newest GW is LIVE.
    // - Only initialize once (don’t override manual selection).
    if (selectedGw !== null) return;

    const clampGw = (gw: number) => Math.max(1, Math.trunc(gw));

    if (typeof viewingGw === 'number' && typeof currentGw === 'number') {
      if (viewingGw < currentGw) {
        setSelectedGw(clampGw(viewingGw));
        return;
      }

      if (viewingGw >= currentGw) {
        const shouldUseCurrentGw = seasonGwState === 'LIVE';
        setSelectedGw(clampGw(shouldUseCurrentGw ? currentGw : currentGw - 1));
        return;
      }
    }

    if (typeof viewingGw === 'number') {
      const shouldUseViewingGw = seasonGwState === 'LIVE';
      setSelectedGw(clampGw(shouldUseViewingGw ? viewingGw : viewingGw - 1));
      return;
    }

    if (typeof currentGw === 'number') {
      const shouldUseCurrentGw = seasonGwState === 'LIVE';
      setSelectedGw(clampGw(shouldUseCurrentGw ? currentGw : currentGw - 1));
    }
  }, [currentGw, seasonGwState, selectedGw, viewingGw]);

  const availableGws = React.useMemo(() => {
    const maxGw = typeof currentGw === 'number' ? currentGw : typeof viewingGw === 'number' ? viewingGw : null;
    if (!maxGw || maxGw < 1) return [];
    return Array.from({ length: maxGw }, (_, i) => i + 1);
  }, [currentGw, viewingGw]);

  type LeagueTableResponse = Awaited<ReturnType<typeof api.getLeagueGwTable>>;
  const leagueId = String(params.leagueId);
  const { unreadByLeagueId } = useLeagueUnreadCounts();
  const leagueUnreadCount = Number(unreadByLeagueId?.[leagueId] ?? 0);
  const { data: table, isLoading: tableLoading, refetch: refetchTable, isRefetching: tableRefetching } = useQuery<LeagueTableResponse>({
    enabled: tab === 'gwTable' && typeof selectedGw === 'number' && !isDevFakeLeague,
    queryKey: ['leagueGwTable', leagueId, selectedGw],
    queryFn: () => api.getLeagueGwTable(leagueId, selectedGw as number),
  });

  type LeagueMembersResponse = Awaited<ReturnType<typeof api.getLeague>>;
  const { data: leagueDetails, refetch: refetchLeagueDetails, isRefetching: leagueDetailsRefetching } = useQuery<LeagueMembersResponse>({
    // Needed across tabs (chat avatars + menu actions).
    enabled: !isDevFakeLeague,
    queryKey: ['league', leagueId],
    queryFn: () => api.getLeague(leagueId),
  });
  const members = isDevFakeLeague ? DEV_FAKE_LEAGUE_MEMBERS : (leagueDetails?.members ?? []);
  const leagueMeta = (leagueDetails?.league ?? null) as null | {
    id?: string;
    name?: string;
    code?: string;
    created_at?: string | null;
    avatar?: string | null;
  };

  const { data: adminData } = useQuery({
    enabled: !isDevFakeLeague && !!leagueId,
    queryKey: ['leagueAdmin', leagueId],
    queryFn: () => api.getLeagueAdmin(leagueId),
  });
  const isAdmin = !isDevFakeLeague && !!adminData?.isAdmin;

  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (alive && data?.user?.id) setCurrentUserId(String(data.user.id));
    })();
    return () => {
      alive = false;
    };
  }, []);
  const headerAvatarUri = React.useMemo(() => {
    if (typeof avatarOverrideUri === 'string' && avatarOverrideUri.startsWith('http')) return avatarOverrideUri;
    const a1 = resolveLeagueAvatarUri(leagueMeta?.avatar);
    if (a1) return a1;
    return resolveLeagueAvatarUri(avatarUriFromList);
  }, [avatarOverrideUri, avatarUriFromList, leagueMeta?.avatar]);

  const gwTableMergedRows = React.useMemo((): LeagueGwTableRow[] => {
    const tbl = table as { rows?: LeagueGwTableRow[]; submittedUserIds?: string[] } | null | undefined;
    if (!tbl?.rows || !members.length) return [];
    const rowsByUserId = new Map(tbl.rows.map((r) => [r.user_id, r]));
    const submittedSet = new Set((tbl.submittedUserIds ?? []).map(String));
    const result: LeagueGwTableRow[] = members.map((m: { id?: string; name?: string }) => {
      const id = String(m.id ?? '');
      const row = rowsByUserId.get(id);
      if (row) return row;
      return { user_id: id, name: String(m.name ?? 'User'), score: 0, unicorns: 0 };
    });
    result.sort((a, b) => {
      const aSub = submittedSet.has(a.user_id);
      const bSub = submittedSet.has(b.user_id);
      if (aSub && !bSub) return -1;
      if (!aSub && bSub) return 1;
      if (aSub && bSub) return b.score - a.score || b.unicorns - a.unicorns || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [table, members]);

  const allFixturesFinished = React.useMemo(() => {
    if (tab !== 'gwTable') return false;
    if (!home) return false;
    if (typeof selectedGw !== 'number') return false;
    // If the user selects a past GW, treat it as finished (we won’t have fixtures for it in the home snapshot).
    if (typeof viewingGw === 'number' && selectedGw !== viewingGw) return true;

    const fixtures: Fixture[] = home.fixtures ?? [];
    if (!fixtures.length) return false;

    const outcomes = new Set<number>();
    (home.gwResults ?? []).forEach((r: GwResultRow) => {
      if (typeof r?.fixture_index === 'number') outcomes.add(r.fixture_index);
    });

    const liveByFixtureIndex = new Map<number, LiveScore>();
    (home.liveScores ?? []).forEach((ls: LiveScore) => {
      if (typeof ls?.fixture_index === 'number') liveByFixtureIndex.set(ls.fixture_index, ls);
    });

    const hasActiveGames = fixtures.some((f: Fixture) => {
      const ls = liveByFixtureIndex.get(f.fixture_index);
      const st: LiveStatus = ls?.status ?? 'SCHEDULED';
      return st === 'IN_PLAY' || st === 'PAUSED';
    });

    const allHaveResults = fixtures.every((f: Fixture) => outcomes.has(f.fixture_index));
    const allFinishedStatus = fixtures.every((f: Fixture) => {
      const ls = liveByFixtureIndex.get(f.fixture_index);
      return ls?.status === 'FINISHED';
    });

    return (allHaveResults || allFinishedStatus) && !hasActiveGames;
  }, [home, selectedGw, tab, viewingGw]);

  const seasonShowUnicorns = members.length >= 3;
  const [seasonShowForm, setSeasonShowForm] = React.useState(false);
  const [seasonRulesOpen, setSeasonRulesOpen] = React.useState(false);
  const { data: resolvedLeagueStartGw } = useQuery<number>({
    enabled: typeof seasonGw === 'number' && !!leagueId && !isDevFakeLeague,
    queryKey: [
      'leagueStartGw',
      leagueId,
      seasonGw,
      String(leagueMeta?.name ?? params.name ?? ''),
      String(leagueMeta?.created_at ?? ''),
    ],
    queryFn: async () =>
      resolveLeagueStartGw(
        {
          id: leagueId,
          name: String(leagueMeta?.name ?? params.name ?? ''),
          created_at: typeof leagueMeta?.created_at === 'string' ? leagueMeta.created_at : undefined,
        },
        seasonGw as number
      ),
    staleTime: 5 * 60_000,
  });
  const seasonStartGwResolved = isDevFakeLeague || typeof resolvedLeagueStartGw === 'number';
  const seasonStartGw = isDevFakeLeague ? 1 : typeof resolvedLeagueStartGw === 'number' ? resolvedLeagueStartGw : 1;
  const seasonIsLateStartingLeague = seasonStartGw > 1;
  const tableAvailableGws = React.useMemo(() => availableGws.filter((gw) => gw >= seasonStartGw), [availableGws, seasonStartGw]);

  React.useEffect(() => {
    if (!seasonStartGwResolved) return;
    if (selectedGw === null) return;
    if (selectedGw >= seasonStartGw) return;
    const nextGw = tableAvailableGws[tableAvailableGws.length - 1] ?? seasonStartGw;
    setSelectedGw(nextGw);
  }, [seasonStartGw, seasonStartGwResolved, selectedGw, tableAvailableGws]);

  const handleEditBadge = React.useCallback(async () => {
    const leagueName = String(leagueMeta?.name ?? params.name ?? 'Mini league');
    if (!leagueId) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to update the league badge.', [{ text: 'OK' }]);
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (picked.canceled) return;
    const asset = picked.assets?.[0];
    const uri = asset?.uri ? String(asset.uri) : null;
    if (!uri) return;

    // Resize to match the intent of the web flow (square, small).
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 256 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
    );

    const info = await FileSystem.getInfoAsync(manipulated.uri);
    const size = typeof (info as any)?.size === 'number' ? ((info as any).size as number) : null;
    if (!info.exists || !size || size <= 0) {
      Alert.alert('Badge update failed', 'We could not read the edited image from disk. Please try again.', [{ text: 'OK' }]);
      return;
    }

    // NOTE: In Expo Go on iOS, `fetch(file://...)` can yield a 0-byte Blob.
    // Use FileSystem to read the local file reliably.
    const b64 = await FileSystem.readAsStringAsync(manipulated.uri, { encoding: 'base64' });
    const bytes = base64ToUint8Array(b64);
    if (!bytes.byteLength) {
      Alert.alert('Badge update failed', 'The edited image produced 0 bytes. Please try again.', [{ text: 'OK' }]);
      return;
    }
    const fileName = `${leagueId}-${Date.now()}.jpg`;

    const uploadRes = await (supabase as any).storage.from('league-avatars').upload(fileName, bytes, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    });
    if (uploadRes.error) throw uploadRes.error;

    const { data: publicUrlData } = (supabase as any).storage.from('league-avatars').getPublicUrl(fileName);
    const publicUrl = publicUrlData?.publicUrl ? String(publicUrlData.publicUrl) : null;
    if (!publicUrl) throw new Error('Unable to get public URL for badge.');
    setAvatarOverrideUri(publicUrl);

    // In dev, verify the URL is actually reachable (bucket might not be public).
    if (__DEV__) {
      try {
        const resp = await fetch(publicUrl, { method: 'GET' });
      } catch (e) {
      }
    }

    const updateRes = await (supabase as any).from('leagues').update({ avatar: publicUrl }).eq('id', leagueId);
    if (updateRes.error) throw updateRes.error;

    // Update caches immediately so the header avatar updates without waiting for refetch.
    queryClient.setQueryData(['league', leagueId], (prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        league: { ...(prev.league ?? {}), avatar: publicUrl },
      };
    });
    queryClient.setQueryData(['leagues'], (prev: any) => {
      const list = prev?.leagues;
      if (!Array.isArray(list)) return prev;
      return {
        ...prev,
        leagues: list.map((l: any) => (String(l?.id) === String(leagueId) ? { ...l, avatar: publicUrl } : l)),
      };
    });

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['leagues'] }),
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] }),
    ]);

    Alert.alert('Updated', `League badge updated for "${leagueName}".`, [{ text: 'OK' }]);
  }, [leagueId, leagueMeta?.name, params.name, queryClient]);

  const handleMenuAction = React.useCallback(
    async (action: LeagueOverflowAction) => {
      setMenuOpen(false);

      if (action === 'manage') {
        setManageSheetOpen(true);
        return;
      }

      if (action === 'shareLeagueCode') {
        try {
          const leagueName = String(params.name ?? 'my mini league');
          const shareText = `Join my mini league "${leagueName}" on TotL!`;
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

          const { error } = await (supabase as any)
            .from('league_members')
            .delete()
            .eq('league_id', leagueId)
            .eq('user_id', userId);
          if (error) throw error;

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
        try {
          setInviteMode(action === 'inviteChat' ? 'chat' : 'league');
          const gw = typeof currentGw === 'number' ? currentGw : null;
          const createdAt = typeof leagueMeta?.created_at === 'string' ? leagueMeta.created_at : null;
          const leagueName = String(leagueMeta?.name ?? params.name ?? '');
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
          // fail open
          setInviteOpen(true);
        }
        return;
      }

      if (action === 'editBadge') {
        try {
          await handleEditBadge();
        } catch (e: any) {
          Alert.alert('Couldn’t update badge', e?.message ?? 'Failed to upload badge. Please try again.', [{ text: 'OK' }]);
        }
        return;
      }

      if (action === 'resetBadge') {
        try {
          setAvatarOverrideUri(null);
          const updateRes = await (supabase as any).from('leagues').update({ avatar: null }).eq('id', leagueId);
          if (updateRes.error) throw updateRes.error;

          // Update caches immediately so UI clears without waiting for refetch.
          queryClient.setQueryData(['league', leagueId], (prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              league: { ...(prev.league ?? {}), avatar: null },
            };
          });
          queryClient.setQueryData(['leagues'], (prev: any) => {
            const list = prev?.leagues;
            if (!Array.isArray(list)) return prev;
            return {
              ...prev,
              leagues: list.map((l: any) => (String(l?.id) === String(leagueId) ? { ...l, avatar: null } : l)),
            };
          });

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['leagues'] }),
            queryClient.invalidateQueries({ queryKey: ['league', leagueId] }),
          ]);

          Alert.alert('Reset', 'League badge removed.', [{ text: 'OK' }]);
        } catch (e: any) {
          Alert.alert('Couldn’t reset badge', e?.message ?? 'Failed to reset badge. Please try again.', [{ text: 'OK' }]);
        }
        return;
      }
    },
    [
      currentGw,
      env.EXPO_PUBLIC_SITE_URL,
      handleEditBadge,
      leagueId,
      leagueMeta?.code,
      leagueMeta?.created_at,
      leagueMeta?.name,
      leavingLeague,
      navigation,
      queryClient,
      params.name,
    ]
  );

  const handleRemoveMember = React.useCallback(
    async (member: LeagueManagementMember) => {
      if (!leagueId) return;
      const { error } = await (supabase as any)
        .from('league_members')
        .delete()
        .eq('league_id', leagueId)
        .eq('user_id', member.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['league', leagueId] });
      await queryClient.invalidateQueries({ queryKey: ['leagues'] });
    },
    [leagueId, queryClient]
  );

  const handleEndLeague = React.useCallback(async () => {
    if (!leagueId) return;
    const { error: membersError } = await (supabase as any)
      .from('league_members')
      .delete()
      .eq('league_id', leagueId);
    if (membersError) throw membersError;
    const { error: leagueError } = await (supabase as any).from('leagues').delete().eq('id', leagueId);
    if (leagueError) throw leagueError;
    await queryClient.invalidateQueries({ queryKey: ['leagues'] });
    navigation.navigate('LeaguesList');
  }, [leagueId, navigation, queryClient]);

  const { data: seasonRows, isLoading: seasonLoading, refetch: refetchSeasonRows, isRefetching: seasonRowsRefetching } = useQuery<
    LeagueSeasonRow[]
  >({
    enabled: members.length > 0 && typeof seasonGw === 'number' && seasonStartGwResolved && !isDevFakeLeague,
    queryKey: ['leagueSeasonTable', leagueId, seasonGw, seasonStartGw, members.map((m: any) => String(m.id ?? '')).join(',')],
    queryFn: async () => {
      const memberIds = members.map((m: any) => String(m.id));
      const showUnicorns = memberIds.length >= 3;
      const latestGw = seasonGw as number;

      const [gwPointsRes, resultsRes] = await Promise.all([
        (supabase as any)
          .from('app_v_gw_points')
          .select('user_id,gw,points')
          .in('user_id', memberIds)
          .gte('gw', seasonStartGw)
          .lte('gw', latestGw),
        (supabase as any)
          .from('app_gw_results')
          .select('gw,fixture_index,result')
          .gte('gw', seasonStartGw)
          .lte('gw', latestGw),
      ]);
      if (gwPointsRes.error) throw gwPointsRes.error;
      if (resultsRes.error) throw resultsRes.error;

      const gwPointsRows: Array<{ user_id: string; gw: number; points: number }> = gwPointsRes.data ?? [];
      const results: Array<{ gw: number; fixture_index: number; result: 'H' | 'D' | 'A' | string }> = resultsRes.data ?? [];
      // IMPORTANT: fetch picks in pages to avoid silent truncation on large datasets.
      const picks: Array<{ user_id: string; gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' | string }> = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      while (true) {
        const pageRes = await (supabase as any)
          .from('app_picks')
          .select('user_id,gw,fixture_index,pick')
          .in('user_id', memberIds)
          .gte('gw', seasonStartGw)
          .lte('gw', latestGw)
          .range(from, from + PAGE_SIZE - 1);
        if (pageRes.error) throw pageRes.error;
        const page = (pageRes.data ?? []) as Array<{ user_id: string; gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' | string }>;
        picks.push(...page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      const outcomeByGwFixture = new Map<string, 'H' | 'D' | 'A'>();
      results.forEach((r) => {
        if (r.result !== 'H' && r.result !== 'D' && r.result !== 'A') return;
        outcomeByGwFixture.set(`${r.gw}:${r.fixture_index}`, r.result);
      });

      const gwsWithResults = Array.from(
        new Set(
          Array.from(outcomeByGwFixture.keys())
            .map((k) => Number.parseInt(k.split(':')[0] ?? '', 10))
            .filter((gw) => Number.isFinite(gw))
        )
      ).sort((a, b) => a - b);

      // Only count GWs with actual saved results. This prevents phantom all-draw rounds.
      let relevantGws = gwsWithResults.filter((gw) => gw >= seasonStartGw && gw <= latestGw);
      // Product rule: Season table does not include the current GW while that GW is LIVE.
      if (seasonGwState === 'LIVE') {
        relevantGws = relevantGws.filter((gw) => gw < latestGw);
      }

      if (relevantGws.length === 0) return [];

      const pointsByUserGw = new Map<string, number>();
      gwPointsRows.forEach((row) => {
        pointsByUserGw.set(`${String(row.user_id)}:${Number(row.gw)}`, Number(row.points ?? 0));
      });

      type GwScore = { user_id: string; score: number; unicorns: number };
      const perGw = new Map<number, Map<string, GwScore>>();
      relevantGws.forEach((g) => {
        const m = new Map<string, GwScore>();
        memberIds.forEach((uid) =>
          m.set(uid, {
            user_id: uid,
            // Match Leaderboards: weekly league score comes from app_v_gw_points.
            score: pointsByUserGw.get(`${uid}:${g}`) ?? 0,
            unicorns: 0,
          })
        );
        perGw.set(g, m);
      });

      const picksByGwFixture = new Map<string, Array<{ user_id: string; pick: string }>>();
      picks.forEach((p) => {
        const key = `${p.gw}:${p.fixture_index}`;
        const arr = picksByGwFixture.get(key) ?? [];
        arr.push({ user_id: p.user_id, pick: p.pick });
        picksByGwFixture.set(key, arr);
      });

      relevantGws.forEach((g) => {
        const gwMap = perGw.get(g)!;
        // Iterate outcomes for this GW (do not require all fixtures to have results).
        const outcomesForGw = Array.from(outcomeByGwFixture.entries())
          .filter(([k]) => Number.parseInt(k.split(':')[0] ?? '', 10) === g)
          .map(([k, out]) => ({ fixtureIndex: Number.parseInt(k.split(':')[1] ?? '', 10), out }))
          .filter((x) => Number.isFinite(x.fixtureIndex));

        outcomesForGw.forEach(({ fixtureIndex, out }) => {
          const these = picksByGwFixture.get(`${g}:${fixtureIndex}`) ?? [];
          const correct = these.filter((p) => p.pick === out).map((p) => p.user_id);

          if (showUnicorns && correct.length === 1) {
            const uid = correct[0];
            const row = gwMap.get(uid);
            if (row) row.unicorns += 1;
          }
        });
      });

      const mltPts = new Map<string, number>();
      const ocp = new Map<string, number>();
      const unis = new Map<string, number>();
      const wins = new Map<string, number>();
      const draws = new Map<string, number>();
      const form = new Map<string, Array<'W' | 'D' | 'L'>>();
      memberIds.forEach((uid) => {
        mltPts.set(uid, 0);
        ocp.set(uid, 0);
        unis.set(uid, 0);
        wins.set(uid, 0);
        draws.set(uid, 0);
        form.set(uid, []);
      });

      relevantGws.forEach((g) => {
        const rows = Array.from(perGw.get(g)!.values());
        rows.forEach((r) => {
          // OCP in this table should align to leaderboards for the same GW window.
          ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
          unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
        });

        rows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
        if (!rows.length) return;
        const top = rows[0];
        const coTop = rows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);

        if (coTop.length === 1) {
          mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
          wins.set(top.user_id, (wins.get(top.user_id) ?? 0) + 1);
          form.get(top.user_id)!.push('W');
          rows.slice(1).forEach((r) => form.get(r.user_id)!.push('L'));
        } else {
          coTop.forEach((r) => {
            mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
            draws.set(r.user_id, (draws.get(r.user_id) ?? 0) + 1);
            form.get(r.user_id)!.push('D');
          });
          rows
            .filter((r) => !coTop.find((t) => t.user_id === r.user_id))
            .forEach((r) => form.get(r.user_id)!.push('L'));
        }
      });

      const nameById = new Map<string, string>();
      members.forEach((m: any) => nameById.set(String(m.id), String(m.name ?? 'User')));

      const out: LeagueSeasonRow[] = memberIds.map((uid) => ({
        user_id: uid,
        name: nameById.get(uid) ?? 'User',
        mltPts: mltPts.get(uid) ?? 0,
        ocp: ocp.get(uid) ?? 0,
        unicorns: unis.get(uid) ?? 0,
        wins: wins.get(uid) ?? 0,
        draws: draws.get(uid) ?? 0,
        form: form.get(uid) ?? [],
      }));

      out.sort((a, b) => b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name));
      return out;
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    // Season standings should be stable; refresh via pull-to-refresh/navigation.
    refetchInterval: false,
  });

  const picksGw = React.useMemo(() => {
    // Use viewingGw (from user_notification_preferences.current_viewing_gw) so the Predictions tab
    // stays on the GW the user is viewing until they hit "move on". Fall back to currentGw.
    const gw = viewingGw ?? currentGw;
    return typeof gw === 'number' ? gw : null;
  }, [viewingGw, currentGw]);

  type LeaguePredictionsData = {
    picksGw: number;
    deadlinePassed: boolean;
    allSubmitted: boolean;
    submittedUserIds: string[];
    members: Array<{ id: string; name: string; avatar_url?: string | null; avatar_bg_color?: string | null }>;
    fixtures: Fixture[];
    sections: Array<{ label: string; fixtures: Fixture[] }>;
    outcomeByFixtureIndex: Record<string, LeaguePick>;
    picksByFixtureIndex: Record<string, Record<string, LeaguePick>>;
  };

  const { liveByFixtureIndex: liveByFixtureIndexRealtime } = useLiveScores(picksGw);

  const {
    data: predictions,
    refetch: refetchPredictions,
    isRefetching: predictionsRefetching,
  } = useQuery<LeaguePredictionsData>({
    enabled:
      tab === 'predictions' &&
      members.length > 0 &&
      typeof picksGw === 'number' &&
      seasonStartGwResolved &&
      picksGw >= seasonStartGw,
    // NOTE: v2 key to invalidate older persisted cache that contained Map/Set (non-serializable).
    queryKey: ['leaguePredictionsV2', leagueId, picksGw, seasonStartGw, members.map((m: any) => String(m.id)).join(',')],
    queryFn: async () => {
      const gw = picksGw as number;
      if (isDevFakeLeague) {
        const fixtures = ((home?.fixtures ?? []) as Fixture[]).filter((f) => Number(f.gw) === gw);
        const memberIds = DEV_FAKE_LEAGUE_MEMBERS.map((m) => String(m.id));
        const submittedUserIds = [...memberIds];
        const picksByFixtureIndex: Record<string, Record<string, LeaguePick>> = {};
        fixtures.forEach((f) => {
          picksByFixtureIndex[String(f.fixture_index)] = buildDevFixturePicks(memberIds, Number(f.fixture_index));
        });
        const fmt = (iso?: string | null) => {
          if (!iso) return 'Fixtures';
          const d = new Date(iso);
          if (Number.isNaN(d.getTime())) return 'Fixtures';
          return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        };
        const buckets = new Map<string, { label: string; key: number; minFixtureIndex: number; fixtures: Fixture[] }>();
        fixtures.forEach((f) => {
          const label = fmt(f.kickoff_time ?? null);
          const timeKey = f.kickoff_time ? new Date(f.kickoff_time).getTime() : Number.MAX_SAFE_INTEGER;
          const safeTimeKey = Number.isFinite(timeKey) ? timeKey : Number.MAX_SAFE_INTEGER;
          const b =
            buckets.get(label) ?? { label, key: safeTimeKey, minFixtureIndex: Number(f.fixture_index ?? Number.MAX_SAFE_INTEGER), fixtures: [] };
          b.key = Math.min(b.key, safeTimeKey);
          b.minFixtureIndex = Math.min(b.minFixtureIndex, Number(f.fixture_index ?? Number.MAX_SAFE_INTEGER));
          b.fixtures.push(f);
          buckets.set(label, b);
        });
        const sections = Array.from(buckets.values())
          .sort((a, b) => a.key - b.key || a.minFixtureIndex - b.minFixtureIndex)
          .map((b) => ({ label: b.label, fixtures: [...b.fixtures].sort((a, b) => a.fixture_index - b.fixture_index) }));
        return {
          picksGw: gw,
          deadlinePassed: true,
          allSubmitted: true,
          submittedUserIds,
          members: DEV_FAKE_LEAGUE_MEMBERS.map((m) => ({
            id: String(m.id),
            name: String(m.name),
            avatar_url: null,
            avatar_bg_color: String(m.avatar_bg_color),
          })),
          fixtures,
          sections,
          outcomeByFixtureIndex: {},
          picksByFixtureIndex,
        };
      }
      const memberIds = members.map((m: any) => String(m.id));

      const [fixturesRes, subsRes, picksRes, resultsRes] = await Promise.all([
        (supabase as any).from('app_fixtures').select('*').eq('gw', gw).order('fixture_index', { ascending: true }),
        (supabase as any).from('app_gw_submissions').select('user_id').eq('gw', gw),
        (supabase as any).from('app_picks').select('user_id,fixture_index,pick').eq('gw', gw).in('user_id', memberIds),
        (supabase as any).from('app_gw_results').select('fixture_index,result').eq('gw', gw),
      ]);
      if (fixturesRes.error) throw fixturesRes.error;
      if (subsRes.error) throw subsRes.error;
      if (picksRes.error) throw picksRes.error;
      if (resultsRes.error) throw resultsRes.error;

      const fixtures: Fixture[] = (fixturesRes.data ?? []) as Fixture[];

      const kickoffTimes = fixtures
        .map((f) => f.kickoff_time)
        .filter((kt): kt is string => !!kt)
        .map((kt) => new Date(kt))
        .filter((d) => !Number.isNaN(d.getTime()));
      const firstKickoff = kickoffTimes.length ? new Date(Math.min(...kickoffTimes.map((d) => d.getTime()))) : null;
      const deadlineTime = firstKickoff ? new Date(firstKickoff.getTime() - 75 * 60 * 1000) : null;
      const deadlinePassed = deadlineTime ? new Date() >= deadlineTime : false;

      const submittedUserIds = ((subsRes.data ?? []) as Array<{ user_id: string }>)
        .map((s) => String(s.user_id))
        .filter((id) => memberIds.includes(id));
      const submittedSet = new Set<string>(submittedUserIds);
      const allSubmitted = memberIds.length > 0 && memberIds.every((id) => submittedSet.has(id));

      const outcomeByFixtureIndex: Record<string, LeaguePick> = {};
      ((resultsRes.data ?? []) as Array<{ fixture_index: number; result: Pick | string }>).forEach((r) => {
        if (r.result === 'H' || r.result === 'D' || r.result === 'A') outcomeByFixtureIndex[String(r.fixture_index)] = r.result;
      });

      const picksByFixtureIndex: Record<string, Record<string, LeaguePick>> = {};
      ((picksRes.data ?? []) as Array<{ user_id: string; fixture_index: number; pick: LeaguePick | string }>).forEach((p) => {
        if (p.pick !== 'H' && p.pick !== 'D' && p.pick !== 'A') return;
        // Match web: only show picks from users who have submitted.
        if (!submittedSet.has(String(p.user_id))) return;
        if (!fixtures.find((f) => f.fixture_index === p.fixture_index)) return;
        const key = String(p.fixture_index);
        const m = picksByFixtureIndex[key] ?? {};
        m[String(p.user_id)] = p.pick;
        picksByFixtureIndex[key] = m;
      });

      const fmt = (iso?: string | null) => {
        if (!iso) return 'Fixtures';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return 'Fixtures';
        return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      };
      const buckets = new Map<string, { label: string; key: number; minFixtureIndex: number; fixtures: Fixture[] }>();
      fixtures.forEach((f) => {
        const label = fmt(f.kickoff_time ?? null);
        const timeKey = f.kickoff_time ? new Date(f.kickoff_time).getTime() : Number.MAX_SAFE_INTEGER;
        const safeTimeKey = Number.isFinite(timeKey) ? timeKey : Number.MAX_SAFE_INTEGER;
        const b =
          buckets.get(label) ?? { label, key: safeTimeKey, minFixtureIndex: Number(f.fixture_index ?? Number.MAX_SAFE_INTEGER), fixtures: [] };
        b.key = Math.min(b.key, safeTimeKey);
        b.minFixtureIndex = Math.min(b.minFixtureIndex, Number(f.fixture_index ?? Number.MAX_SAFE_INTEGER));
        b.fixtures.push(f);
        buckets.set(label, b);
      });
      const sections = Array.from(buckets.values())
        // Sort by earliest kickoff time, then by earliest fixture index as a stable fallback.
        .sort((a, b) => a.key - b.key || a.minFixtureIndex - b.minFixtureIndex)
        .map((b) => ({ label: b.label, fixtures: [...b.fixtures].sort((a, b) => a.fixture_index - b.fixture_index) }));

      return {
        picksGw: gw,
        deadlinePassed,
        allSubmitted,
        submittedUserIds,
        members: members.map((m: any) => ({
          id: String(m.id),
          name: String(m.name ?? 'User'),
          avatar_url: typeof m.avatar_url === 'string' ? m.avatar_url : null,
          avatar_bg_color: typeof m.avatar_bg_color === 'string' ? m.avatar_bg_color : null,
        })),
        fixtures,
        sections,
        outcomeByFixtureIndex,
        picksByFixtureIndex,
      };
    },
  });

  const { data: me, refetch: refetchMe, isRefetching: meRefetching } = useQuery<{ id: string } | null>({
    enabled: true,
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ? { id: data.user.id } : null;
    },
  });

  const refreshing =
    tab === 'gwTable'
      ? homeRefetching || tableRefetching
      : tab === 'season'
        ? homeRefetching || leagueDetailsRefetching || seasonRowsRefetching
        : tab === 'predictions'
          ? homeRefetching || predictionsRefetching || meRefetching
          : false;

  const onRefresh = React.useCallback(() => {
    if (tab === 'gwTable') {
      const actions: Array<Promise<any>> = [refetchHome()];
      if (typeof selectedGw === 'number') actions.push(refetchTable());
      void Promise.all(actions);
      return;
    }

    if (tab === 'season') {
      const actions: Array<Promise<any>> = [refetchHome(), refetchLeagueDetails()];
      if (members.length > 0 && typeof seasonGw === 'number') actions.push(refetchSeasonRows());
      void Promise.all(actions);
      return;
    }

    if (tab === 'predictions') {
      const actions: Array<Promise<any>> = [refetchHome(), refetchMe()];
      if (members.length > 0 && typeof picksGw === 'number' && seasonStartGwResolved && picksGw >= seasonStartGw) {
        actions.push(refetchPredictions());
      }
      void Promise.all(actions);
    }
  }, [
    members.length,
    picksGw,
    refetchHome,
    refetchLeagueDetails,
    refetchMe,
    refetchPredictions,
    refetchSeasonRows,
    refetchTable,
    seasonGw,
    seasonStartGwResolved,
    seasonStartGw,
    selectedGw,
    tab,
  ]);

  const swipeTabsGesture = React.useMemo(() => {
    const HORIZONTAL_LOCK_PX = 18;
    const VERTICAL_FAIL_PX = 10;
    const COMMIT_DX_PX = 60;
    const COMMIT_VELOCITY_X = 700;
    const DIRECTION_RATIO = 1.2;

    return Gesture.Pan()
      .maxPointers(1)
      // Only start capturing when the user has moved horizontally enough.
      .activeOffsetX([-HORIZONTAL_LOCK_PX, HORIZONTAL_LOCK_PX])
      // If the user moves vertically, let the child ScrollView/FlatList win.
      .failOffsetY([-VERTICAL_FAIL_PX, VERTICAL_FAIL_PX])
      // We want to call `setTab` / `navigation.goBack()` directly from the handler.
      .runOnJS(true)
      .onEnd((e) => {
        const idx = Math.max(0, LEAGUE_TABS.indexOf(tab));
        const lastIdx = LEAGUE_TABS.length - 1;

        const dx = e.translationX ?? 0;
        const dy = e.translationY ?? 0;
        const vx = e.velocityX ?? 0;

        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        // Only treat as a horizontal swipe when clearly horizontal.
        if (absX <= absY * DIRECTION_RATIO) return;

        const shouldCommit = absX >= COMMIT_DX_PX || Math.abs(vx) >= COMMIT_VELOCITY_X;
        if (!shouldCommit) return;

        if (dx > 0) {
          // Swipe right = previous tab, or back if already at leftmost tab.
          if (idx === 0) {
            if (navigation?.canGoBack?.() ?? true) navigation.goBack();
            return;
          }
          setTab(LEAGUE_TABS[idx - 1] ?? 'gwTable');
          return;
        }

        // Swipe left = next tab (no-op at last tab).
        if (idx >= lastIdx) return;
        setTab(LEAGUE_TABS[idx + 1] ?? 'season');
      });
  }, [navigation, tab]);

  React.useEffect(() => {
    if (tab !== 'predictions' || predictionsLayout !== 'mini') {
      setMiniExpandedFixtureId(null);
    }
  }, [predictionsLayout, tab]);

  const queueScrollToFixture = React.useCallback((fixtureId: string) => {
    setTimeout(() => {
      const node = fixtureNodeRefs.current[fixtureId];
      if (!node?.measureInWindow) return;
      node.measureInWindow((x, y, width, height) => {
        const cardTop = Number(y ?? 0);
        const cardBottom = cardTop + Number(height ?? 0);
        if (!Number.isFinite(cardTop) || !Number.isFinite(cardBottom)) return;

        const visibleTop = 130;
        const visibleBottom = screenHeight - 110;
        let nextScrollY = predictionsScrollYRef.current;

        if (cardBottom > visibleBottom) nextScrollY += cardBottom - visibleBottom + 12;
        if (cardTop < visibleTop) nextScrollY -= visibleTop - cardTop + 12;
        if (nextScrollY < 0) nextScrollY = 0;

        if (Math.abs(nextScrollY - predictionsScrollYRef.current) > 2) {
          predictionsScrollRef.current?.scrollTo?.({ y: nextScrollY, animated: true });
        }
      });
    }, 90);
  }, [screenHeight]);

  const handleOpenChatThread = React.useCallback(() => {
    const nextHop = chatMlHopCount + 1;
    if (nextHop >= 3) {
      navigation.navigate('Tabs', { screen: 'Home' });
      return;
    }

    const nextParams = {
      leagueId,
      name: String(leagueMeta?.name ?? params.name ?? ''),
      chatMlHopCount: nextHop,
    };

    if (params.returnTo === 'chat2' || chatMlHopCount > 0) {
      navigation.replace('Chat2Thread' as any, nextParams);
      return;
    }

    navigation.push('Chat2Thread' as any, nextParams);
  }, [chatMlHopCount, leagueId, leagueMeta?.name, navigation, params.name, params.returnTo]);

  return (
    <Screen fullBleed>
      <GestureDetector gesture={swipeTabsGesture}>
        <View style={{ flex: 1 }}>
          <LeagueHeader
            title={String(params.name ?? '')}
            subtitle={typeof selectedGw === 'number' ? `Gameweek ${selectedGw}` : viewingGw ? `Gameweek ${viewingGw}` : 'Gameweek'}
            avatarUri={headerAvatarUri}
            onPressBack={() => {
              // Prefer native back-stack pop to avoid chat <-> league navigation loops.
              if (navigation?.canGoBack?.()) {
                navigation.goBack();
                return;
              }
              if (params.returnTo === 'chat2') {
                navigation.navigate('Chat2Thread' as any, {
                  leagueId: String(params.leagueId),
                  name: String(params.name ?? ''),
                });
                return;
              }
              if (params.returnTo === 'chat') {
                navigation.navigate('ChatThread' as any, {
                  leagueId: String(params.leagueId),
                  name: String(params.name ?? ''),
                });
                return;
              }
              navigation.goBack();
            }}
            onPressChat={handleOpenChatThread}
            unreadCount={leagueUnreadCount}
          />

          <LeagueTabBar value={tab} onChange={setTab} />

          <View style={{ flex: 1, padding: t.space[4] }}>
            {tab === 'gwTable' ? (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 140, flexGrow: 1, justifyContent: 'flex-start' }}
                refreshControl={<TotlRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              >
                {table?.rows?.length && allFixturesFinished ? (
                  <LeagueWinnerBanner
                    winnerName={String(table.rows?.[0]?.name ?? '')}
                    isDraw={
                      Number(table.rows?.[0]?.score ?? 0) === Number(table.rows?.[1]?.score ?? -1) &&
                      Number(table.rows?.[0]?.unicorns ?? 0) === Number(table.rows?.[1]?.unicorns ?? -1)
                    }
                  />
                ) : null}

                {tableLoading && !table ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <CenteredSpinner loading />
                  </View>
                ) : null}

                <LeagueGwTable
                  rows={gwTableMergedRows}
                  showUnicorns={Number(table?.totalMembers ?? 0) >= 3}
                  submittedUserIds={(table as any)?.submittedUserIds ?? []}
                />

                <LeagueGwControlsRow
                  availableGws={tableAvailableGws}
                  selectedGw={selectedGw}
                  onChangeGw={setSelectedGw}
                  onPressRules={() => setRulesOpen(true)}
                  onPressMenu={() => setMenuOpen(true)}
                />

                <LeagueRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
              </ScrollView>
            ) : tab === 'season' ? (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 140, flexGrow: 1, justifyContent: 'flex-start' }}
                refreshControl={<TotlRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              >
                <LeagueSeasonTable
                  rows={seasonRows ?? []}
                  loading={seasonLoading}
                  showForm={seasonShowForm}
                  showUnicorns={seasonShowUnicorns}
                  isLateStartingLeague={seasonIsLateStartingLeague}
                />

                <View
                  style={{
                    marginTop: t.space[4],
                    marginBottom: t.space[2],
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <LeaguePointsFormToggle showForm={seasonShowForm} onToggle={setSeasonShowForm} />
                  <View style={{ width: 10 }} />
                  <View style={{ flex: 1 }} />
                  <LeaguePillButton label="Rules" onPress={() => setSeasonRulesOpen(true)} />
                  <Pressable
                    onPress={() => setMenuOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="League menu"
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      borderWidth: 2,
                      borderColor: t.color.border,
                      backgroundColor: t.color.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                      opacity: pressed ? 0.92 : 1,
                    })}
                  >
                    <Ionicons name="settings-outline" size={20} color={t.color.text} />
                  </Pressable>
                </View>

                <LeagueSeasonRulesSheet
                  open={seasonRulesOpen}
                  onClose={() => setSeasonRulesOpen(false)}
                  isLateStartingLeague={seasonIsLateStartingLeague}
                />
              </ScrollView>
            ) : tab === 'predictions' ? (
              <ScrollView
                ref={predictionsScrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 140, flexGrow: 1, justifyContent: 'flex-start' }}
                refreshControl={<TotlRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                onScroll={(e) => {
                  predictionsScrollYRef.current = e.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
              >
                {typeof picksGw !== 'number' ? (
                  <TotlText variant="muted">No current gameweek available.</TotlText>
                ) : picksGw < seasonStartGw ? (
                  <TotlText variant="muted">No Predictions Available (this league started later).</TotlText>
                ) : !predictions ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <CenteredSpinner loading />
                  </View>
                ) : (() => {
                    const shouldShowWhoSubmitted = !predictions.allSubmitted && !predictions.deadlinePassed;

                    if (shouldShowWhoSubmitted) {
                      return (
                        <LeagueSubmissionStatusCard
                          members={predictions.members}
                          submittedUserIds={predictions.submittedUserIds}
                          picksGw={predictions.picksGw}
                          fixtures={predictions.fixtures}
                          variant="compact"
                        />
                      );
                    }

                    return (
                      <>
                        {!predictions.allSubmitted && !predictions.deadlinePassed ? (
                          <LeagueSubmissionStatusCard
                            members={predictions.members}
                            submittedUserIds={predictions.submittedUserIds}
                            picksGw={predictions.picksGw}
                            fixtures={predictions.fixtures}
                            variant="full"
                          />
                        ) : null}

                        <View style={{ marginTop: 6 }}>
                          <SectionHeaderRow
                            title={`Gameweek ${predictions.picksGw}`}
                            right={
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  borderRadius: 999,
                                  borderWidth: 1,
                                  borderColor: 'rgba(148,163,184,0.26)',
                                  backgroundColor: t.color.surface,
                                  padding: 4,
                                }}
                              >
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Mini cards view"
                                  onPress={() => {
                                    setPredictionsLayout('mini');
                                    setMiniExpandedFixtureId(null);
                                  }}
                                  style={({ pressed }) => ({
                                    width: 34,
                                    height: 34,
                                    borderRadius: 17,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: predictionsLayout === 'mini' ? 'rgba(28,131,118,0.14)' : 'transparent',
                                    opacity: pressed ? 0.86 : 1,
                                  })}
                                >
                                  <Ionicons name="grid-outline" size={18} color={predictionsLayout === 'mini' ? '#1C8376' : '#475569'} />
                                </Pressable>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Expanded cards view"
                                  onPress={() => {
                                    setPredictionsLayout('expanded');
                                    setMiniExpandedFixtureId(null);
                                  }}
                                  style={({ pressed }) => ({
                                    width: 34,
                                    height: 34,
                                    borderRadius: 17,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: predictionsLayout === 'expanded' ? 'rgba(28,131,118,0.14)' : 'transparent',
                                    opacity: pressed ? 0.86 : 1,
                                  })}
                                >
                                  <Ionicons name="tablet-landscape-outline" size={18} color={predictionsLayout === 'expanded' ? '#1C8376' : '#475569'} />
                                </Pressable>
                              </View>
                            }
                          />
                          {predictions.sections.map((section, sectionIdx) => (
                            <Reanimated.View
                              key={`pred-section-${section.label}-${sectionIdx}`}
                              layout={miniLayoutTransition}
                              style={{ marginBottom: sectionIdx === predictions.sections.length - 1 ? 0 : 8 }}
                            >
                              <View style={{ marginBottom: 10, zIndex: 1 }}>
                                <TotlText style={{ fontSize: 17, lineHeight: 21, fontFamily: t.font.medium, color: t.color.text }}>{section.label}</TotlText>
                              </View>
                              {predictionsLayout === 'mini' ? (
                                <Reanimated.View layout={miniLayoutTransition} style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
                                  {section.fixtures.map((f) => {
                                    const k = String(f.fixture_index);
                                    const miniFixtureId = `league-pred-mini-${predictions.picksGw}-${f.fixture_index}`;
                                    const isMiniExpanded = miniExpandedFixtureId === miniFixtureId;
                                    const live = liveByFixtureIndexRealtime.get(f.fixture_index) ?? null;
                                    const outcomeFromDb = predictions.outcomeByFixtureIndex[k] ?? null;
                                    const outcomeFromLive: LeaguePick | null = (() => {
                                      if (!live) return null;
                                      const st: LiveStatus = (live?.status ?? 'SCHEDULED') as LiveStatus;
                                      const started = st === 'IN_PLAY' || st === 'PAUSED' || st === 'FINISHED';
                                      if (!started) return null;
                                      const hs = typeof live.home_score === 'number' ? live.home_score : null;
                                      const as = typeof live.away_score === 'number' ? live.away_score : null;
                                      if (hs === null || as === null) return null;
                                      return hs > as ? 'H' : hs < as ? 'A' : 'D';
                                    })();
                                    const outcome = outcomeFromDb ?? outcomeFromLive;
                                    const st: LiveStatus = (live?.status ?? 'SCHEDULED') as LiveStatus;
                                    const hasScore =
                                      typeof live?.home_score === 'number' &&
                                      typeof live?.away_score === 'number' &&
                                      (st === 'IN_PLAY' || st === 'PAUSED' || st === 'FINISHED');
                                    const homeCode = String(f.home_code ?? '').toUpperCase();
                                    const awayCode = String(f.away_code ?? '').toUpperCase();
                                    const homeBadge = TEAM_BADGES[homeCode] ?? null;
                                    const awayBadge = TEAM_BADGES[awayCode] ?? null;
                                    const homeLabel = getMediumName(String(f.home_name ?? f.home_team ?? homeCode ?? 'Home'));
                                    const awayLabel = getMediumName(String(f.away_name ?? f.away_team ?? awayCode ?? 'Away'));
                                    const picksMap = new Map<string, LeaguePick>(Object.entries(predictions.picksByFixtureIndex[k] ?? {}));
                                    const predictionsGwState: GameweekState = predictions.deadlinePassed ? 'DEADLINE_PASSED' : 'GW_PREDICTED';
                                    return (
                                      <Reanimated.View
                                        key={`mini-${predictions.picksGw}-${f.fixture_index}`}
                                        layout={miniLayoutTransition}
                                        style={{
                                          width: isMiniExpanded ? '100%' : '50%',
                                          paddingHorizontal: 6,
                                          marginBottom: 12,
                                          zIndex: isMiniExpanded ? 10 : 1,
                                        }}
                                      >
                                        <View ref={(node) => { fixtureNodeRefs.current[miniFixtureId] = node; }}>
                                          <MiniFixtureCard
                                            fixtureId={miniFixtureId}
                                            isExpanded={isMiniExpanded}
                                            onToggleExpand={() => {
                                              setMiniExpandedFixtureId((prev) => {
                                                const next = prev === miniFixtureId ? null : miniFixtureId;
                                                if (next) queueScrollToFixture(miniFixtureId);
                                                else predictionsScrollRef.current?.scrollTo?.({ y: 0, animated: true });
                                                return next;
                                              });
                                            }}
                                            suppressExpandedDetails
                                            tightLayout
                                            footerWithExpandState={({ isExpanded }) => (
                                              <LeaguePickChipsRow
                                                members={predictions.members}
                                                picksByUserId={picksMap}
                                                outcome={outcome}
                                                currentUserId={me?.id ?? null}
                                                compact={!isExpanded}
                                              />
                                            )}
                                            homeCode={homeCode}
                                            awayCode={awayCode}
                                            headerHome={homeLabel}
                                            headerAway={awayLabel}
                                            homeBadge={homeBadge}
                                            awayBadge={awayBadge}
                                            primaryLabel={hasScore ? `${live?.home_score ?? 0} - ${live?.away_score ?? 0}` : fixtureKickoffTimeLabel(f.kickoff_time ?? null)}
                                            primaryExpandedLabel={hasScore ? `${live?.home_score ?? 0} - ${live?.away_score ?? 0}` : fixtureKickoffTimeLabel(f.kickoff_time ?? null)}
                                            secondaryLabel={hasScore ? formatMinute(st, live?.minute) : ''}
                                            gwState={predictionsGwState}
                                            pick={undefined}
                                            derivedOutcome={outcome}
                                            hasScore={hasScore}
                                            percentBySide={{ H: 33, D: 34, A: 33 }}
                                            showExpandedPercentages={false}
                                            homeFormColors={['#CBD5E1', '#CBD5E1', '#CBD5E1', '#CBD5E1', '#CBD5E1']}
                                            awayFormColors={['#CBD5E1', '#CBD5E1', '#CBD5E1', '#CBD5E1', '#CBD5E1']}
                                            homePositionLabel="—"
                                            awayPositionLabel="—"
                                            homeScorers={[]}
                                            awayScorers={[]}
                                            fixtureDateLabel={section.label}
                                          />
                                        </View>
                                      </Reanimated.View>
                                    );
                                  })}
                                </Reanimated.View>
                              ) : (
                                section.fixtures.map((f) => {
                                  const k = String(f.fixture_index);
                                  const live = liveByFixtureIndexRealtime.get(f.fixture_index) ?? null;
                                  const outcomeFromDb = predictions.outcomeByFixtureIndex[k] ?? null;
                                  const outcomeFromLive: LeaguePick | null = (() => {
                                    if (!live) return null;
                                    const st: LiveStatus = (live?.status ?? 'SCHEDULED') as LiveStatus;
                                    const started = st === 'IN_PLAY' || st === 'PAUSED' || st === 'FINISHED';
                                    if (!started) return null;
                                    const hs = typeof live.home_score === 'number' ? live.home_score : null;
                                    const as = typeof live.away_score === 'number' ? live.away_score : null;
                                    if (hs === null || as === null) return null;
                                    return hs > as ? 'H' : hs < as ? 'A' : 'D';
                                  })();
                                  const outcome = outcomeFromDb ?? outcomeFromLive;
                                  const picksMap = new Map<string, LeaguePick>(Object.entries(predictions.picksByFixtureIndex[k] ?? {}));

                                  return (
                                    <View
                                      key={`${predictions.picksGw}-${f.fixture_index}`}
                                      style={{
                                        marginBottom: 10,
                                      }}
                                    >
                                      {(() => {
                                        const st: LiveStatus = (live?.status ?? 'SCHEDULED') as LiveStatus;
                                        const hasScore =
                                          typeof live?.home_score === 'number' &&
                                          typeof live?.away_score === 'number' &&
                                          (st === 'IN_PLAY' || st === 'PAUSED' || st === 'FINISHED');
                                        const homeCode = String(f.home_code ?? '').toUpperCase();
                                        const awayCode = String(f.away_code ?? '').toUpperCase();
                                        const homeBadge = TEAM_BADGES[homeCode] ?? null;
                                        const awayBadge = TEAM_BADGES[awayCode] ?? null;
                                        const homeLabel = getMediumName(String(f.home_name ?? f.home_team ?? homeCode ?? 'Home'));
                                        const awayLabel = getMediumName(String(f.away_name ?? f.away_team ?? awayCode ?? 'Away'));
                                        const centerLabel = hasScore
                                          ? `${live?.home_score ?? 0} - ${live?.away_score ?? 0}`
                                          : fixtureKickoffTimeLabel(f.kickoff_time ?? null);
                                        return (
                                          <View
                                            style={{
                                              borderRadius: 18,
                                              borderWidth: 1,
                                              borderColor: t.color.border,
                                              overflow: 'hidden',
                                              backgroundColor: t.color.surface,
                                            }}
                                          >
                                            <View style={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10 }}>
                                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <View style={{ width: '34%', alignItems: 'center' }}>
                                                  {homeBadge ? <Image source={homeBadge} style={{ width: 46, height: 46 }} /> : null}
                                                </View>
                                                <View style={{ width: '32%', alignItems: 'center' }}>
                                                  <TotlText numberOfLines={1} style={{ fontSize: 32, lineHeight: 34, fontFamily: t.font.medium, color: t.color.text }}>
                                                    {centerLabel}
                                                  </TotlText>
                                                </View>
                                                <View style={{ width: '34%', alignItems: 'center' }}>
                                                  {awayBadge ? <Image source={awayBadge} style={{ width: 46, height: 46 }} /> : null}
                                                </View>
                                              </View>
                                              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <View style={{ width: '34%', alignItems: 'center' }}>
                                                  <TotlText numberOfLines={1} style={{ fontSize: 16, lineHeight: 20, fontFamily: t.font.medium, color: t.color.text }}>
                                                    {homeLabel}
                                                  </TotlText>
                                                </View>
                                                <View style={{ width: '32%' }} />
                                                <View style={{ width: '34%', alignItems: 'center' }}>
                                                  <TotlText numberOfLines={1} style={{ fontSize: 16, lineHeight: 20, fontFamily: t.font.medium, color: t.color.text }}>
                                                    {awayLabel}
                                                  </TotlText>
                                                </View>
                                              </View>
                                            </View>
                                            <View style={{ paddingHorizontal: 6, paddingBottom: 8 }}>
                                              <LeaguePickChipsRow
                                                members={predictions.members}
                                                picksByUserId={picksMap}
                                                outcome={outcome}
                                                currentUserId={me?.id ?? null}
                                              />
                                            </View>
                                          </View>
                                        );
                                      })()}
                                    </View>
                                  );
                                })
                              )}
                            </Reanimated.View>
                          ))}
                        </View>
                      </>
                    );
                  })()}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </GestureDetector>

      <LeagueOverflowMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onAction={handleMenuAction}
        menuTextColor={menuTextColor}
        showManage={isAdmin}
        extraItems={[
          {
            key: 'go-to-chat',
            label: 'Go to chat',
            icon: <Ionicons name="chatbubble-ellipses-outline" size={18} color={menuTextColor} />,
            onPress: () => {
              setMenuOpen(false);
              navigation.navigate('ChatThread' as any, {
                leagueId,
                name: String(leagueMeta?.name ?? params.name ?? ''),
              });
            },
          },
        ]}
        showResetBadge={!!headerAvatarUri}
        showInviteChat={false}
      />
      {isAdmin && leagueMeta ? (
        <LeagueManagementSheet
          open={manageSheetOpen}
          onClose={() => setManageSheetOpen(false)}
          leagueName={String(leagueMeta?.name ?? params.name ?? '')}
          members={members.map((m: { id?: string; name?: string }) => ({
            id: String(m.id ?? ''),
            name: String(m.name ?? 'User'),
          }))}
          currentUserId={currentUserId}
          onRemoveMember={handleRemoveMember}
          onEndLeague={handleEndLeague}
        />
      ) : null}
      {leagueMeta?.code ? (
        <LeagueInviteSheet
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          leagueName={String(leagueMeta?.name ?? params.name ?? 'Mini league')}
          leagueCode={String(leagueMeta.code)}
          title={inviteMode === 'chat' ? 'Invite to chat' : 'Invite to mini league'}
          shareTextOverride={
            inviteMode === 'chat'
              ? `Join the chat for "${String(leagueMeta?.name ?? params.name ?? '') || 'my mini league'}" on TotL!`
              : undefined
          }
          urlOverride={
            inviteMode === 'chat'
              ? `${String(env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')}/league/${encodeURIComponent(String(leagueMeta.code))}?tab=chat`
              : undefined
          }
        />
      ) : null}
    </Screen>
  );
}

