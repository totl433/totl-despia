import React from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useScrollToTop } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Fixture, Pick } from '@totl/domain';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { TotlRefreshControl } from '../lib/refreshControl';
import FixtureCard from '../components/FixtureCard';
import PredictionsSwipeDeck from '../components/predictions/PredictionsSwipeDeck';
import PredictionsProgressPills from '../components/predictions/PredictionsProgressPills';
import PredictionsHowToSheet from '../components/predictions/PredictionsHowToSheet';
import { normalizeTeamCode } from '../lib/teamColors';
import { useConfetti } from '../lib/confetti';
import AppTopHeader from '../components/AppTopHeader';
import CenteredSpinner from '../components/CenteredSpinner';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../lib/layout';
import {
  buildMatchPreviewStatsFromCache,
  computeCleanSheetsFromResults,
  hasSeasonStats,
  type MatchPreviewStats,
  type TeamFormsDbRow,
} from '../lib/matchPreviewStats';

/** Live season GW mirrored by Predictions Test fixtures (for forms / H2H cache lookup). */
const TEST_STATS_SOURCE_GW = 3;
const TEST_STATS_SEASON_ID = 'e0a58f84-9575-4b6b-adca-320defc04b46';
/** Slightly darker than theme slate-50 so white prediction cards read clearer. */
const PREDICTIONS_BG = '#F1F5F9';

type Mode = 'cards' | 'review' | 'list';

const FLAT_CARD_STYLE = {
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

function deadlineCountdown(
  fixtures: Fixture[],
  nowMs: number
): {
  text: string;
  expired: boolean;
  deadlineMs: number;
} | null {
  const firstKickoff = fixtures
    .map((f) => (f.kickoff_time ? new Date(f.kickoff_time) : null))
    .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  if (!firstKickoff) return null;

  const DEADLINE_BUFFER_MINUTES = 75;
  const deadline = new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000);
  const diffMs = deadline.getTime() - nowMs;
  if (diffMs <= 0) return { text: '0d 0h 0m', expired: true, deadlineMs: deadline.getTime() };

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return { text: `${days}d ${hours}h ${minutes}m`, expired: false, deadlineMs: deadline.getTime() };
}

function draftKey(userId: string, gw: number) {
  return `totl.predictionsDraft:${userId}:${gw}`;
}

const HOW_TO_STORAGE_KEY = 'predictionsSwipeFirstVisit';
const REVIEW_TIP_STORAGE_KEY = 'predictionsReviewTipDismissed:v1';

function isPick(v: unknown): v is Pick {
  return v === 'H' || v === 'D' || v === 'A';
}

