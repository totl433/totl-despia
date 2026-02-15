import React from 'react';
import { Image, Linking, Pressable, ScrollView, Share, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Asset } from 'expo-asset';
import type { GwResults, HomeSnapshot, Pick, ProfileSummary } from '@totl/domain';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgUri } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';

import type { RootStackParamList } from '../navigation/AppNavigator';
import { api } from '../lib/api';
import { getDefaultMlAvatarFilename, resolveLeagueAvatarUri } from '../lib/leagueAvatars';
import { TEAM_BADGES } from '../lib/teamBadges';
import { getMediumName } from '../../../../src/lib/teamNames';
import PageHeader from '../components/PageHeader';
import CenteredSpinner from '../components/CenteredSpinner';
import ShareResultsTray from '../components/results/ShareResultsTray';

type Route = {
  key: string;
  name: 'GameweekResults';
  params: RootStackParamList['GameweekResults'];
};

function ordinalSuffix(rank: number): string {
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

function ShareCaptureCard({
  gw,
  results,
  snapshot,
  userName,
  mode = 'roundup',
  width = 390,
  fixedHeight,
}: {
  gw: number;
  results: GwResults;
  snapshot: HomeSnapshot | null;
  userName?: string | null;
  mode?: 'roundup' | 'fixturesOnly';
  width?: number;
  fixedHeight?: number;
}) {
  const VolleyPlaying = require('../../../../public/assets/Volley/Volley-playing.png');
  const VolleyLeaning = require('../../../../public/assets/Volley/Volley-Leaning-With-Ball.png');
  const t = useTokens();
  const isFixturesOnly = mode === 'fixturesOnly';
  const totlLogoUri = Asset.fromModule(require('../../../../public/assets/badges/totl-logo1.svg')).uri;

  const topPercentLabel = (() => {
    if (!results?.gwRank || !results?.gwRankTotal) return null;
    const pct = Math.max(1, Math.min(100, Math.round((results.gwRank / results.gwRankTotal) * 100)));
    return `Top ${pct}%`;
  })();

  const fixtures = [...(snapshot?.fixtures ?? [])].sort((a, b) => Number(a.fixture_index) - Number(b.fixture_index));
  const userPicks = snapshot?.userPicks ?? {};
  const resultByFixture = new Map<number, Pick>();
  (snapshot?.gwResults ?? []).forEach((r) => {
    resultByFixture.set(Number(r.fixture_index), r.result as Pick);
  });
  const liveByFixture = new Map<number, { home: number | null; away: number | null; status: string | null }>();
  (snapshot?.liveScores ?? []).forEach((ls) => {
    liveByFixture.set(Number(ls.fixture_index), {
      home: typeof ls.home_score === 'number' ? ls.home_score : null,
      away: typeof ls.away_score === 'number' ? ls.away_score : null,
      status: typeof ls.status === 'string' ? ls.status : null,
    });
  });

  return (
    <View
      collapsable={false}
      style={{
        width,
        backgroundColor: '#FFFFFF',
        ...(typeof fixedHeight === 'number' && fixedHeight > 0 ? { height: fixedHeight, overflow: 'hidden' } : {}),
      }}
    >
      {/* Header */}
      <View
        style={{
          height: 92,
          backgroundColor: '#1C8376',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isFixturesOnly ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image
              source={VolleyLeaning}
              style={{ width: 56, height: 56, resizeMode: 'contain', marginRight: -14, transform: [{ scaleX: -1 }] }}
            />
            <View style={{ marginLeft: -24 }}>
              <SvgUri uri={totlLogoUri} width={108} height={56} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={VolleyPlaying} style={{ width: 50, height: 50, resizeMode: 'contain', marginRight: -10 }} />
            <View style={{ marginLeft: -14 }}>
              <SvgUri uri={totlLogoUri} width={120} height={58} />
            </View>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 18, paddingVertical: 18 }}>
        {isFixturesOnly ? (
          <View style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View
                style={{
                  minWidth: 78,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: '#64748B',
                }}
              >
                <TotlText style={{ textAlign: 'center', color: '#FFFFFF', fontFamily: 'Gramatika-Bold', fontWeight: '900', fontSize: 16, lineHeight: 16 }}>
                  {String(results.score)}/{String(results.totalFixtures)}
                </TotlText>
              </View>

              <View style={{ alignItems: 'center', flex: 1 }}>
                <TotlText style={{ color: '#1C8376', fontFamily: 'Gramatika-Medium', fontWeight: '700', fontSize: 18, lineHeight: 20 }}>
                  Gameweek {gw}
                </TotlText>
                <TotlText style={{ color: '#0F172A', fontFamily: 'Gramatika-Bold', fontWeight: '900', fontSize: 16, lineHeight: 18 }}>
                  {userName && userName.trim().length > 0 ? userName : 'You'}
                </TotlText>
              </View>

              <View
                style={{
                  minWidth: 96,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: '#64748B',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'baseline',
                }}
              >
                <TotlText style={{ color: '#FFFFFF', fontFamily: 'Gramatika-Medium', fontWeight: '700', fontSize: 13, lineHeight: 13, marginRight: 5 }}>
                  Top
                </TotlText>
                <TotlText style={{ color: '#FFFFFF', fontFamily: 'Gramatika-Bold', fontWeight: '900', fontSize: 16, lineHeight: 16 }}>
                  {topPercentLabel ? topPercentLabel.replace('Top ', '') : '--'}
                </TotlText>
              </View>
            </View>
          </View>
        ) : (
          <TotlText
            style={{
              textAlign: 'center',
              fontFamily: 'Gramatika-Bold',
              fontWeight: '900',
              fontSize: 18,
              lineHeight: 22,
              color: '#0F172A',
              marginBottom: 12,
            }}
          >
            Gameweek {gw} Results
          </TotlText>
        )}

        {!isFixturesOnly ? (
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={VolleyPlaying} style={{ width: 58, height: 58, resizeMode: 'contain', marginRight: 8 }} />
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <TotlText
                style={{
                  fontSize: 44,
                  lineHeight: 44,
                  fontFamily: 'Gramatika-Bold',
                  fontWeight: '900',
                  color: '#1C8376',
                }}
              >
                {String(results.score)}
              </TotlText>
              <TotlText
                style={{
                  fontSize: 32,
                  lineHeight: 38,
                  fontFamily: 'Gramatika-Bold',
                  fontWeight: '900',
                  color: '#1C8376',
                }}
              >
                /{String(results.totalFixtures)}
              </TotlText>
            </View>
          </View>
        </View>
        ) : null}

        {!isFixturesOnly && results.mlVictories > 0 ? (
          <View style={{ marginBottom: 14 }}>
            <TotlText style={{ textAlign: 'center', fontFamily: 'Gramatika-Bold', fontWeight: '900', marginBottom: 10 }}>
              Won {results.mlVictories} Mini-League{results.mlVictories === 1 ? '' : 's'}!
            </TotlText>
            <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
              {(results.mlVictoryData ?? []).slice(0, 4).map((l) => {
                const id = String(l.id);
                const name = String(l.name ?? 'League');
                const uri =
                  resolveLeagueAvatarUri(l.avatar ?? null) ?? resolveLeagueAvatarUri(getDefaultMlAvatarFilename(id)) ?? null;
                return (
                  <View key={id} style={{ width: 78, alignItems: 'center', marginHorizontal: 6, marginBottom: 10 }}>
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 23,
                        backgroundColor: 'rgba(15,23,42,0.06)',
                        overflow: 'hidden',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 6,
                      }}
                    >
                      {uri ? <Image source={{ uri }} style={{ width: 46, height: 46 }} /> : null}
                    </View>
                    <TotlText numberOfLines={1} style={{ fontSize: 11, lineHeight: 13, color: t.color.muted, maxWidth: 72 }}>
                      {name}
                    </TotlText>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {!isFixturesOnly && results.gwRank && results.gwRankTotal ? (
          <View
            style={{
              backgroundColor: 'rgba(15,23,42,0.04)',
              borderRadius: 16,
              paddingVertical: 12,
              paddingHorizontal: 12,
            }}
          >
            <TotlText style={{ textAlign: 'center', color: t.color.muted, marginBottom: 8 }}>Gameweek {gw} Leaderboard</TotlText>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <TotlText style={{ fontFamily: 'Gramatika-Bold', fontWeight: '900', fontSize: 34, lineHeight: 36 }}>
                  {String(results.gwRank)}
                </TotlText>
                <TotlText style={{ marginLeft: 6, color: t.color.muted, fontSize: 12 }}>
                  {ordinalSuffix(results.gwRank)} of {String(results.gwRankTotal)}
                </TotlText>
              </View>
              {topPercentLabel ? (
                <TotlText style={{ marginLeft: 12, fontFamily: 'Gramatika-Bold', fontWeight: '900', color: '#1C8376', fontSize: 22 }}>
                  {topPercentLabel}
                </TotlText>
              ) : null}
            </View>
          </View>
        ) : null}

        {isFixturesOnly && fixtures.length > 0 ? (
          <View style={{ marginTop: isFixturesOnly ? 0 : 14 }}>
            {!isFixturesOnly ? <TotlText style={{ textAlign: 'center', color: t.color.muted, marginBottom: 8 }}>Fixtures</TotlText> : null}
            <View
              style={{
                borderWidth: 0,
                borderColor: 'transparent',
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              {fixtures.map((f, idx) => {
                const fixtureIndex = Number(f.fixture_index);
                const pick = (userPicks[String(fixtureIndex)] as Pick | undefined) ?? null;
                const official = resultByFixture.get(fixtureIndex) ?? null;
                const pickCorrect = pick && official ? pick === official : null;
                const live = liveByFixture.get(fixtureIndex) ?? null;
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
                    key={`share-fixture-${fixtureIndex}`}
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
                        <TotlText style={{ color: 'rgba(15,23,42,0.4)', fontFamily: 'Gramatika-Bold', fontWeight: '900', fontSize: 20, lineHeight: 20 }}>
                          -
                        </TotlText>
                      )}
                    </View>

                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end', paddingRight: 8 }}>
                        <TotlText
                          numberOfLines={1}
                          style={{
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
                            <TotlText style={{ fontFamily: 'Gramatika-Medium', fontWeight: '700', fontSize: 16, lineHeight: 16 }}>
                              {scoreHomeText}
                            </TotlText>
                            <TotlText
                              style={{
                                marginHorizontal: 4,
                                fontFamily: 'Gramatika-Medium',
                                fontWeight: '700',
                                fontSize: 16,
                                lineHeight: 16,
                              }}
                            >
                              -
                            </TotlText>
                            <TotlText style={{ fontFamily: 'Gramatika-Medium', fontWeight: '700', fontSize: 16, lineHeight: 16 }}>
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
                        style={{
                          marginLeft: 8,
                          minWidth: 64,
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                        }}
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
                            color: '#FFFFFF',
                            fontSize: 11,
                            lineHeight: 11,
                            fontFamily: 'Gramatika-Medium',
                            fontWeight: '700',
                            textDecorationLine: pickCorrect === false ? 'line-through' : 'none',
                          }}
                        >
                          {pick === 'H' ? 'Home' : pick === 'D' ? 'Draw' : pick === 'A' ? 'Away' : '-'}
                        </TotlText>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function GameweekResultsModalScreen() {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const gw = route.params?.gw ?? null;
  const mode = route.params?.mode ?? 'roundup';
  const isFixturesShareMode = mode === 'fixturesShare';
  const shareShotRef = React.useRef<any>(null);
  const [sharing, setSharing] = React.useState(false);
  const [shareSnapshot, setShareSnapshot] = React.useState<HomeSnapshot | null>(null);
  const [fixturesCardHeight, setFixturesCardHeight] = React.useState<number>(0);
  const [selectedShareAssetIndex, setSelectedShareAssetIndex] = React.useState(0);
  const selectedShareAssetMode: 'fixturesOnly' | 'roundup' = selectedShareAssetIndex === 1 ? 'roundup' : 'fixturesOnly';

  const { data: results, isLoading, error } = useQuery<GwResults>({
    enabled: typeof gw === 'number',
    queryKey: ['gwResults', gw],
    queryFn: () => api.getGwResults(gw as number),
  });
  const { data: shareSnapshotFromQuery } = useQuery<HomeSnapshot>({
    enabled: typeof gw === 'number' && isFixturesShareMode,
    queryKey: ['homeSnapshot', 'share', gw],
    queryFn: () => api.getHomeSnapshot({ gw: gw as number }),
  });
  const { data: profileSummary } = useQuery<ProfileSummary>({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });
  const shareUserName = profileSummary?.name ?? null;
  const effectiveShareSnapshot = shareSnapshot ?? shareSnapshotFromQuery ?? null;
  const shareSummaryText = React.useMemo(() => {
    if (typeof gw !== 'number' || !results) return 'Check out my TOTL results!';
    const name = shareUserName?.trim() ? `${shareUserName} ` : '';
    return `${name}scored ${results.score}/${results.totalFixtures} in TOTL Gameweek ${gw}.`;
  }, [gw, results, shareUserName]);

  const trophyCount = React.useMemo(() => {
    if (!results) return 0;
    return Object.values(results.trophies ?? {}).filter(Boolean).length;
  }, [results]);

  const topPercentLabel = React.useMemo(() => {
    if (!results?.gwRank || !results?.gwRankTotal) return null;
    const pct = Math.max(1, Math.min(100, Math.round((results.gwRank / results.gwRankTotal) * 100)));
    return `Top ${pct}%`;
  }, [results?.gwRank, results?.gwRankTotal]);

  const VolleyPlaying = require('../../../../public/assets/Volley/Volley-playing.png');
  const Badge5 = require('../../../../public/assets/5-week-form-badge.png');
  const Badge10 = require('../../../../public/assets/10-week-form-badge.png');
  const BadgeSeason = require('../../../../public/assets/season-rank-badge.png');

  const buildShareImageFile = React.useCallback(async () => {
    if (typeof gw !== 'number') return null;
    if (!effectiveShareSnapshot) {
      try {
        const snap = await api.getHomeSnapshot({ gw });
        setShareSnapshot(snap);
        // Let React commit the snapshot into the off-screen card before capture.
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch {
        // Share still works with the core card even if snapshot fetch fails.
      }
    }

    const uri: string | undefined = await shareShotRef.current?.capture?.();
    if (!uri) return null;

    const fileName = `gw${gw}-results-${Date.now()}.png`;
    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDir) return null;
    const dest = `${baseDir}${fileName}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  }, [effectiveShareSnapshot, gw]);

  const shareImageSheet = React.useCallback(
    async (dialogTitle: string) => {
      if (!results || typeof gw !== 'number') return;
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        await Share.share({ message: `TOTL — Gameweek ${gw}\n${results.score}/${results.totalFixtures}` });
        return;
      }
      const dest = await buildShareImageFile();
      if (!dest) {
        await Share.share({ message: shareSummaryText });
        return;
      }
      await Sharing.shareAsync(dest, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle,
      });
    },
    [buildShareImageFile, gw, results, shareSummaryText]
  );

  const handleShare = React.useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      await shareImageSheet(typeof gw === 'number' ? `Share GW${gw} results` : 'Share results');
    } finally {
      setSharing(false);
    }
  }, [gw, shareImageSheet, sharing]);

  const handleShareInstagram = React.useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const canOpenInstagram = await Linking.canOpenURL('instagram://app');
      if (!canOpenInstagram) {
        await shareImageSheet(typeof gw === 'number' ? `Share GW${gw} results` : 'Share results');
        return;
      }
      await shareImageSheet('Share to Instagram');
    } finally {
      setSharing(false);
    }
  }, [gw, shareImageSheet, sharing]);

  const handleShareWhatsApp = React.useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const waUrl = `whatsapp://send?text=${encodeURIComponent(shareSummaryText)}`;
      const canOpenWhatsApp = await Linking.canOpenURL(waUrl);
      if (canOpenWhatsApp) {
        await Linking.openURL(waUrl);
        return;
      }
      await shareImageSheet(typeof gw === 'number' ? `Share GW${gw} results` : 'Share results');
    } finally {
      setSharing(false);
    }
  }, [gw, shareImageSheet, shareSummaryText, sharing]);

  const closeScreen = React.useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    const parentNav = navigation.getParent?.();
    if (parentNav?.canGoBack?.()) {
      parentNav.goBack();
      return;
    }

    navigation.navigate('Tabs');
  }, [navigation]);
  const closeFixturesShare = React.useCallback(() => {
    closeScreen();
  }, [closeScreen]);

  React.useEffect(() => {
    if (!isFixturesShareMode) return;
    setSelectedShareAssetIndex(0);
    setFixturesCardHeight(0);
  }, [gw, isFixturesShareMode]);

  if (isLoading && !results && !error) {
    return (
      <Screen fullBleed>
        <View style={{ flex: 1 }}>
          <PageHeader
            title="Performance"
            subtitle={typeof gw === 'number' ? `Gameweek ${gw} results` : 'Gameweek results'}
            // Local fix: prevent large title glyphs clipping at top in this modal.
            style={{ paddingTop: t.space[2] + 20 }}
            rightAction={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => navigation.goBack()}
                style={({ pressed }) => ({
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 16,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Ionicons name="close" size={22} color={t.color.text} />
              </Pressable>
            }
          />
          <CenteredSpinner loading />
        </View>
      </Screen>
    );
  }

  if (isFixturesShareMode) {
    const PREVIEW_CARD_BASE_WIDTH = 390;
    const PREVIEW_CARD_SCALE = 0.78;
    const PREVIEW_CARD_DISPLAY_WIDTH = Math.round(PREVIEW_CARD_BASE_WIDTH * PREVIEW_CARD_SCALE);
    const PREVIEW_CARD_GAP = 10;
    const PREVIEW_CAROUSEL_PEEK = 14;
    const PREVIEW_CAROUSEL_VIEWPORT_WIDTH = PREVIEW_CARD_DISPLAY_WIDTH + PREVIEW_CAROUSEL_PEEK;
    const PREVIEW_CARD_PAGE_WIDTH = PREVIEW_CARD_DISPLAY_WIDTH + PREVIEW_CARD_GAP;
    const previewDisplayHeight =
      fixturesCardHeight > 0 ? Math.round(fixturesCardHeight * PREVIEW_CARD_SCALE) : undefined;
    const SHARE_FOOTER_HEIGHT = 120;
    const SHARE_FOOTER_RESERVED = insets.bottom + SHARE_FOOTER_HEIGHT + 20;
    const INDICATOR_BOTTOM_GAP = 12;
    const DOT_INDICATOR_SIZE = 10;
    const TRAY_CHROME_HEIGHT = 78;
    const estimatedCardFrameHeight = typeof previewDisplayHeight === 'number' ? previewDisplayHeight + 20 : 520;
    const minTopGap = Math.max(insets.top + 6, 36);
    const maxTopGap = Math.max(insets.top + 36, 82);
    // Keep a visible top peek while maximizing vertical room for the share card.
    const adaptiveTopGap = windowHeight - (estimatedCardFrameHeight + SHARE_FOOTER_RESERVED + TRAY_CHROME_HEIGHT);
    const TOP_GAP_PX = Math.max(minTopGap, Math.min(maxTopGap, adaptiveTopGap));
    return (
      <View style={{ flex: 1 }}>
        <ShareResultsTray
          topGapPx={TOP_GAP_PX}
          footerReserved={SHARE_FOOTER_RESERVED}
          footerBottomInset={insets.bottom + 8}
          contentTopInset={0}
          indicatorBottomOffset={INDICATOR_BOTTOM_GAP}
          indicatorReservedHeight={DOT_INDICATOR_SIZE + INDICATOR_BOTTOM_GAP + 8}
          indicator={
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: DOT_INDICATOR_SIZE,
                  height: DOT_INDICATOR_SIZE,
                  borderRadius: 999,
                  marginRight: 8,
                  backgroundColor: selectedShareAssetIndex === 0 ? '#1C8376' : 'rgba(100,116,139,0.45)',
                }}
              />
              <View
                style={{
                  width: DOT_INDICATOR_SIZE,
                  height: DOT_INDICATOR_SIZE,
                  borderRadius: 999,
                  backgroundColor: selectedShareAssetIndex === 1 ? '#1C8376' : 'rgba(100,116,139,0.45)',
                }}
              />
            </View>
          }
          onClose={closeFixturesShare}
          footer={
            <View style={{ width: '100%', alignSelf: 'center', maxWidth: 420 }}>
              <TotlText style={{ color: t.color.muted, marginBottom: 10 }}>Share to</TotlText>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Share to Instagram"
                  onPress={handleShareInstagram}
                  disabled={sharing || !results}
                  style={({ pressed }) => ({
                    width: 84,
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    opacity: sharing || !results ? 0.5 : pressed ? 0.86 : 1,
                  })}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#EC4899', '#9333EA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="logo-instagram" size={24} color="#FFFFFF" />
                  </LinearGradient>
                  <TotlText
                    style={{ marginTop: 8, fontSize: 12, lineHeight: 12, fontFamily: 'Gramatika-Medium', fontWeight: '600' }}
                  >
                    Instagram
                  </TotlText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Share to WhatsApp"
                  onPress={handleShareWhatsApp}
                  disabled={sharing || !results}
                  style={({ pressed }) => ({
                    width: 84,
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    opacity: sharing || !results ? 0.5 : pressed ? 0.86 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#25D366',
                    }}
                  >
                    <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
                  </View>
                  <TotlText
                    style={{ marginTop: 8, fontSize: 12, lineHeight: 12, fontFamily: 'Gramatika-Medium', fontWeight: '600' }}
                  >
                    WhatsApp
                  </TotlText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="More share options"
                  onPress={handleShare}
                  disabled={sharing || !results}
                  style={({ pressed }) => ({
                    width: 84,
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    opacity: sharing || !results ? 0.5 : pressed ? 0.86 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#FFFFFF',
                      borderWidth: 1,
                      borderColor: '#DFEBE9',
                    }}
                  >
                    <Ionicons name="share-social-outline" size={24} color="#111827" />
                  </View>
                  <TotlText
                    style={{ marginTop: 8, fontSize: 12, lineHeight: 12, fontFamily: 'Gramatika-Medium', fontWeight: '600' }}
                  >
                    More
                  </TotlText>
                </Pressable>
              </View>
            </View>
          }
        >
          {results ? (
            <View
              style={{
                width: PREVIEW_CAROUSEL_VIEWPORT_WIDTH,
                flex: 1,
                overflow: 'visible',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 0,
              }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={PREVIEW_CARD_PAGE_WIDTH}
                snapToAlignment="start"
                style={{
                  width: PREVIEW_CAROUSEL_VIEWPORT_WIDTH,
                  height: typeof previewDisplayHeight === 'number' ? previewDisplayHeight : undefined,
                  overflow: 'visible',
                  marginTop: 0,
                }}
                contentContainerStyle={{
                  alignItems: 'center',
                  paddingVertical: 0,
                  paddingRight: PREVIEW_CAROUSEL_PEEK,
                }}
                onMomentumScrollEnd={(e) => {
                  const rawIndex = e.nativeEvent.contentOffset.x / PREVIEW_CARD_PAGE_WIDTH;
                  const nextIndex = Math.max(0, Math.min(1, Math.round(rawIndex)));
                  setSelectedShareAssetIndex(nextIndex);
                }}
              >
                {(['fixturesOnly', 'roundup'] as const).map((assetMode, idx) => (
                  <View
                    key={`share-asset-${assetMode}`}
                    style={{
                      width: PREVIEW_CARD_DISPLAY_WIDTH,
                      marginRight: idx === 1 ? 0 : PREVIEW_CARD_GAP,
                      overflow: 'visible',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: PREVIEW_CARD_DISPLAY_WIDTH,
                        height: previewDisplayHeight,
                        position: 'relative',
                        shadowOpacity: 0.16,
                        shadowRadius: 18,
                        shadowOffset: { width: 0, height: 10 },
                        elevation: 8,
                        overflow: 'visible',
                      }}
                    >
                      <View
                        style={{
                          position: 'absolute',
                          left: (PREVIEW_CARD_DISPLAY_WIDTH - PREVIEW_CARD_BASE_WIDTH) / 2,
                          top:
                            typeof previewDisplayHeight === 'number' && fixturesCardHeight > 0
                              ? (previewDisplayHeight - fixturesCardHeight) / 2
                              : 0,
                          width: PREVIEW_CARD_BASE_WIDTH,
                          height: fixturesCardHeight > 0 ? fixturesCardHeight : undefined,
                          transform: [{ scale: PREVIEW_CARD_SCALE }],
                        }}
                      >
                        <Card
                          onLayout={
                            idx === 0
                              ? (e) => {
                                  const nextHeight = Math.round(e.nativeEvent.layout.height);
                                  if (nextHeight > 0 && nextHeight !== fixturesCardHeight) setFixturesCardHeight(nextHeight);
                                }
                              : undefined
                          }
                          style={{
                            width: PREVIEW_CARD_BASE_WIDTH,
                            height: fixturesCardHeight > 0 ? fixturesCardHeight : undefined,
                            padding: 0,
                            overflow: 'hidden',
                          }}
                        >
                          <ShareCaptureCard
                            gw={gw as number}
                            results={results}
                            snapshot={effectiveShareSnapshot}
                            userName={shareUserName}
                            mode={assetMode}
                            width={PREVIEW_CARD_BASE_WIDTH}
                            fixedHeight={fixturesCardHeight > 0 ? fixturesCardHeight : undefined}
                          />
                        </Card>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>

            </View>
          ) : null}
        </ShareResultsTray>

        {/* Off-screen capture card for PNG sharing */}
        {results && typeof gw === 'number' ? (
          <ViewShot
            ref={shareShotRef}
            options={{ format: 'png', quality: 1, result: 'tmpfile' }}
            style={{ position: 'absolute', left: -9999, top: 0, backgroundColor: '#FFFFFF' }}
          >
            <ShareCaptureCard
              gw={gw}
              results={results}
              snapshot={effectiveShareSnapshot}
              userName={shareUserName}
              mode={selectedShareAssetMode}
              fixedHeight={fixturesCardHeight > 0 ? fixturesCardHeight : undefined}
            />
          </ViewShot>
        ) : null}
      </View>
    );
  }

  return (
    <Screen fullBleed>
      <View style={{ flex: 1 }}>
        <PageHeader
          title="Performance"
          subtitle={typeof gw === 'number' ? `Gameweek ${gw} results` : 'Gameweek results'}
          // Local fix: prevent large title glyphs clipping at top in this modal.
          style={{ paddingTop: t.space[2] + 60 }}
          rightAction={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 16,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons name="close" size={22} color={t.color.text} />
            </Pressable>
          }
        />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: t.space[4],
            paddingTop: t.space[2],
            paddingBottom: t.space[12] + 80,
          }}
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <Card
              style={{
                marginTop: 12,
                shadowOpacity: 0,
                shadowRadius: 0,
                shadowOffset: { width: 0, height: 0 },
                elevation: 0,
              }}
            >
              <TotlText variant="heading" style={{ marginBottom: 6 }}>
                Couldn’t load results
              </TotlText>
              <TotlText variant="muted">{String((error as any)?.message ?? 'Unknown error')}</TotlText>
            </Card>
          ) : null}

          {results ? (
            <View>
              {/* Score */}
              <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image
                    source={VolleyPlaying}
                    style={{
                      width: 72,
                      height: 72,
                      marginRight: 8,
                      resizeMode: 'contain',
                    }}
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                    <TotlText
                      style={{
                        fontSize: 56,
                        lineHeight: 56,
                        fontWeight: '900',
                        color: '#1C8376',
                        fontFamily: 'Gramatika-Bold',
                      }}
                    >
                      {String(results.score)}
                    </TotlText>
                    <TotlText
                      style={{
                        fontSize: 40,
                        lineHeight: 48,
                        fontWeight: '900',
                        color: '#1C8376',
                        fontFamily: 'Gramatika-Bold',
                        marginLeft: 2,
                      }}
                    >
                      /{String(results.totalFixtures)}
                    </TotlText>
                  </View>
                </View>
              </View>

              {/* Trophies */}
              {trophyCount > 0 ? (
                <View style={{ marginBottom: 18 }}>
                  <LinearGradient
                    colors={['#F59E0B', '#EC4899', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 18,
                      paddingVertical: 18,
                      paddingHorizontal: 16,
                      overflow: 'hidden',
                    }}
                  >
                    <TotlText
                      style={{
                        color: '#FFFFFF',
                        fontFamily: 'Gramatika-Bold',
                        fontWeight: '900',
                        fontSize: 20,
                        lineHeight: 22,
                        textAlign: 'center',
                        marginBottom: 12,
                      }}
                    >
                      Trophies Earned!
                    </TotlText>

                    <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {results.trophies.form10 ? (
                        <View style={{ alignItems: 'center', marginHorizontal: 14, marginBottom: 10 }}>
                          <Image source={Badge10} style={{ width: 46, height: 46, resizeMode: 'contain' }} />
                          <TotlText style={{ color: 'rgba(255,255,255,0.92)', marginTop: 6 }}>10-Week Form</TotlText>
                        </View>
                      ) : null}
                      {results.trophies.form5 ? (
                        <View style={{ alignItems: 'center', marginHorizontal: 14, marginBottom: 10 }}>
                          <Image source={Badge5} style={{ width: 46, height: 46, resizeMode: 'contain' }} />
                          <TotlText style={{ color: 'rgba(255,255,255,0.92)', marginTop: 6 }}>5-Week Form</TotlText>
                        </View>
                      ) : null}
                      {results.trophies.overall ? (
                        <View style={{ alignItems: 'center', marginHorizontal: 14, marginBottom: 10 }}>
                          <Image source={BadgeSeason} style={{ width: 46, height: 46, resizeMode: 'contain' }} />
                          <TotlText style={{ color: 'rgba(255,255,255,0.92)', marginTop: 6 }}>Overall</TotlText>
                        </View>
                      ) : null}
                      {results.trophies.gw ? (
                        <View style={{ alignItems: 'center', marginHorizontal: 14, marginBottom: 10 }}>
                          <Ionicons name="trophy" size={42} color="#FFFFFF" />
                          <TotlText style={{ color: 'rgba(255,255,255,0.92)', marginTop: 6 }}>GW Winner</TotlText>
                        </View>
                      ) : null}
                    </View>
                  </LinearGradient>
                </View>
              ) : null}

              {/* Mini-league wins */}
              {results.mlVictories > 0 ? (
                <View style={{ marginBottom: 18 }}>
                  <TotlText
                    style={{
                      textAlign: 'center',
                      fontFamily: 'Gramatika-Bold',
                      fontWeight: '900',
                      fontSize: 22,
                      lineHeight: 24,
                      marginBottom: 12,
                    }}
                  >
                    Won {results.mlVictories} Mini-League{results.mlVictories === 1 ? '' : 's'}!
                  </TotlText>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 2 }}>
                    {(results.mlVictoryData ?? []).map((l) => {
                      const id = String(l.id);
                      const name = String(l.name ?? 'League');
                      const defaultAvatar = getDefaultMlAvatarFilename(id);
                      const uri = resolveLeagueAvatarUri(l.avatar ?? null) ?? resolveLeagueAvatarUri(defaultAvatar) ?? null;
                      return (
                        <View
                          key={id}
                          style={{
                            width: 86,
                            paddingVertical: 10,
                            paddingHorizontal: 8,
                            borderRadius: 14,
                            backgroundColor: 'rgba(15,23,42,0.04)',
                            alignItems: 'center',
                            marginRight: 10,
                          }}
                        >
                          <View
                            style={{
                              width: 54,
                              height: 54,
                              borderRadius: 27,
                              backgroundColor: 'rgba(15,23,42,0.06)',
                              overflow: 'hidden',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: 8,
                            }}
                          >
                            {uri ? (
                              <Image source={{ uri }} style={{ width: 54, height: 54 }} />
                            ) : (
                              <Ionicons name="people" size={26} color={t.color.muted} />
                            )}
                          </View>
                          <TotlText numberOfLines={1} style={{ fontSize: 12, lineHeight: 14, color: t.color.muted, maxWidth: 70 }}>
                            {name}
                          </TotlText>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {/* GW leaderboard position */}
              {results.gwRank && results.gwRankTotal ? (
                <Card
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    marginBottom: 12,
                    shadowOpacity: 0,
                    shadowRadius: 0,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 0,
                  }}
                >
                  <TotlText variant="sectionSubtitle" style={{ textAlign: 'center', marginBottom: 8 }}>
                    Gameweek {gw} Leaderboard
                  </TotlText>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <TotlText
                        style={{
                          fontFamily: 'Gramatika-Bold',
                          fontWeight: '900',
                          fontSize: 42,
                          lineHeight: 44,
                          color: t.color.text,
                        }}
                      >
                        {String(results.gwRank)}
                      </TotlText>
                      <TotlText style={{ marginLeft: 6, color: t.color.muted }}>
                        {ordinalSuffix(results.gwRank)} of {String(results.gwRankTotal)}
                      </TotlText>
                    </View>
                    {topPercentLabel ? (
                      <TotlText
                        style={{
                          marginLeft: 14,
                          fontFamily: 'Gramatika-Bold',
                          fontWeight: '900',
                          fontSize: 28,
                          lineHeight: 34,
                          color: '#1C8376',
                        }}
                      >
                        {topPercentLabel}
                      </TotlText>
                    ) : null}
                  </View>
                </Card>
              ) : null}

              {/* Compact ranks row */}
              {results.leaderboardChanges?.overall?.after ||
              results.leaderboardChanges?.form5?.after ||
              results.leaderboardChanges?.form10?.after ? (
                <Card
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    marginBottom: 18,
                    shadowOpacity: 0,
                    shadowRadius: 0,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 0,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {results.leaderboardChanges?.overall?.after ? (
                      <TotlText style={{ marginHorizontal: 10 }}>
                        Overall: <TotlText style={{ fontWeight: '900' }}>#{results.leaderboardChanges.overall.after}</TotlText>
                      </TotlText>
                    ) : null}
                    {results.leaderboardChanges?.form5?.after ? (
                      <TotlText style={{ marginHorizontal: 10 }}>
                        5W: <TotlText style={{ fontWeight: '900' }}>#{results.leaderboardChanges.form5.after}</TotlText>
                      </TotlText>
                    ) : null}
                    {results.leaderboardChanges?.form10?.after ? (
                      <TotlText style={{ marginHorizontal: 10 }}>
                        10W: <TotlText style={{ fontWeight: '900' }}>#{results.leaderboardChanges.form10.after}</TotlText>
                      </TotlText>
                    ) : null}
                  </View>
                </Card>
              ) : null}

              {/* Share button (wired in next todo) */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share results"
                onPress={handleShare}
                disabled={sharing}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 56,
                  borderRadius: 16,
                  backgroundColor: '#1C8376',
                  opacity: sharing ? 0.6 : pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                })}
              >
                {sharing ? (
                  <TotlText
                    style={{
                      fontFamily: 'Gramatika-Medium',
                      fontWeight: '500',
                      fontSize: 14,
                      lineHeight: 22,
                      letterSpacing: -0.04,
                      color: '#FFFFFF',
                    }}
                  >
                    Generating…
                  </TotlText>
                ) : (
                  <>
                    <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                    <View style={{ width: 10 }} />
                    <TotlText
                      style={{
                        fontFamily: 'Gramatika-Medium',
                        fontStyle: 'normal',
                        fontWeight: '500',
                        fontSize: 14,
                        lineHeight: 22,
                        letterSpacing: -0.04,
                        color: '#FFFFFF',
                      }}
                    >
                      Share
                    </TotlText>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </ScrollView>

        {/* Off-screen capture card for PNG sharing */}
        {results && typeof gw === 'number' ? (
          <ViewShot
            ref={shareShotRef}
            options={{ format: 'png', quality: 1, result: 'tmpfile' }}
            style={{ position: 'absolute', left: -9999, top: 0, backgroundColor: '#FFFFFF' }}
          >
            <ShareCaptureCard gw={gw} results={results} snapshot={effectiveShareSnapshot} userName={shareUserName} />
          </ViewShot>
        ) : null}
      </View>
    </Screen>
  );
}

