import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TotlText, useTokens } from '@totl/ui';
import type { Fixture, Pick } from '@totl/domain';

import { supabase } from '../../lib/supabase';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { getMediumName } from '../../../../../src/lib/teamNames';
import CenteredSpinner from '../CenteredSpinner';

function toMap<T>(input: unknown): Map<number, T> {
  if (input instanceof Map) {
    const out = new Map<number, T>();
    input.forEach((v, k) => out.set(Number(k), v as T));
    return out;
  }
  if (Array.isArray(input)) {
    const out = new Map<number, T>();
    input.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return;
      out.set(Number(entry[0]), entry[1] as T);
    });
    return out;
  }
  if (input && typeof input === 'object') {
    const out = new Map<number, T>();
    Object.entries(input as Record<string, unknown>).forEach(([k, v]) => out.set(Number(k), v as T));
    return out;
  }
  return new Map<number, T>();
}

export default function LeaderboardPlayerPicksSheet({
  open,
  onClose,
  gw,
  userId,
  userName,
}: {
  open: boolean;
  onClose: () => void;
  gw: number | null;
  userId: string | null;
  userName: string | null;
}) {
  const t = useTokens();
  const ref = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => ['90%'], []);

  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => ref.current?.present());
      return;
    }
    ref.current?.dismiss();
  }, [open]);

  const { data, isLoading } = useQuery({
    enabled: open && typeof gw === 'number' && !!userId,
    // V2: avoid old persisted payload shape where Maps lost methods.
    queryKey: ['leaderboardPlayerPicksV2', gw, userId],
    queryFn: async () => {
      const targetGw = gw as number;
      const targetUserId = String(userId);
      const [fixturesRes, picksRes, resultsRes, liveRes] = await Promise.all([
        supabase.from('app_fixtures').select('*').eq('gw', targetGw).order('fixture_index', { ascending: true }),
        supabase.from('app_picks').select('fixture_index,pick').eq('gw', targetGw).eq('user_id', targetUserId),
        supabase.from('app_gw_results').select('fixture_index,result').eq('gw', targetGw),
        supabase.from('live_scores').select('fixture_index,home_score,away_score,status').eq('gw', targetGw),
      ]);
      if (fixturesRes.error) throw fixturesRes.error;
      if (picksRes.error) throw picksRes.error;
      if (resultsRes.error) throw resultsRes.error;
      if (liveRes.error) throw liveRes.error;

      const fixtures: Fixture[] = (fixturesRes.data ?? []) as Fixture[];
      const picksByFixture = new Map<number, Pick>();
      ((picksRes.data ?? []) as Array<{ fixture_index: number; pick: Pick | string }>).forEach((p) => {
        if (p.pick === 'H' || p.pick === 'D' || p.pick === 'A') picksByFixture.set(Number(p.fixture_index), p.pick);
      });
      const resultByFixture = new Map<number, Pick>();
      ((resultsRes.data ?? []) as Array<{ fixture_index: number; result: Pick | string }>).forEach((r) => {
        if (r.result === 'H' || r.result === 'D' || r.result === 'A') resultByFixture.set(Number(r.fixture_index), r.result);
      });
      const liveByFixture = new Map<number, { home: number | null; away: number | null; status: string | null }>();
      ((liveRes.data ?? []) as Array<{ fixture_index: number; home_score: number | null; away_score: number | null; status: string | null }>).forEach(
        (ls) => {
          liveByFixture.set(Number(ls.fixture_index), {
            home: typeof ls.home_score === 'number' ? ls.home_score : null,
            away: typeof ls.away_score === 'number' ? ls.away_score : null,
            status: typeof ls.status === 'string' ? ls.status : null,
          });
        }
      );

      return { fixtures, picksByFixture, resultByFixture, liveByFixture };
    },
    staleTime: 0,
  });

  const normalized = React.useMemo(() => {
    const fixtures = Array.isArray(data?.fixtures) ? data.fixtures : [];
    return {
      fixtures,
      picksByFixture: toMap<Pick>(data?.picksByFixture),
      resultByFixture: toMap<Pick>(data?.resultByFixture),
      liveByFixture: toMap<{ home: number | null; away: number | null; status: string | null }>(data?.liveByFixture),
    };
  }, [data]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: t.color.surface }}
      handleIndicatorStyle={{ backgroundColor: t.color.border }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
      )}
    >
      <BottomSheetView style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, flex: 1 }}>
        <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
          <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, padding: 2 })}>
            <Ionicons name="close" size={24} color={t.color.muted} />
          </Pressable>
        </View>

        <View style={{ marginBottom: 12 }}>
          <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Bold', fontWeight: '900', fontSize: 16, lineHeight: 18 }}>
            {userName && userName.trim().length > 0 ? userName : 'Player'}
          </TotlText>
          <TotlText style={{ color: '#1C8376', fontFamily: 'Gramatika-Medium', fontWeight: '700', fontSize: 15, lineHeight: 18, marginTop: 2 }}>
            Gameweek {typeof gw === 'number' ? gw : '--'}
          </TotlText>
        </View>

        {isLoading ? (
          <View style={{ height: 220 }}>
            <CenteredSpinner loading />
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
            {normalized.fixtures.map((f) => {
              const fixtureIndex = Number(f.fixture_index);
              const pick = normalized.picksByFixture.get(fixtureIndex) ?? null;
              const official = normalized.resultByFixture.get(fixtureIndex) ?? null;
              const pickCorrect = pick && official ? pick === official : null;
              const live = normalized.liveByFixture.get(fixtureIndex) ?? null;
              const homeCode = String(f.home_code ?? '').toUpperCase();
              const awayCode = String(f.away_code ?? '').toUpperCase();
              const homeBadge = TEAM_BADGES[homeCode] ?? null;
              const awayBadge = TEAM_BADGES[awayCode] ?? null;
              const homeLabel = getMediumName(String((f.home_team ?? f.home_name ?? homeCode) || 'HOME'));
              const awayLabel = getMediumName(String((f.away_team ?? f.away_name ?? awayCode) || 'AWAY'));
              const hasScore = live && typeof live.home === 'number' && typeof live.away === 'number';
              const scoreHomeText = hasScore ? String(live.home) : '-';
              const scoreAwayText = hasScore ? String(live.away) : '-';

              return (
                <View
                  key={`lb-fixture-${fixtureIndex}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderTopWidth: 0,
                    borderTopColor: 'transparent',
                  }}
                >
                  <View style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}>
                    {pickCorrect === true ? (
                      <Ionicons name="checkmark-sharp" size={28} color="#16A34A" />
                    ) : pickCorrect === false ? (
                      <Ionicons name="close-sharp" size={28} color="#DC2626" />
                    ) : (
                      <TotlText
                        style={{
                          color: '#0F172A',
                          fontFamily: 'Gramatika-Bold',
                          fontWeight: '900',
                          fontSize: 20,
                          lineHeight: 20,
                        }}
                      >
                        -
                      </TotlText>
                    )}
                  </View>

                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end', paddingRight: 8 }}>
                      <TotlText
                        numberOfLines={1}
                        style={{
                          color: '#0F172A',
                          fontSize: 12,
                          lineHeight: 13,
                          textAlign: 'right',
                          fontWeight:
                            live && typeof live.home === 'number' && typeof live.away === 'number' && live.home > live.away ? '800' : '600',
                        }}
                      >
                        {homeLabel}
                      </TotlText>
                    </View>

                    <View style={{ width: 84, alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        {homeBadge ? <Image source={homeBadge} style={{ width: 16, height: 16, marginRight: 9 }} /> : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TotlText
                            style={{
                              color: '#0F172A',
                              fontFamily: 'Gramatika-Medium',
                              fontWeight: '700',
                              fontSize: 16,
                              lineHeight: 16,
                            }}
                          >
                            {scoreHomeText}
                          </TotlText>
                          <TotlText
                            style={{
                              color: '#334155',
                              marginHorizontal: 4,
                              fontFamily: 'Gramatika-Medium',
                              fontWeight: '700',
                              fontSize: 16,
                              lineHeight: 16,
                            }}
                          >
                            -
                          </TotlText>
                          <TotlText
                            style={{
                              color: '#0F172A',
                              fontFamily: 'Gramatika-Medium',
                              fontWeight: '700',
                              fontSize: 16,
                              lineHeight: 16,
                            }}
                          >
                            {scoreAwayText}
                          </TotlText>
                        </View>
                        {awayBadge ? <Image source={awayBadge} style={{ width: 16, height: 16, marginLeft: 9 }} /> : null}
                      </View>
                    </View>

                    <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start', paddingLeft: 8 }}>
                      <TotlText
                        numberOfLines={1}
                        style={{
                          color: '#0F172A',
                          fontSize: 12,
                          lineHeight: 13,
                          fontWeight:
                            live && typeof live.home === 'number' && typeof live.away === 'number' && live.away > live.home ? '800' : '600',
                        }}
                      >
                        {awayLabel}
                      </TotlText>
                    </View>
                  </View>

                  {pickCorrect === true ? (
                    <LinearGradient
                      colors={['#F59E0B', '#EC4899', '#9333EA']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ marginLeft: 8, minWidth: 64, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}
                    >
                      <TotlText
                        style={{
                          textAlign: 'center',
                          color: '#FFFFFF',
                          fontSize: 11,
                          lineHeight: 11,
                          fontFamily: 'Gramatika-Medium',
                          fontWeight: '700',
                        }}
                      >
                        {pick === 'H' ? 'Home' : pick === 'D' ? 'Draw' : pick === 'A' ? 'Away' : '-'}
                      </TotlText>
                    </LinearGradient>
                  ) : (
                    <View
                      style={{
                        marginLeft: 8,
                        minWidth: 64,
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        backgroundColor: pickCorrect === false ? '#94A3B8' : 'rgba(15,23,42,0.12)',
                      }}
                    >
                      <TotlText
                        style={{
                          textAlign: 'center',
                          color: '#0F172A',
                          fontSize: 11,
                          lineHeight: 11,
                          fontFamily: 'Gramatika-Medium',
                          fontWeight: '800',
                          textDecorationLine: 'none',
                        }}
                      >
                        {pick === 'H' ? 'Home' : pick === 'D' ? 'Draw' : pick === 'A' ? 'Away' : '-'}
                      </TotlText>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