function fixtureDateLabel(kickoff: string | null | undefined) {
  if (!kickoff) return 'No date';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Predictions Test (HP Admin) fixtures — mirror the live season GW so flip-card
 * stats can be checked against real H2H / standings. Kept as gw 99 so test picks
 * never collide with real submissions.
 *
 * Kickoffs are shifted ~7 days ahead of "now" so the shared deadline UI never
 * locks the test page (test mode also ignores deadlineExpired).
 *
 * Source: 2026/27 season stack GW3 (`app_season_fixtures`).
 */
function buildFakeFixtures(nowMs = Date.now()): Fixture[] {
  const dayMs = 24 * 60 * 60 * 1000;
  /** Anchor first KO ~7 days out at 19:00 UTC so labels stay in the future. */
  const first = new Date(nowMs + 7 * dayMs);
  first.setUTCHours(19, 0, 0, 0);

  const at = (dayOffset: number, hourUtc: number, minuteUtc: number) => {
    const d = new Date(first.getTime() + dayOffset * dayMs);
    d.setUTCHours(hourUtc, minuteUtc, 0, 0);
    return d.toISOString();
  };

  const fixtures: Array<{
    fixture_index: number;
    homeCode: string;
    homeName: string;
    awayCode: string;
    awayName: string;
    kickoff_time: string;
    api_match_id: number;
  }> = [
    { fixture_index: 0, homeCode: 'IPS', homeName: 'Ipswich', awayCode: 'LIV', awayName: 'Liverpool', kickoff_time: at(0, 19, 0), api_match_id: 560566 },
    { fixture_index: 1, homeCode: 'NEW', homeName: 'Newcastle', awayCode: 'BOU', awayName: 'Bournemouth', kickoff_time: at(1, 11, 30), api_match_id: 560571 },
    { fixture_index: 2, homeCode: 'NOT', homeName: 'Nott\'m Forest', awayCode: 'TOT', awayName: 'Tottenham', kickoff_time: at(1, 14, 0), api_match_id: 560562 },
    { fixture_index: 3, homeCode: 'MCI', homeName: 'Man City', awayCode: 'COV', awayName: 'Coventry', kickoff_time: at(1, 14, 0), api_match_id: 560563 },
    { fixture_index: 4, homeCode: 'BHA', homeName: 'Brighton', awayCode: 'LEE', awayName: 'Leeds', kickoff_time: at(1, 14, 0), api_match_id: 560564 },
    { fixture_index: 5, homeCode: 'BRE', homeName: 'Brentford', awayCode: 'SUN', awayName: 'Sunderland', kickoff_time: at(1, 14, 0), api_match_id: 560565 },
    { fixture_index: 6, homeCode: 'FUL', homeName: 'Fulham', awayCode: 'CRY', awayName: 'Crystal Palace', kickoff_time: at(1, 14, 0), api_match_id: 560568 },
    { fixture_index: 7, homeCode: 'HUL', homeName: 'Hull', awayCode: 'AVL', awayName: 'Aston Villa', kickoff_time: at(1, 16, 30), api_match_id: 560569 },
    { fixture_index: 8, homeCode: 'EVE', homeName: 'Everton', awayCode: 'MUN', awayName: 'Man Utd', kickoff_time: at(2, 13, 0), api_match_id: 560567 },
    { fixture_index: 9, homeCode: 'ARS', homeName: 'Arsenal', awayCode: 'CHE', awayName: 'Chelsea', kickoff_time: at(2, 15, 30), api_match_id: 560570 },
  ];

  return fixtures.map((f) => ({
    id: `test-fixture-${f.fixture_index + 1}`,
    gw: 99,
    fixture_index: f.fixture_index,
    kickoff_time: f.kickoff_time,
    api_match_id: f.api_match_id,
    home_team: f.homeName,
    away_team: f.awayName,
    home_name: f.homeName,
    away_name: f.awayName,
    home_code: f.homeCode,
    away_code: f.awayCode,
    home_crest: null,
    away_crest: null,
  }));
}

function normalizeTeamForms(input: Record<string, string> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(input ?? {}).forEach(([rawCode, rawForm]) => {
    const code = normalizeTeamCode(rawCode);
    const form = typeof rawForm === 'string' ? rawForm.trim().toUpperCase() : '';
    if (code && form) out[code] = form;
  });
  return out;
}

function PickChip({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? '#1C8376' : '#C5D9D4',
        opacity: disabled ? 0.5 : pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <TotlText style={{ color: active ? '#FFFFFF' : '#0F172A', fontWeight: '900' }}>{label}</TotlText>
    </Pressable>
  );
}

function PredictionsViewToggle({
  value,
  onChange,
}: {
  value: 'swipe' | 'list';
  onChange: (value: 'swipe' | 'list') => void;
}) {
  const options: Array<{ key: 'swipe' | 'list'; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
    { key: 'swipe', label: 'Swipe View', icon: 'albums-outline' },
    { key: 'list', label: 'List View', icon: 'list-outline' },
  ];

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 999,
        padding: 4,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.22)',
      }}
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? 'rgba(28,131,118,0.14)' : 'transparent',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons
              name={option.icon}
              size={20}
              color={active ? '#1C8376' : '#64748B'}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function PredictionsScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const isTestMode = route?.name === 'PredictionsTestFlow';
  const isStandalonePredictionsFlow = route?.name === 'PredictionsFlow' || isTestMode;
  const scrollRef = React.useRef<any>(null);
  useScrollToTop(scrollRef);
  const queryClient = useQueryClient();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const confetti = useConfetti();

  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [userId, setUserId] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user?.id ?? null;
      if (!alive) return;
      setUserId(id);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const { data: avatarRow } = useQuery<{ avatar_url: string | null } | null>({
    enabled: !!userId,
    queryKey: ['profile-avatar-url', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('avatar_url').eq('id', userId).maybeSingle();
      if (error && (error as any).code !== 'PGRST116') throw error;
      if (!data) return null;
      return { avatar_url: typeof (data as any).avatar_url === 'string' ? (data as any).avatar_url : null };
    },
    staleTime: 60_000,
  });
  const avatarUrl = typeof avatarRow?.avatar_url === 'string' ? String(avatarRow.avatar_url) : null;

  const [howToSuppressed, setHowToSuppressed] = React.useState<boolean>(false);
  const [howToOpen, setHowToOpen] = React.useState(false);
  const howToShownThisSessionRef = React.useRef(false);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);
  const [reviewTipDismissed, setReviewTipDismissed] = React.useState<boolean>(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(HOW_TO_STORAGE_KEY);
        if (!alive) return;
        setHowToSuppressed(v === 'true');
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(REVIEW_TIP_STORAGE_KEY);
        if (!alive) return;
        setReviewTipDismissed(v === 'true');
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['predictions', isTestMode ? 'test' : 'live'],
    enabled: !isTestMode,
    queryFn: () => api.getPredictions(),
  });
  const { data: testModePredictions } = useQuery({
    queryKey: ['predictions-test-forms'],
    enabled: isTestMode,
    queryFn: () => api.getPredictions(),
    staleTime: 30_000,
  });

  const fakeFixtures = React.useMemo(() => buildFakeFixtures(), []);

  const { data: flipStatsByFixtureIndex } = useQuery({
    queryKey: ['match-preview-stats', isTestMode ? 'test' : 'live', TEST_STATS_SOURCE_GW],
    enabled: isTestMode,
    staleTime: 60_000,
    queryFn: async () => {
      const apiMatchIds = fakeFixtures
        .map((f) => Number(f.api_match_id))
        .filter((id) => Number.isFinite(id) && id > 0);

      const [{ data: formsRows }, { data: h2hRows }, { data: resultRows }, { data: resultFixtures }] =
        await Promise.all([
          supabase
            .from('app_team_forms')
            .select('team_code, form, league_position, played, won, drawn, lost, goals_for, goals_against')
            .eq('gw', TEST_STATS_SOURCE_GW),
          apiMatchIds.length
            ? supabase
                .from('app_fixture_h2h')
                .select('api_match_id, home_wins, draws, away_wins, number_of_matches')
                .eq('gw', TEST_STATS_SOURCE_GW)
                .in('api_match_id', apiMatchIds)
            : Promise.resolve({ data: [] as any[] }),
          supabase
            .from('app_season_results')
            .select('gw, fixture_index, home_score, away_score, api_match_id')
            .eq('season_id', TEST_STATS_SEASON_ID)
            .lt('gw', TEST_STATS_SOURCE_GW),
          supabase
            .from('app_season_fixtures')
            .select('gw, fixture_index, home_code, away_code')
            .eq('season_id', TEST_STATS_SEASON_ID)
            .lt('gw', TEST_STATS_SOURCE_GW),
        ]);

      const formsByCode = new Map<string, TeamFormsDbRow>();
      for (const row of formsRows || []) {
        const code = normalizeTeamCode((row as any).team_code);
        if (code) formsByCode.set(code, row as TeamFormsDbRow);
      }

      const h2hByMatchId = new Map<
        number,
        { home_wins: number; draws: number; away_wins: number; number_of_matches?: number | null }
      >();
      for (const row of h2hRows || []) {
        const id = Number((row as any).api_match_id);
        if (Number.isFinite(id)) {
          h2hByMatchId.set(id, {
            home_wins: Number((row as any).home_wins) || 0,
            draws: Number((row as any).draws) || 0,
            away_wins: Number((row as any).away_wins) || 0,
            number_of_matches: (row as any).number_of_matches ?? null,
          });
        }
      }

      const fixtureKey = (gw: number, idx: number) => `${gw}:${idx}`;
      const codesByResultKey = new Map<string, { home_code: string; away_code: string }>();
      for (const fx of resultFixtures || []) {
        codesByResultKey.set(fixtureKey(Number((fx as any).gw), Number((fx as any).fixture_index)), {
          home_code: String((fx as any).home_code || ''),
          away_code: String((fx as any).away_code || ''),
        });
      }
      const scoreRows = (resultRows || []).map((r: any) => {
        const codes = codesByResultKey.get(fixtureKey(Number(r.gw), Number(r.fixture_index)));
        return {
          home_code: normalizeTeamCode(codes?.home_code ?? null),
          away_code: normalizeTeamCode(codes?.away_code ?? null),
          home_score: r.home_score,
          away_score: r.away_score,
        };
      });

      const out = new Map<number, MatchPreviewStats>();
      for (const fixture of fakeFixtures) {
        const homeCode = normalizeTeamCode(fixture.home_code);
        const awayCode = normalizeTeamCode(fixture.away_code);
        const homeForms = formsByCode.get(homeCode) ?? null;
        const awayForms = formsByCode.get(awayCode) ?? null;
        const matchId = Number(fixture.api_match_id);
        const h2h = Number.isFinite(matchId) ? h2hByMatchId.get(matchId) ?? null : null;
        const cleanSheets =
          homeCode && awayCode ? computeCleanSheetsFromResults(scoreRows, homeCode, awayCode) : null;

        if (!hasSeasonStats(homeForms) && !hasSeasonStats(awayForms) && !h2h && !cleanSheets) {
          continue;
        }

        out.set(
          fixture.fixture_index,
          buildMatchPreviewStatsFromCache({
            gw: TEST_STATS_SOURCE_GW,
            homeCode,
            awayCode,
            homeForms,
            awayForms,
            h2h,
            cleanSheets,
            subtitle: `Gameweek ${TEST_STATS_SOURCE_GW}`,
          })
        );
      }

      return out;
    },
  });

  const effectiveData = React.useMemo(() => {
    if (!isTestMode) return data;
    return {
      gw: 99,
      fixtures: fakeFixtures,
      picks: [],
      submitted: false,
      teamForms: {},
    };
  }, [data, fakeFixtures, isTestMode]);

  const fixtures = React.useMemo(() => {
    const fx = (effectiveData?.fixtures ?? []) as Fixture[];
    return [...fx].sort((a, b) => (a.fixture_index ?? 0) - (b.fixture_index ?? 0));
  }, [effectiveData?.fixtures]);

  const fixturesByDate = React.useMemo(() => {
    const groups = new Map<string, Fixture[]>();
    fixtures.forEach((f: Fixture) => {
      const key = fixtureDateLabel(f.kickoff_time ?? null);
      const arr = groups.get(key) ?? [];
      arr.push(f);
      groups.set(key, arr);
    });

    groups.forEach((arr, key) => {
      groups.set(
        key,
        [...arr].sort((a, b) => Number(a?.fixture_index ?? 0) - Number(b?.fixture_index ?? 0))
      );
    });

    const keys = Array.from(groups.keys()).sort((a, b) => {
      if (a === 'No date') return 1;
      if (b === 'No date') return -1;
      const a0 = groups.get(a)?.[0]?.kickoff_time;
      const b0 = groups.get(b)?.[0]?.kickoff_time;
      const da = a0 ? new Date(a0).getTime() : Number.POSITIVE_INFINITY;
      const db = b0 ? new Date(b0).getTime() : Number.POSITIVE_INFINITY;
      return da - db;
    });

    return keys.map((k) => ({ date: k, fixtures: groups.get(k) ?? [] }));
  }, [fixtures]);

  const gw = effectiveData?.gw ?? null;
  const submitted = effectiveData?.submitted ?? false;
  const teamFormsFromApi = React.useMemo(
    () => normalizeTeamForms((effectiveData?.teamForms ?? {}) as Record<string, string>),
    [effectiveData?.teamForms]
  );
  const testModeTeamForms = React.useMemo(
    () => normalizeTeamForms((testModePredictions?.teamForms ?? {}) as Record<string, string>),
    [testModePredictions?.teamForms]
  );

  const teamForms = React.useMemo(() => {
    // Keep forms API-driven (same source as Despia setup):
    // - Real modal: /v1/predictions response used by this screen.
    // - Test modal: separate /v1/predictions call only for teamForms.
    if (isTestMode && Object.keys(testModeTeamForms).length > 0) return testModeTeamForms;
    return teamFormsFromApi;
  }, [isTestMode, teamFormsFromApi, testModeTeamForms]);
  const formsByFixtureIndex = React.useMemo(() => {
    const out = new Map<number, { home: string | null; away: string | null }>();
    fixtures.forEach((f) => {
      const homeCode = normalizeTeamCode(f.home_code);
      const awayCode = normalizeTeamCode(f.away_code);
      out.set(f.fixture_index, {
        home: homeCode ? (teamForms[homeCode] ?? null) : null,
        away: awayCode ? (teamForms[awayCode] ?? null) : null,
      });
    });
    return out;
  }, [fixtures, teamForms]);

  const serverPicks = React.useMemo(() => {
    const out: Record<number, Pick> = {};
    (effectiveData?.picks ?? []).forEach((p: any) => {
      const idx = Number(p?.fixture_index);
      const pick = p?.pick;
      if (Number.isFinite(idx) && isPick(pick)) out[idx] = pick;
    });
    return out;
  }, [effectiveData?.picks]);

  const [draftPicks, setDraftPicks] = React.useState<Record<number, Pick>>({});

  // Load draft picks (once per user+gw).
  const loadedDraftForRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (isTestMode) return;
    if (!userId) return;
    if (typeof gw !== 'number') return;
    const k = draftKey(userId, gw);
    if (loadedDraftForRef.current === k) return;
    loadedDraftForRef.current = k;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(k);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const next: Record<number, Pick> = {};
        Object.entries(parsed ?? {}).forEach(([key, val]) => {
          const idx = Number(key);
          if (!Number.isFinite(idx)) return;
          if (!isPick(val)) return;
          next[idx] = val;
        });
        setDraftPicks(next);
      } catch {
        // ignore
      }
    })();
  }, [gw, isTestMode, userId]);

  // Persist drafts.
  React.useEffect(() => {
    if (isTestMode) return;
    if (!userId) return;
    if (typeof gw !== 'number') return;
    const k = draftKey(userId, gw);
    void AsyncStorage.setItem(k, JSON.stringify(draftPicks)).catch(() => {});
  }, [draftPicks, gw, isTestMode, userId]);

  // Clear drafts if submission is now confirmed.
  React.useEffect(() => {
    if (isTestMode) return;
    if (!userId) return;
    if (typeof gw !== 'number') return;
    if (!submitted) return;
    void AsyncStorage.removeItem(draftKey(userId, gw)).catch(() => {});
  }, [gw, isTestMode, submitted, userId]);

  const picks: Record<number, Pick> = React.useMemo(() => {
    // If submitted, treat server as the source of truth.
    if (submitted) return serverPicks;
    return { ...serverPicks, ...draftPicks };
  }, [draftPicks, serverPicks, submitted]);

  const deadline = React.useMemo(() => {
    // Admin test flow: never lock on deadline — fixtures are a fixed mirror of a live GW.
    if (isTestMode) return null;
    return deadlineCountdown(fixtures, nowMs);
  }, [fixtures, isTestMode, nowMs]);
  const deadlineExpired = isTestMode ? false : (deadline?.expired ?? false);

  const allPicksMade = React.useMemo(() => {
    if (!fixtures.length) return false;
    return fixtures.every((f) => isPick(picks[f.fixture_index]));
  }, [fixtures, picks]);

  const forceListMode = submitted || deadlineExpired;
  const [mode, setMode] = React.useState<Mode>('list');
  const currentViewMode: 'swipe' | 'list' = mode === 'cards' ? 'swipe' : 'list';

  const handleViewModeChange = React.useCallback(
    (nextView: 'swipe' | 'list') => {
      if (forceListMode) return;
      if (nextView === 'swipe') {
        setMode('cards');
        return;
      }
      setMode('review');
    },
    [forceListMode]
  );

  React.useEffect(() => {
    if (forceListMode) {
      if (mode !== 'list') setMode('list');
      return;
    }
    // Default UX: cards until complete, then review.
    if (allPicksMade) {
      if (mode === 'cards') setMode('review');
      if (mode === 'list') setMode('review');
      return;
    }
    if (mode === 'list') setMode('cards');
  }, [allPicksMade, forceListMode, mode]);

  // Bottom tab bar behavior:
  // - Hide while making/reviewing picks (full-screen flow).
  // - Show once picks are submitted (normal screen with bottom nav).
  React.useEffect(() => {
    const hideTabBar = mode !== 'list';
    // @bottom-tabs/react-navigation doesn't reliably support `tabBarStyle: { display: 'none' }`
    // for fully hiding the native bar. Instead, we communicate intent via route params and let
    // our custom `FloatingTabBar` decide whether to render.
    navigation.setParams?.({ hideTabBar });
  }, [mode, navigation]);

  React.useEffect(() => {
    // Show the “how to swipe” sheet once, only when swipe mode is actually available.
    if (howToSuppressed) return;
    if (howToShownThisSessionRef.current) return;
    if (mode !== 'cards') return;
    if (forceListMode) return;
    if (!fixtures.length) return;

    howToShownThisSessionRef.current = true;
    const id = setTimeout(() => setHowToOpen(true), 250);
    return () => clearTimeout(id);
  }, [fixtures.length, forceListMode, howToSuppressed, mode]);

  const initialCardIndex = React.useMemo(() => {
    if (!fixtures.length) return 0;
    const idx = fixtures.findIndex((f) => !isPick(picks[f.fixture_index]));
    return idx >= 0 ? idx : Math.max(0, fixtures.length - 1);
  }, [fixtures, picks]);
  const [cardIndex, setCardIndex] = React.useState(initialCardIndex);
  const deckIdentity = React.useMemo(
    () => `${isTestMode ? 'test' : 'live'}:${gw ?? 'none'}:${fixtures.map((fixture) => `${String(fixture.id)}:${fixture.fixture_index}`).join('|')}`,
    [fixtures, gw, isTestMode]
  );
  const lastDeckIdentityRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (lastDeckIdentityRef.current === deckIdentity) return;
    lastDeckIdentityRef.current = deckIdentity;
    setCardIndex(initialCardIndex);
  }, [deckIdentity, initialCardIndex]);

  const setPickLocal = React.useCallback(
    (fixture_index: number, pick: Pick) => {
      if (submitted || deadlineExpired) return;
      setDraftPicks((prev) => ({ ...prev, [fixture_index]: pick }));
    },
    [deadlineExpired, submitted]
  );

  const confirmMutation = useMutation({
    mutationFn: async () => {
      setConfirmError(null);
      if (submitted) throw new Error('Already submitted');
      if (deadlineExpired) throw new Error('Deadline has passed');
      if (typeof gw !== 'number') throw new Error('Missing gameweek');
      if (!fixtures.length) throw new Error('No fixtures');
      if (isTestMode) return { gw: 99 };

      // Ensure we have a pick for every fixture.
      const picksArray = fixtures.map((f) => {
        const pick = picks[f.fixture_index];
        if (!isPick(pick)) throw new Error('Please complete all predictions');
        return { fixture_index: f.fixture_index, pick };
      });

      await api.savePredictions({ gw, picks: picksArray });
      await api.submitPredictions({ gw });
      return { gw };
    },
    onSuccess: async (result) => {
      if (isTestMode) {
        confetti.fire({
          origin: { x: screenWidth / 2, y: -10 },
          count: 320,
          explosionSpeed: 420,
          fallSpeed: 3800,
          ttlMs: 5600,
        });
        const submittedGw = typeof result?.gw === 'number' ? result.gw : 99;
        requestAnimationFrame(() => {
          navigation.reset({
            index: 0,
            routes: [
              {
                name: 'Tabs',
                params: { screen: 'Predictions' },
              },
            ],
          });
        });
        return;
      }
      // Clear draft immediately (server is now canonical).
      setDraftPicks({});
      confetti.fire({
        origin: { x: screenWidth / 2, y: -10 },
        count: 320,
        explosionSpeed: 420,
        fallSpeed: 3800,
        ttlMs: 5600,
      });

      // Refetch key screens so Home reflects "locked in" immediately.
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['predictions'] }),
        queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] }),
        queryClient.invalidateQueries({ queryKey: ['homeRanks'] }),
      ]);

      // Navigate on next frame so the overlay is mounted before the tab switch.
      requestAnimationFrame(() => {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
          return;
        }
        navigation.navigate('Tabs', { screen: 'Predictions' });
      });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to confirm predictions';
      setConfirmError(msg);
    },
  });

  const renderGroupedFixtures = React.useCallback(
    ({ interactive }: { interactive: boolean }) => {
      return fixturesByDate.map((g, groupIdx) => (
        <View
          key={`${g.date}-${groupIdx}`}
          style={{ marginBottom: groupIdx === fixturesByDate.length - 1 ? 0 : 12 }}
        >
          <Card style={[FLAT_CARD_STYLE, { padding: 0 }]}>
            <View style={{ borderRadius: 22, overflow: 'hidden' }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingTop: 14,
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(15,23,42,0.06)',
                }}
              >
                <TotlText
                  style={{
                    color: t.color.text,
                    fontFamily: 'Gramatika-Medium',
                    fontSize: 14,
                    lineHeight: 14,
                    letterSpacing: 0.6,
                  }}
                  numberOfLines={1}
                >
                  {String(g.date ?? '').toUpperCase()}
                </TotlText>
              </View>

              {g.fixtures.map((f: Fixture, idx: number) => {
                const pick = picks[f.fixture_index] ?? undefined;
                return (
                  <View key={String(f.id)} style={{ position: 'relative' }}>
                    {idx < g.fixtures.length - 1 ? (
                      <View
                        style={{
                          position: 'absolute',
                          left: 16,
                          right: 16,
                          bottom: 0,
                          height: 1,
                          backgroundColor: 'rgba(148,163,184,0.18)',
                          zIndex: 2,
                        }}
                      />
                    ) : null}
                    <FixtureCard
                      fixture={f as any}
                      liveScore={null}
                      pick={pick as any}
                      showPickButtons
                      pickButtonsDisabled={!interactive || submitted || deadlineExpired}
                      onPick={interactive ? (side) => setPickLocal(f.fixture_index, side) : undefined}
                      variant="grouped"
                    />
                  </View>
                );
              })}
            </View>
          </Card>
        </View>
      ));
    },
    [deadlineExpired, fixturesByDate, picks, setPickLocal, submitted, t.color.text]
  );

  const closePredictionsFlow = React.useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Tabs', { screen: 'Predictions' });
  }, [navigation]);

  const renderTopBar = ({ title }: { title: string }) => {
    if (isStandalonePredictionsFlow) {
      return (
        <View
          style={{
            marginTop: -insets.top,
            paddingTop: insets.top + 4,
            paddingHorizontal: t.space[4],
            backgroundColor: PREDICTIONS_BG,
          }}
        >
          <View style={{ height: 60, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ position: 'absolute', left: 0 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close predictions"
                onPress={closePredictionsFlow}
                style={({ pressed }) => ({
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Ionicons name="close" size={24} color={t.color.text} />
              </Pressable>
            </View>

            <TotlText style={{ fontWeight: '900', fontSize: 20, lineHeight: 24, color: t.color.text }}>{title}</TotlText>

            <View
              style={{
                position: 'absolute',
                right: 0,
              }}
            >
              {!forceListMode ? (
                <PredictionsViewToggle value={currentViewMode} onChange={handleViewModeChange} />
              ) : null}
            </View>
          </View>
        </View>
      );
    }

    return (
      <AppTopHeader
        onPressChat={() => navigation.navigate('ChatHub')}
        onPressProfile={() => navigation.navigate('Profile')}
        avatarUrl={avatarUrl}
        title={title}
        hideProfile={isStandalonePredictionsFlow}
        hideChat={isStandalonePredictionsFlow}
      />
    );
  };

  const showInitialSpinner = isLoading && !data && !error;
  const onRefresh = React.useCallback(() => {
    if (isTestMode) return Promise.resolve();
    return refetch();
  }, [isTestMode, refetch]);

  // --- Render modes ---
  if (showInitialSpinner) {
    return (
      <Screen fullBleed backgroundColor={PREDICTIONS_BG}>
        <CenteredSpinner loading />
      </Screen>
    );
  }

  if (mode === 'cards') {
    const cardWidth = Math.min(420, screenWidth - t.space[4] * 2);

    return (
      <Screen fullBleed backgroundColor={PREDICTIONS_BG}>
        <PredictionsHowToSheet
          open={howToOpen}
          onClose={() => setHowToOpen(false)}
          onDontShowAgain={() => {
            setHowToSuppressed(true);
            setHowToOpen(false);
            void AsyncStorage.setItem(HOW_TO_STORAGE_KEY, 'true').catch(() => {});
          }}
        />
        {renderTopBar({
          title: isTestMode ? 'Test' : typeof gw === 'number' ? `Gameweek ${gw}` : 'Predictions',
        })}

        <View style={{ paddingHorizontal: t.space[4], alignItems: 'center', marginTop: 16 }}>
          <View style={{ borderRadius: 999, backgroundColor: '#EAF3F2', paddingHorizontal: 12 }}>
            <PredictionsProgressPills
              total={fixtures.length}
              currentIndex={cardIndex}
              hasPick={(idx) => {
                const f = fixtures[idx];
                if (!f) return false;
                return isPick(picks[f.fixture_index]);
              }}
            />
          </View>
        </View>

        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: t.space[4],
            paddingBottom: t.space[6],
          }}
        >
          {isLoading ? <TotlText variant="muted">Loading…</TotlText> : null}
          {error ? (
            <Card style={[FLAT_CARD_STYLE, { marginBottom: 12, width: '100%' }]}>
              <TotlText variant="heading" style={{ marginBottom: 6 }}>
                Couldn’t load predictions
              </TotlText>
              <TotlText variant="muted">{(error as any)?.message ?? 'Unknown error'}</TotlText>
            </Card>
          ) : null}

          {fixtures.length > 0 ? (
            <PredictionsSwipeDeck
              fixtures={fixtures}
              picks={picks}
              formsByFixtureIndex={formsByFixtureIndex}
              cardWidth={cardWidth}
              screenWidth={screenWidth}
              screenHeight={screenHeight}
              disabled={submitted || deadlineExpired}
              onCommitPick={setPickLocal}
              onCurrentIndexChange={setCardIndex}
              enableCardFlip={isTestMode}
              statsByFixtureIndex={flipStatsByFixtureIndex}
            />
          ) : (
            <Card style={[FLAT_CARD_STYLE, { width: '100%' }]}>
              <TotlText variant="heading" style={{ marginBottom: 6 }}>
                No fixtures yet
              </TotlText>
              <TotlText variant="muted">Pull to refresh.</TotlText>
            </Card>
          )}
        </View>
      </Screen>
    );
  }

  if (mode === 'review') {
    return (
      <Screen fullBleed backgroundColor={PREDICTIONS_BG}>
        {renderTopBar({
          title: isStandalonePredictionsFlow
            ? typeof gw === 'number'
              ? `Gameweek ${gw}`
              : 'Predictions'
            : 'Review',
        })}

        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: t.space[4], paddingBottom: 140 }}
            refreshControl={<TotlRefreshControl refreshing={!isTestMode && isRefetching} onRefresh={onRefresh} />}
          >
            {!reviewTipDismissed ? (
              <View
                style={{
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: 'rgba(148,163,184,0.30)',
                  backgroundColor: '#FFFFFF',
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    backgroundColor: 'rgba(28,131,118,0.14)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}
                >
                  <TotlText style={{ color: '#1C8376', fontWeight: '900' }}>!</TotlText>
                </View>

                <View style={{ flex: 1, paddingRight: 8 }}>
                  <TotlText style={{ fontFamily: 'Gramatika-Medium', fontWeight: '500', lineHeight: 20 }}>
                    Want to change anything? Tap a prediction to update it. Your picks lock in when you confirm.
                  </TotlText>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss tip"
                  onPress={() => {
                    setReviewTipDismissed(true);
                    void AsyncStorage.setItem(REVIEW_TIP_STORAGE_KEY, 'true').catch(() => {});
                  }}
                  style={({ pressed }) => ({
                    padding: 6,
                    marginRight: -6,
                    marginTop: -2,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <TotlText style={{ color: 'rgba(100,116,139,0.7)', fontWeight: '900', fontSize: 18 }}>✕</TotlText>
                </Pressable>
              </View>
            ) : null}

            {confirmError ? (
              <Card style={[FLAT_CARD_STYLE, { marginBottom: 12 }]}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  Couldn’t confirm yet
                </TotlText>
                <TotlText variant="muted">{confirmError}</TotlText>
              </Card>
            ) : null}

            {deadlineExpired ? (
              <Card style={[FLAT_CARD_STYLE, { marginBottom: 12 }]}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  Deadline has passed
                </TotlText>
                <TotlText variant="muted">Predictions are no longer available for this gameweek.</TotlText>
              </Card>
            ) : null}

            {renderGroupedFixtures({ interactive: true })}
          </ScrollView>

          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: t.space[4],
              paddingTop: 12,
              paddingBottom: t.space[6],
              backgroundColor: 'rgba(255,255,255,0.98)',
              borderTopWidth: 1,
              borderTopColor: 'rgba(148,163,184,0.25)',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm predictions"
              disabled={!allPicksMade || submitted || deadlineExpired || confirmMutation.isPending}
              onPress={() => confirmMutation.mutate()}
              style={({ pressed }) => ({
                height: 54,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: allPicksMade ? '#1C8376' : '#CBD5E1',
                opacity: submitted || deadlineExpired || confirmMutation.isPending ? 0.55 : pressed ? 0.92 : 1,
              })}
            >
                <TotlText style={{ color: '#FFFFFF', fontWeight: '900' }}>
                  {confirmMutation.isPending
                    ? isStandalonePredictionsFlow
                      ? 'Submitting…'
                      : 'Confirming…'
                    : isStandalonePredictionsFlow
                      ? 'Submit'
                      : 'Confirm'}
                </TotlText>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  // List mode (submitted or deadline passed)
  return (
    <Screen fullBleed backgroundColor={PREDICTIONS_BG}>
      <AppTopHeader
        onPressChat={() => navigation.navigate('ChatHub')}
        onPressProfile={() => navigation.navigate('Profile')}
        avatarUrl={avatarUrl}
        title={isTestMode ? 'Test' : 'Predictions'}
        leftAction={
          isStandalonePredictionsFlow ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close predictions"
              onPress={closePredictionsFlow}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons name="close" size={24} color={t.color.text} />
            </Pressable>
          ) : undefined
        }
        hideProfile={isStandalonePredictionsFlow}
        hideChat={isStandalonePredictionsFlow}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        // Keep bottom padding consistent across tabbed pages so content isn't obscured by the floating tab bar.
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: t.space[4],
          paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
        }}
        refreshControl={<TotlRefreshControl refreshing={!isTestMode && isRefetching} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? <TotlText variant="muted">Loading…</TotlText> : null}
        {error ? (
          <Card style={[FLAT_CARD_STYLE, { marginBottom: 12 }]}>
            <TotlText variant="heading" style={{ marginBottom: 6 }}>
              Couldn’t load predictions
            </TotlText>
            <TotlText variant="muted">{(error as any)?.message ?? 'Unknown error'}</TotlText>
          </Card>
        ) : null}

        {deadlineExpired && !submitted ? (
          <Card style={[FLAT_CARD_STYLE, { marginBottom: 12 }]}>
            <TotlText variant="heading" style={{ marginBottom: 6 }}>
              Deadline has passed
            </TotlText>
            <TotlText variant="muted">Predictions are no longer available.</TotlText>
          </Card>
        ) : null}

        {submitted ? (
          <Card style={[FLAT_CARD_STYLE, { marginBottom: 12 }]}>
            <TotlText variant="heading" style={{ marginBottom: 6 }}>
              Submitted
            </TotlText>
            <TotlText variant="muted">Your predictions are locked in.</TotlText>
          </Card>
        ) : null}

        {renderGroupedFixtures({ interactive: false })}
      </ScrollView>
    </Screen>
  );
}

