import React from 'react';
import { Alert, Share, ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, TotlText, useTokens } from '@totl/ui';
import type { Fixture, GwResultRow, HomeSnapshot, LiveScore, LiveStatus, Pick } from '@totl/domain';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
import FixtureCard from '../components/FixtureCard';
import LeaguePickChipsRow from '../components/league/LeaguePickChipsRow';
import { TotlRefreshControl } from '../lib/refreshControl';
import LeagueOverflowMenu, { type LeagueOverflowAction } from '../components/league/LeagueOverflowMenu';
import LeagueInviteSheet from '../components/league/LeagueInviteSheet';
import { env } from '../env';
import { resolveLeagueStartGw } from '../lib/leagueStart';
import CenteredSpinner from '../components/CenteredSpinner';
import { Ionicons } from '@expo/vector-icons';
import { useLiveScores } from '../hooks/useLiveScores';

const LEAGUE_TABS: LeagueTabKey[] = ['gwTable', 'predictions', 'season'];

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
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<LeagueTabKey>('gwTable');
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteMode, setInviteMode] = React.useState<'league' | 'chat'>('league');
  const [avatarOverrideUri, setAvatarOverrideUri] = React.useState<string | null>(null);
  const [leavingLeague, setLeavingLeague] = React.useState(false);

  type LeaguesResponse = Awaited<ReturnType<typeof api.listLeagues>>;
  type LeagueSummary = LeaguesResponse['leagues'][number];

  const { data: leagues } = useQuery({
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

  const [selectedGw, setSelectedGw] = React.useState<number | null>(null);
  React.useEffect(() => {
    // Keep the GW table in sync with the user’s viewing GW by default.
    // Only initialize once (don’t override manual selection).
    if (selectedGw !== null) return;
    if (typeof viewingGw === 'number') {
      setSelectedGw(viewingGw);
      return;
    }
    if (typeof currentGw === 'number') {
      setSelectedGw(currentGw);
    }
  }, [currentGw, selectedGw, viewingGw]);

  const availableGws = React.useMemo(() => {
    const maxGw = typeof currentGw === 'number' ? currentGw : typeof viewingGw === 'number' ? viewingGw : null;
    if (!maxGw || maxGw < 1) return [];
    return Array.from({ length: maxGw }, (_, i) => i + 1);
  }, [currentGw, viewingGw]);

  type LeagueTableResponse = Awaited<ReturnType<typeof api.getLeagueGwTable>>;
  const leagueId = String(params.leagueId);
  const { data: table, isLoading: tableLoading, refetch: refetchTable, isRefetching: tableRefetching } = useQuery<LeagueTableResponse>({
    enabled: tab === 'gwTable' && typeof selectedGw === 'number',
    queryKey: ['leagueGwTable', leagueId, selectedGw],
    queryFn: () => api.getLeagueGwTable(leagueId, selectedGw as number),
  });

  type LeagueMembersResponse = Awaited<ReturnType<typeof api.getLeague>>;
  const { data: leagueDetails, refetch: refetchLeagueDetails, isRefetching: leagueDetailsRefetching } = useQuery<LeagueMembersResponse>({
    // Needed across tabs (chat avatars + menu actions).
    enabled: true,
    queryKey: ['league', leagueId],
    queryFn: () => api.getLeague(leagueId),
  });
  const members = leagueDetails?.members ?? [];
  const leagueMeta = (leagueDetails?.league ?? null) as null | { id?: string; name?: string; code?: string; created_at?: string | null; avatar?: string | null };
  const headerAvatarUri = React.useMemo(() => {
    if (typeof avatarOverrideUri === 'string' && avatarOverrideUri.startsWith('http')) return avatarOverrideUri;
    const a1 = resolveLeagueAvatarUri(leagueMeta?.avatar);
    if (a1) return a1;
    return resolveLeagueAvatarUri(avatarUriFromList);
  }, [avatarOverrideUri, avatarUriFromList, leagueMeta?.avatar]);

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

  const seasonIsLateStartingLeague = React.useMemo(() => {
    const name = String(params.name ?? '');
    const specialLeagues = ['Prem Predictions', 'FC Football', 'Easy League'];
    const gw7StartLeagues = ['The Bird league'];
    const gw8StartLeagues = ['gregVjofVcarl', 'Let Down'];
    return !!(name && !specialLeagues.includes(name) && !gw7StartLeagues.includes(name) && !gw8StartLeagues.includes(name));
  }, [params.name]);

  const seasonStartGw = React.useMemo(() => {
    const name = String(params.name ?? '');
    const gw7StartLeagues = ['The Bird league'];
    const gw8StartLeagues = ['gregVjofVcarl', 'Let Down'];
    if (gw7StartLeagues.includes(name)) return 7;
    if (gw8StartLeagues.includes(name)) return 8;
    return 1;
  }, [params.name]);

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
    console.log('[LeagueDetailScreen] Badge file info:', { uri: manipulated.uri, size: (info as any)?.size, exists: info.exists });
    const size = typeof (info as any)?.size === 'number' ? ((info as any).size as number) : null;
    if (!info.exists || !size || size <= 0) {
      Alert.alert('Badge update failed', 'We could not read the edited image from disk. Please try again.', [{ text: 'OK' }]);
      return;
    }

    // NOTE: In Expo Go on iOS, `fetch(file://...)` can yield a 0-byte Blob.
    // Use FileSystem to read the local file reliably.
    const b64 = await FileSystem.readAsStringAsync(manipulated.uri, { encoding: 'base64' });
    const bytes = base64ToUint8Array(b64);
    console.log('[LeagueDetailScreen] Badge bytes length:', bytes.byteLength);
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
    console.log('[LeagueDetailScreen] Badge publicUrl:', publicUrl);

    // In dev, verify the URL is actually reachable (bucket might not be public).
    if (__DEV__) {
      try {
        const resp = await fetch(publicUrl, { method: 'GET' });
        console.log('[LeagueDetailScreen] Badge publicUrl fetch:', { status: resp.status, ok: resp.ok });
      } catch (e) {
        console.log('[LeagueDetailScreen] Badge publicUrl fetch failed:', String(e));
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

  const { data: seasonRows, isLoading: seasonLoading, refetch: refetchSeasonRows, isRefetching: seasonRowsRefetching } = useQuery<
    LeagueSeasonRow[]
  >({
    enabled: tab === 'season' && members.length > 0 && typeof currentGw === 'number',
    queryKey: ['leagueSeasonTable', leagueId, currentGw, members.map((m: any) => String(m.id ?? '')).join(',')],
    queryFn: async () => {
      const memberIds = members.map((m: any) => String(m.id));
      const showUnicorns = memberIds.length >= 3;
      const latestGw = currentGw as number;

      const [fixturesRes, resultsRes] = await Promise.all([
        (supabase as any).from('app_fixtures').select('gw,fixture_index').gte('gw', seasonStartGw).lte('gw', latestGw),
        (supabase as any).from('app_gw_results').select('gw,fixture_index,result').gte('gw', seasonStartGw).lte('gw', latestGw),
      ]);
      if (fixturesRes.error) throw fixturesRes.error;
      if (resultsRes.error) throw resultsRes.error;

      const fixtures: Array<{ gw: number; fixture_index: number }> = fixturesRes.data ?? [];
      const results: Array<{ gw: number; fixture_index: number; result: 'H' | 'D' | 'A' | string }> = resultsRes.data ?? [];

      const fixtureCountByGw = new Map<number, number>();
      fixtures.forEach((f) => fixtureCountByGw.set(f.gw, (fixtureCountByGw.get(f.gw) ?? 0) + 1));

      const resultCountByGw = new Map<number, number>();
      const outcomeByGwFixture = new Map<string, 'H' | 'D' | 'A'>();
      results.forEach((r) => {
        if (r.result !== 'H' && r.result !== 'D' && r.result !== 'A') return;
        resultCountByGw.set(r.gw, (resultCountByGw.get(r.gw) ?? 0) + 1);
        outcomeByGwFixture.set(`${r.gw}:${r.fixture_index}`, r.result);
      });

      const completeGws: number[] = [];
      for (let gw = seasonStartGw; gw <= latestGw; gw += 1) {
        const fixtureCount = fixtureCountByGw.get(gw) ?? 0;
        const resultCount = resultCountByGw.get(gw) ?? 0;
        if (fixtureCount > 0 && resultCount === fixtureCount) completeGws.push(gw);
      }
      if (completeGws.length === 0) return [];

      const picksRes = await (supabase as any)
        .from('app_picks')
        .select('user_id,gw,fixture_index,pick')
        .in('user_id', memberIds)
        .in('gw', completeGws);
      if (picksRes.error) throw picksRes.error;
      const picks: Array<{ user_id: string; gw: number; fixture_index: number; pick: 'H' | 'D' | 'A' | string }> =
        picksRes.data ?? [];

      type GwScore = { user_id: string; score: number; unicorns: number };
      const perGw = new Map<number, Map<string, GwScore>>();
      completeGws.forEach((g) => {
        const m = new Map<string, GwScore>();
        memberIds.forEach((uid) => m.set(uid, { user_id: uid, score: 0, unicorns: 0 }));
        perGw.set(g, m);
      });

      const picksByGwFixture = new Map<string, Array<{ user_id: string; pick: string }>>();
      picks.forEach((p) => {
        const key = `${p.gw}:${p.fixture_index}`;
        const arr = picksByGwFixture.get(key) ?? [];
        arr.push({ user_id: p.user_id, pick: p.pick });
        picksByGwFixture.set(key, arr);
      });

      completeGws.forEach((g) => {
        const gwMap = perGw.get(g)!;
        // Iterate fixtures for this GW using outcomes map keys for that GW
        const fixtureIdxs = fixtures.filter((f) => f.gw === g).map((f) => f.fixture_index);
        fixtureIdxs.forEach((idx) => {
          const out = outcomeByGwFixture.get(`${g}:${idx}`);
          if (!out) return;
          const these = picksByGwFixture.get(`${g}:${idx}`) ?? [];
          const correct = these.filter((p) => p.pick === out).map((p) => p.user_id);

          these.forEach((p) => {
            if (p.pick !== out) return;
            const row = gwMap.get(p.user_id);
            if (row) row.score += 1;
          });

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

      completeGws.forEach((g) => {
        const rows = Array.from(perGw.get(g)!.values());
        rows.forEach((r) => {
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
  });

  const picksGw = React.useMemo(() => {
    // Match web: Predictions tab is for the current GW (except special leagues which we can add later).
    return typeof currentGw === 'number' ? currentGw : null;
  }, [currentGw]);

  type LeaguePredictionsData = {
    picksGw: number;
    deadlinePassed: boolean;
    allSubmitted: boolean;
    submittedUserIds: string[];
    members: Array<{ id: string; name: string }>;
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
    enabled: tab === 'predictions' && members.length > 0 && typeof picksGw === 'number' && picksGw >= seasonStartGw,
    // NOTE: v2 key to invalidate older persisted cache that contained Map/Set (non-serializable).
    queryKey: ['leaguePredictionsV2', leagueId, picksGw, members.map((m: any) => String(m.id)).join(',')],
    queryFn: async () => {
      const gw = picksGw as number;
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
        })),
        fixtures,
        sections,
        outcomeByFixtureIndex,
        picksByFixtureIndex,
      };
    },
  });

  const { data: me, refetch: refetchMe, isRefetching: meRefetching } = useQuery<{ id: string } | null>({
    enabled: tab === 'predictions',
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
      if (members.length > 0 && typeof currentGw === 'number') actions.push(refetchSeasonRows());
      void Promise.all(actions);
      return;
    }

    if (tab === 'predictions') {
      const actions: Array<Promise<any>> = [refetchHome(), refetchMe()];
      if (members.length > 0 && typeof picksGw === 'number' && picksGw >= seasonStartGw) actions.push(refetchPredictions());
      void Promise.all(actions);
    }
  }, [
    currentGw,
    members.length,
    picksGw,
    refetchHome,
    refetchLeagueDetails,
    refetchMe,
    refetchPredictions,
    refetchSeasonRows,
    refetchTable,
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

  return (
    <Screen fullBleed>
      <GestureDetector gesture={swipeTabsGesture}>
        <View style={{ flex: 1 }}>
          <LeagueHeader
            title={String(params.name ?? '')}
            subtitle={typeof selectedGw === 'number' ? `Gameweek ${selectedGw}` : viewingGw ? `Gameweek ${viewingGw}` : 'Gameweek'}
            avatarUri={headerAvatarUri}
            onPressBack={() => navigation.goBack()}
            onPressMenu={() => setMenuOpen(true)}
          />

          <LeagueTabBar value={tab} onChange={setTab} />

          <View style={{ flex: 1, padding: t.space[4] }}>
            {tab === 'gwTable' ? (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 140 }}
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
                  <View style={{ height: 220 }}>
                    <CenteredSpinner loading />
                  </View>
                ) : null}

                <LeagueGwTable
                  rows={(table?.rows ?? []) as LeagueGwTableRow[]}
                  showUnicorns={Number(table?.totalMembers ?? 0) >= 3}
                  submittedCount={typeof table?.submittedCount === 'number' ? table.submittedCount : null}
                  totalMembers={typeof table?.totalMembers === 'number' ? table.totalMembers : null}
                />

                <LeagueGwControlsRow
                  availableGws={availableGws}
                  selectedGw={selectedGw}
                  onChangeGw={setSelectedGw}
                  onPressRules={() => setRulesOpen(true)}
                />

                <LeagueRulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
              </ScrollView>
            ) : tab === 'season' ? (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 140 }}
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
                </View>

                <LeagueSeasonRulesSheet
                  open={seasonRulesOpen}
                  onClose={() => setSeasonRulesOpen(false)}
                  isLateStartingLeague={seasonIsLateStartingLeague}
                />
              </ScrollView>
            ) : tab === 'predictions' ? (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 140 }}
                refreshControl={<TotlRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              >
                {typeof picksGw !== 'number' ? (
                  <TotlText variant="muted">No current gameweek available.</TotlText>
                ) : picksGw < seasonStartGw ? (
                  <TotlText variant="muted">No Predictions Available (this league started later).</TotlText>
                ) : !predictions ? (
                  <View style={{ height: 220 }}>
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
                        {!predictions.allSubmitted ? (
                          <LeagueSubmissionStatusCard
                            members={predictions.members}
                            submittedUserIds={predictions.submittedUserIds}
                            picksGw={predictions.picksGw}
                            fixtures={predictions.fixtures}
                            variant="full"
                          />
                        ) : null}

                        {predictions.sections.map((sec) => (
                          <View key={sec.label} style={{ marginTop: 12 }}>
                            <TotlText variant="body" style={{ fontWeight: '900', marginBottom: 10 }}>
                              {sec.label}
                            </TotlText>

                            <View
                              style={{
                                borderRadius: 14,
                                overflow: 'hidden',
                                borderWidth: 1,
                                borderColor: 'rgba(148,163,184,0.14)',
                              }}
                            >
                              {sec.fixtures.map((f, idx) => {
                                const k = String(f.fixture_index);
                                const live = liveByFixtureIndexRealtime.get(f.fixture_index) ?? null;
                                const lsNoGoals = live ? ({ ...(live as any), goals: undefined } as any) : null;
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
                                const picksMap =
                                  new Map<string, LeaguePick>(Object.entries(predictions.picksByFixtureIndex[k] ?? {}));

                                return (
                                  <View
                                    key={`${predictions.picksGw}-${f.fixture_index}`}
                                    style={{
                                      borderTopWidth: idx === 0 ? 0 : 1,
                                      borderTopColor: 'rgba(148,163,184,0.14)',
                                    }}
                                  >
                                    <FixtureCard
                                      fixture={f as any}
                                      liveScore={lsNoGoals}
                                      showPickButtons={false}
                                      variant="grouped"
                                      result={outcome}
                                    />
                                    <LeaguePickChipsRow
                                      members={predictions.members}
                                      picksByUserId={picksMap}
                                      outcome={outcome}
                                      currentUserId={me?.id ?? null}
                                    />
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        ))}
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
        extraItems={[
          {
            key: 'go-to-chat',
            label: 'Go to chat',
            icon: <Ionicons name="chatbubble-ellipses-outline" size={18} color="#000000" />,
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

