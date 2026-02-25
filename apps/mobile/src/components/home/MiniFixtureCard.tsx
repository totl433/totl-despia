import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { TotlText, useTokens } from '@totl/ui';
import type { Pick } from '@totl/domain';
import WinnerShimmer from '../WinnerShimmer';
import type { MiniFixtureCardProps } from './fixtureCardTypes';

export default function MiniFixtureCard({
  fixtureId,
  isExpanded: isMiniExpanded,
  onToggleExpand,
  homeCode,
  awayCode,
  headerHome,
  headerAway,
  homeBadge,
  awayBadge,
  primaryLabel: miniPrimaryLabel,
  primaryExpandedLabel: miniPrimaryExpandedLabel,
  secondaryLabel: miniSecondaryLabel,
  gwState,
  pick,
  derivedOutcome,
  hasScore,
  percentBySide,
  showExpandedPercentages,
  homeFormColors,
  awayFormColors,
  homePositionLabel,
  awayPositionLabel,
  homeScorers,
  awayScorers,
  fixtureDateLabel: fixtureDateLabelStr,
}: MiniFixtureCardProps) {
  const t = useTokens();

  const isLiveOrResultsMini = gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW';
  const miniLivePickCorrect = isLiveOrResultsMini && !!pick && !!derivedOutcome && pick === derivedOutcome;
  const miniLivePickIncorrect = isLiveOrResultsMini && !!pick && !!derivedOutcome && pick !== derivedOutcome;
  const miniPickIndex = pick === 'H' ? 0 : pick === 'D' ? 1 : 2;
  const st = hasScore ? (gwState === 'RESULTS_PRE_GW' ? 'FINISHED' : 'IN_PLAY') : 'SCHEDULED';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Expand ${headerHome} versus ${headerAway}`}
      onPress={onToggleExpand}
      style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
    >
      <View
        style={{
          borderRadius: isMiniExpanded ? 18 : 16,
          borderWidth: 1,
          borderColor: t.color.border,
          overflow: 'hidden',
          backgroundColor: t.color.surface,
          shadowColor: '#0F172A',
          shadowOpacity: 0.05,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <View style={{ width: isMiniExpanded ? '37%' : '33.3333%', aspectRatio: isMiniExpanded ? undefined : 1, height: isMiniExpanded ? 70 : undefined, alignItems: 'center', justifyContent: isMiniExpanded ? 'flex-start' : 'center', backgroundColor: t.color.surface, paddingTop: isMiniExpanded ? 15 : 0 }}>
            {homeBadge ? <Image source={homeBadge} style={{ width: isMiniExpanded ? 54 : 37, height: isMiniExpanded ? 54 : 37 }} /> : <TotlText style={{ fontFamily: t.font.medium }}>{homeCode}</TotlText>}
          </View>
          <View style={{ width: isMiniExpanded ? '26%' : '33.3333%', aspectRatio: isMiniExpanded ? undefined : 1, height: isMiniExpanded ? 70 : undefined, alignItems: 'center', justifyContent: isMiniExpanded ? 'flex-start' : 'center', backgroundColor: t.color.surface, paddingTop: isMiniExpanded ? 27 : 0 }}>
            <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <TotlText style={{ color: t.color.text, fontFamily: t.font.medium, fontSize: isMiniExpanded ? 30 : 16, lineHeight: isMiniExpanded ? 32 : 18, letterSpacing: isMiniExpanded ? 0.9 : 0, textAlign: 'center' }}>
                {miniPrimaryExpandedLabel}
              </TotlText>
              {miniSecondaryLabel && !isMiniExpanded ? (
                <TotlText style={{ color: t.color.muted, fontFamily: t.font.medium, fontSize: 11, lineHeight: 13, textAlign: 'center', marginTop: 2 }}>{miniSecondaryLabel}</TotlText>
              ) : null}
            </View>
          </View>
          <View style={{ width: isMiniExpanded ? '37%' : '33.3333%', aspectRatio: isMiniExpanded ? undefined : 1, height: isMiniExpanded ? 70 : undefined, alignItems: 'center', justifyContent: isMiniExpanded ? 'flex-start' : 'center', backgroundColor: t.color.surface, paddingTop: isMiniExpanded ? 15 : 0 }}>
            {awayBadge ? <Image source={awayBadge} style={{ width: isMiniExpanded ? 54 : 37, height: isMiniExpanded ? 54 : 37 }} /> : <TotlText style={{ fontFamily: t.font.medium }}>{awayCode}</TotlText>}
          </View>
        </View>
        {gwState !== 'GW_OPEN' &&
        pick &&
        !(isMiniExpanded && (gwState === 'GW_PREDICTED' || gwState === 'DEADLINE_PASSED' || gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW')) ? (
          <View
            style={{
              position: 'absolute',
              left: `${miniPickIndex * 33.3333}%`,
              bottom: 0,
              width: '33.3333%',
              height: 6,
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
              overflow: 'hidden',
              backgroundColor: miniLivePickIncorrect ? t.color.surface2 : t.color.brand,
            }}
          >
            {miniLivePickCorrect ? (
              <>
                <LinearGradient colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" />
                <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
              </>
            ) : null}
          </View>
        ) : null}

        {isMiniExpanded ? (
          <Reanimated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ paddingTop: 2, paddingBottom: 15, paddingHorizontal: 0 }}>
            {(gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW') ? (
              <View style={{ marginTop: 7, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ width: '37%', alignItems: 'center' }}><TotlText numberOfLines={1} style={{ width: '100%', fontSize: 15, fontFamily: t.font.medium, color: t.color.text, textAlign: 'center' }}>{headerHome}</TotlText></View>
                <View style={{ width: '26%', alignItems: 'center' }}><TotlText style={{ fontSize: 12, fontFamily: t.font.medium, color: t.color.muted, textAlign: 'center' }}>{miniSecondaryLabel}</TotlText></View>
                <View style={{ width: '37%', alignItems: 'center' }}><TotlText numberOfLines={1} style={{ width: '100%', fontSize: 15, fontFamily: t.font.medium, color: t.color.text, textAlign: 'center' }}>{headerAway}</TotlText></View>
              </View>
            ) : (
              <View style={{ marginTop: 0, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ width: '37%', alignItems: 'center' }}><TotlText numberOfLines={1} style={{ width: '100%', fontSize: 15, fontFamily: t.font.medium, color: t.color.text, textAlign: 'center' }}>{headerHome}</TotlText></View>
                <View style={{ width: '26%' }} />
                <View style={{ width: '37%', alignItems: 'center' }}><TotlText numberOfLines={1} style={{ width: '100%', fontSize: 15, fontFamily: t.font.medium, color: t.color.text, textAlign: 'center' }}>{headerAway}</TotlText></View>
              </View>
            )}

            {isLiveOrResultsMini ? (
              <View style={{ marginTop: 8, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ width: '42%', alignItems: 'flex-end', paddingRight: 6 }}>
                  {homeScorers.map((line) => (
                    <TotlText key={`${fixtureId}-eh-${line}`} numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, fontFamily: t.font.medium, color: t.color.text, textAlign: 'right' }}>{line}</TotlText>
                  ))}
                </View>
                <View style={{ width: '16%' }} />
                <View style={{ width: '42%', alignItems: 'flex-start', paddingLeft: 6 }}>
                  {awayScorers.map((line) => (
                    <TotlText key={`${fixtureId}-ea-${line}`} numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, fontFamily: t.font.medium, color: t.color.text, textAlign: 'left' }}>{line}</TotlText>
                  ))}
                </View>
              </View>
            ) : null}

            {gwState !== 'GW_OPEN' ? (
              <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 12 }}>
                {(['H', 'D', 'A'] as const).map((side) => {
                  const active = pick === side;
                  const sideBadge = side === 'H' ? homeBadge : side === 'A' ? awayBadge : null;
                  const pct = percentBySide[side];
                  const showExpandedWinnerShiny =
                    (gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW') &&
                    st === 'FINISHED' &&
                    Boolean(pick) &&
                    Boolean(derivedOutcome) &&
                    pick === derivedOutcome &&
                    side === derivedOutcome;
                  return (
                    <View
                      key={`inplace-mini-tab-${fixtureId}-${side}`}
                      style={{
                        flex: 1,
                        height: 46,
                        borderRadius: 11,
                        borderWidth: showExpandedWinnerShiny ? 0 : 1,
                        borderColor: showExpandedWinnerShiny ? 'transparent' : active ? 'rgba(28,131,118,0.4)' : t.color.border,
                        backgroundColor: showExpandedWinnerShiny ? 'transparent' : active ? t.color.brand : t.color.surface2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        overflow: 'hidden',
                      }}
                    >
                      {showExpandedWinnerShiny ? (
                        <>
                          <LinearGradient colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                          <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" />
                          <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
                        </>
                      ) : null}
                      {sideBadge ? <Image source={sideBadge} style={{ width: 18, height: 18, marginRight: 5 }} /> : null}
                      <TotlText style={{ fontSize: 13, fontFamily: t.font.medium, color: showExpandedWinnerShiny || active ? '#FFFFFF' : t.color.text }}>
                        {showExpandedPercentages ? (side === 'D' ? `Draw ${pct}%` : `${pct}%`) : side === 'D' ? 'Draw' : 'Win'}
                      </TotlText>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ width: '37%', alignItems: 'center' }}>
                  <View style={{ width: 56, height: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    {homeFormColors.map((color, i) => (
                      <View key={`home-form-${fixtureId}-${i}`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                    ))}
                  </View>
                  <TotlText style={{ marginTop: 8, fontSize: 13, fontFamily: t.font.medium, color: t.color.text }}>{homePositionLabel}</TotlText>
                </View>
                <View style={{ width: '26%', alignItems: 'center' }}>
                  <View style={{ height: 8 }} />
                  <TotlText style={{ marginTop: 8, fontSize: 13, color: t.color.muted, textAlign: 'center' }}>{fixtureDateLabelStr}</TotlText>
                </View>
                <View style={{ width: '37%', alignItems: 'center' }}>
                  <View style={{ width: 56, height: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    {awayFormColors.map((color, i) => (
                      <View key={`away-form-${fixtureId}-${i}`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                    ))}
                  </View>
                  <TotlText style={{ marginTop: 8, fontSize: 13, fontFamily: t.font.medium, color: t.color.text }}>{awayPositionLabel}</TotlText>
                </View>
              </View>
            )}
          </Reanimated.View>
        ) : null}
      </View>
    </Pressable>
  );
}
