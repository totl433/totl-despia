import React from 'react';
import { Image, Pressable, ScrollView, Share, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { GwResults } from '@totl/domain';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';

import type { RootStackParamList } from '../navigation/AppNavigator';
import { api } from '../lib/api';
import { getDefaultMlAvatarFilename, resolveLeagueAvatarUri } from '../lib/leagueAvatars';
import PageHeader from '../components/PageHeader';
import CenteredSpinner from '../components/CenteredSpinner';

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

function ShareCaptureCard({ gw, results }: { gw: number; results: GwResults }) {
  const VolleyPlaying = require('../../../../public/assets/Volley/Volley-playing.png');
  const t = useTokens();

  const topPercentLabel = (() => {
    if (!results?.gwRank || !results?.gwRankTotal) return null;
    const pct = Math.max(1, Math.min(100, Math.round((results.gwRank / results.gwRankTotal) * 100)));
    return `Top ${pct}%`;
  })();

  return (
    <View collapsable={false} style={{ width: 390, backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <View
        style={{
          height: 92,
          backgroundColor: '#1C8376',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TotlText
          style={{
            color: '#FFFFFF',
            fontFamily: 'Gramatika-Bold',
            fontWeight: '900',
            fontSize: 34,
            lineHeight: 34,
            transform: [{ rotate: '-18deg' }],
          }}
        >
          TotL
        </TotlText>
      </View>

      <View style={{ paddingHorizontal: 18, paddingVertical: 18 }}>
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

        {results.mlVictories > 0 ? (
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

        {results.gwRank && results.gwRankTotal ? (
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
      </View>
    </View>
  );
}

export default function GameweekResultsModalScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const route = useRoute<Route>();
  const gw = route.params?.gw ?? null;
  const shareShotRef = React.useRef<any>(null);
  const [sharing, setSharing] = React.useState(false);

  const { data: results, isLoading, error } = useQuery<GwResults>({
    enabled: typeof gw === 'number',
    queryKey: ['gwResults', gw],
    queryFn: () => api.getGwResults(gw as number),
  });

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

  const handleShare = React.useCallback(async () => {
    if (sharing) return;
    if (!results) return;
    if (typeof gw !== 'number') return;

    setSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        await Share.share({ message: `TOTL — Gameweek ${gw}\n${results.score}/${results.totalFixtures}` });
        return;
      }

      const uri: string | undefined = await shareShotRef.current?.capture?.();
      if (!uri) throw new Error('Could not capture results image.');

      const fileName = `gw${gw}-results.png`;
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) throw new Error('No writable directory available.');
      const dest = `${baseDir}${fileName}`;
      await FileSystem.copyAsync({ from: uri, to: dest });

      await Sharing.shareAsync(dest, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: `Share GW${gw} results`,
      });
    } finally {
      setSharing(false);
    }
  }, [gw, results, sharing]);

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
            <ShareCaptureCard gw={gw} results={results} />
          </ViewShot>
        ) : null}
      </View>
    </Screen>
  );
}

