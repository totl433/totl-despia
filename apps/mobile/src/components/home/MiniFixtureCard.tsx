import React, { useEffect } from 'react';
import { Image, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { TotlText, useTokens } from '@totl/ui';
import type { LiveStatus, Pick } from '@totl/domain';
import WinnerShimmer from '../WinnerShimmer';
import type { MiniFixtureCardProps } from './fixtureCardTypes';

const AnimatedImage = Reanimated.createAnimatedComponent(Image);

const BADGE_MINI = 37;
const BADGE_EXPANDED = 54;

function isLightSurface(color: string): boolean {
  const value = String(color ?? '').trim();
  const hex = value.startsWith('#') ? value.slice(1) : value;
  if (!(hex.length === 6 || hex.length === 3)) return false;
  const normalized = hex.length === 3 ? hex.split('').map((char) => `${char}${char}`).join('') : hex;
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) return false;
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.72;
}

export default function MiniFixtureCard({
  fixtureId,
  isExpanded: isMiniExpanded,
  onToggleExpand,
  footerInside,
  expandedFooterInside,
  footerWithExpandState,
  tightLayout = false,
  suppressExpandedDetails = false,
  homeCode,
  awayCode,
  headerHome,
  headerAway,
  homeBadge,
  awayBadge,
  primaryLabel: miniPrimaryLabel,
  primaryExpandedLabel: miniPrimaryExpandedLabel,
  secondaryLabel: miniSecondaryLabel,
  fixtureStatus = 'SCHEDULED',
  gwState,
  pick,
  derivedOutcome,
  hasScore,
  compactVisualTone = 'default',
  compactLiveMinutePill = false,
  percentBySide,
  showExpandedPercentages,
  homeFormColors,
  awayFormColors,
  homePositionLabel,
  awayPositionLabel,
  homeScorers,
  awayScorers,
  homeRedCardCount = 0,
  awayRedCardCount = 0,
  fixtureDateLabel: fixtureDateLabelStr,
}: MiniFixtureCardProps) {
  const t = useTokens();
  const layoutTransition = React.useMemo(
    () => LinearTransition.duration(200).easing(Easing.out(Easing.cubic)),
    []
  );
  const expandedSV = useSharedValue(isMiniExpanded ? 1 : 0);
  const liveDotPulse = useSharedValue(1);
  useEffect(() => {
    expandedSV.value = withTiming(isMiniExpanded ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [isMiniExpanded, expandedSV]);
  const badgeStyle = useAnimatedStyle(() => {
    const size = interpolate(expandedSV.value, [0, 1], [BADGE_MINI, BADGE_EXPANDED]);
    return { width: size, height: size };
  });

  const isLiveOrResultsMini = gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW';
  const miniLivePickCorrect = isLiveOrResultsMini && !!pick && !!derivedOutcome && pick === derivedOutcome;
  const miniLivePickIncorrect = isLiveOrResultsMini && !!pick && !!derivedOutcome && pick !== derivedOutcome;
  const miniPickIndex = pick === 'H' ? 0 : pick === 'D' ? 1 : 2;
  const st = hasScore ? (gwState === 'RESULTS_PRE_GW' ? 'FINISHED' : 'IN_PLAY') : 'SCHEDULED';
  const miniFinishedPickCorrect = miniLivePickCorrect && st === 'FINISHED';
  const miniOngoingPickCorrect = miniLivePickCorrect && st !== 'FINISHED';
  const isLightMode = React.useMemo(() => isLightSurface(t.color.background), [t.color.background]);
  const finishedGreyCompact = compactVisualTone === 'finished-grey' && !isMiniExpanded;
  const compactLiveMinutePillActive =
    compactLiveMinutePill && !isMiniExpanded && (fixtureStatus === 'IN_PLAY' || fixtureStatus === 'PAUSED');
  useEffect(() => {
    if (!compactLiveMinutePillActive) {
      cancelAnimation(liveDotPulse);
      liveDotPulse.value = 1;
      return;
    }
    liveDotPulse.value = withRepeat(withTiming(1.28, { duration: 650, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [compactLiveMinutePillActive, liveDotPulse]);
  const compactCardBorderWidth = 1;
  const compactCardBorderColor = finishedGreyCompact
    ? isLightMode
      ? 'rgba(148,163,184,0.5)'
      : 'rgba(148,163,184,0.22)'
    : t.color.border;
  const compactCardBackground = t.color.surface;
  const compactSectionBackground = finishedGreyCompact ? 'transparent' : t.color.surface;
  const finishedCardBase = isLightMode ? '#E9EEF5' : 'rgba(17,24,39,0.96)';
  const finishedCardGradient = isLightMode
    ? ['rgba(148,163,184,0.075)', 'rgba(203,213,225,0.03)', 'rgba(255,255,255,0.03)']
    : ['rgba(15,23,42,0.24)', 'rgba(30,41,59,0.26)', 'rgba(148,163,184,0.025)'];
  const incorrectIndicatorColor = isLightMode ? '#B6C2D1' : '#64748B';
  const liveStatusDotColor = isLightMode ? '#DC2626' : '#FF4D4F';
  const liveStatusTextColor = isLightMode ? t.color.muted : '#FFFFFF';
  const showExpandedScoreRedCards = isMiniExpanded && hasScore && (homeRedCardCount > 0 || awayRedCardCount > 0);
  const expandedScoreParts = React.useMemo(() => {
    const [homePart = '', awayPart = ''] = String(miniPrimaryExpandedLabel ?? '').split(' - ');
    return { homePart, awayPart };
  }, [miniPrimaryExpandedLabel]);
  const liveDotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: liveDotPulse.value }],
    opacity: interpolate(liveDotPulse.value, [1, 1.28], [0.9, 0.45]),
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Expand ${headerHome} versus ${headerAway}`}
      onPress={onToggleExpand}
      style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
    >
      <Reanimated.View
        layout={layoutTransition}
        style={{
          borderRadius: isMiniExpanded ? 18 : 16,
          borderWidth: compactCardBorderWidth,
          borderColor: compactCardBorderColor,
          overflow: 'hidden',
          backgroundColor: compactCardBackground,
          shadowColor: '#0F172A',
          shadowOpacity: 0.05,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        }}
      >
        {finishedGreyCompact ? (
          <>
            <View
              pointerEvents="none"
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: finishedCardBase }}
            />
            <LinearGradient
              colors={finishedCardGradient}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              pointerEvents="none"
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            />
          </>
        ) : null}
        <Reanimated.View
          layout={layoutTransition}
          style={{
            flexDirection: 'row',
            alignItems: 'stretch',
            ...(tightLayout ? { paddingTop: 5, paddingHorizontal: 5, paddingBottom: 0 } : { padding: 5 }),
          }}
        >
          <Reanimated.View
            layout={layoutTransition}
            style={{
              width: isMiniExpanded ? '37%' : '33.33%',
              height: isMiniExpanded ? 70 : tightLayout ? 50 : 62,
              alignItems: 'center',
              justifyContent: isMiniExpanded ? 'flex-start' : 'center',
              backgroundColor: compactSectionBackground,
              paddingTop: isMiniExpanded ? 15 : 0,
              paddingBottom: tightLayout ? 0 : isMiniExpanded ? 0 : 10,
            }}
          >
            {homeBadge ? <AnimatedImage source={homeBadge} style={[badgeStyle]} resizeMode="contain" /> : <TotlText style={{ fontFamily: t.font.medium }}>{homeCode}</TotlText>}
            {!isMiniExpanded && gwState !== 'GW_OPEN' && pick && miniPickIndex === 0 ? (
              <View
                style={{
                  position: 'absolute',
                  bottom: 4,
                  width: 45,
                  height: 6,
                  borderRadius: 3,
                  overflow: 'hidden',
                  backgroundColor: miniLivePickIncorrect ? incorrectIndicatorColor : t.color.brand,
                }}
              >
                {miniFinishedPickCorrect ? (
                  <>
                    <LinearGradient colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                    <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" />
                    <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
                  </>
                ) : miniOngoingPickCorrect ? (
                  <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.62} tint="white" />
                ) : null}
              </View>
            ) : null}
          </Reanimated.View>
          <Reanimated.View
            layout={layoutTransition}
            style={{
              width: isMiniExpanded ? '26%' : '33.34%',
              height: isMiniExpanded ? 70 : tightLayout ? 50 : 62,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: compactSectionBackground,
              paddingTop: isMiniExpanded ? 27 : 0,
              paddingBottom: tightLayout ? 0 : isMiniExpanded ? 0 : 10,
            }}
          >
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {showExpandedScoreRedCards ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  {homeRedCardCount > 0 ? (
                    <View
                      style={{
                        width: 7,
                        height: 10,
                        borderRadius: 1.5,
                        backgroundColor: '#F0626E',
                        marginRight: 5,
                      }}
                    />
                  ) : null}
                  <TotlText style={{ color: t.color.text, fontFamily: t.font.medium, fontSize: 30, lineHeight: 32, letterSpacing: 0.9, textAlign: 'center' }}>
                    {expandedScoreParts.homePart}
                  </TotlText>
                  <TotlText style={{ color: t.color.text, fontFamily: t.font.medium, fontSize: 30, lineHeight: 32, letterSpacing: 0.9, textAlign: 'center', marginHorizontal: 8 }}>
                    -
                  </TotlText>
                  <TotlText style={{ color: t.color.text, fontFamily: t.font.medium, fontSize: 30, lineHeight: 32, letterSpacing: 0.9, textAlign: 'center' }}>
                    {expandedScoreParts.awayPart}
                  </TotlText>
                  {awayRedCardCount > 0 ? (
                    <View
                      style={{
                        width: 7,
                        height: 10,
                        borderRadius: 1.5,
                        backgroundColor: '#F0626E',
                        marginLeft: 5,
                      }}
                    />
                  ) : null}
                </View>
              ) : (
                <TotlText style={{ color: t.color.text, fontFamily: t.font.medium, fontSize: isMiniExpanded ? 30 : 16, lineHeight: isMiniExpanded ? 32 : 18, letterSpacing: isMiniExpanded ? 0.9 : 0, textAlign: 'center' }}>
                  {miniPrimaryExpandedLabel}
                </TotlText>
              )}
              {miniSecondaryLabel && !isMiniExpanded ? (
                compactLiveMinutePillActive ? (
                  <View style={{ marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Reanimated.View
                      style={[
                        {
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          backgroundColor: liveStatusDotColor,
                          marginRight: 5,
                        },
                        liveDotAnimatedStyle,
                      ]}
                    />
                    <TotlText
                      style={{
                        color: liveStatusTextColor,
                        fontFamily: t.font.medium,
                        fontSize: 10,
                        lineHeight: 11,
                        textAlign: 'center',
                      }}
                    >
                      {miniSecondaryLabel}
                    </TotlText>
                  </View>
                ) : (
                  <TotlText style={{ color: t.color.muted, fontFamily: t.font.medium, fontSize: 11, lineHeight: 13, textAlign: 'center', marginTop: 2 }}>{miniSecondaryLabel}</TotlText>
                )
              ) : null}
            </View>
            {!isMiniExpanded && gwState !== 'GW_OPEN' && pick && miniPickIndex === 1 ? (
              <View
                style={{
                  position: 'absolute',
                  bottom: 4,
                  width: 45,
                  height: 6,
                  borderRadius: 3,
                  overflow: 'hidden',
                  backgroundColor: miniLivePickIncorrect ? incorrectIndicatorColor : t.color.brand,
                }}
              >
                {miniFinishedPickCorrect ? (
                  <>
                    <LinearGradient colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                    <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" />
                    <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
                  </>
                ) : miniOngoingPickCorrect ? (
                  <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.62} tint="white" />
                ) : null}
              </View>
            ) : null}
          </Reanimated.View>
          <Reanimated.View
            layout={layoutTransition}
            style={{
              width: isMiniExpanded ? '37%' : '33.33%',
              height: isMiniExpanded ? 70 : tightLayout ? 50 : 62,
              alignItems: 'center',
              justifyContent: isMiniExpanded ? 'flex-start' : 'center',
              backgroundColor: compactSectionBackground,
              paddingTop: isMiniExpanded ? 15 : 0,
              paddingBottom: tightLayout ? 0 : isMiniExpanded ? 0 : 10,
            }}
          >
            {awayBadge ? <AnimatedImage source={awayBadge} style={[badgeStyle]} resizeMode="contain" /> : <TotlText style={{ fontFamily: t.font.medium }}>{awayCode}</TotlText>}
            {!isMiniExpanded && gwState !== 'GW_OPEN' && pick && miniPickIndex === 2 ? (
              <View
                style={{
                  position: 'absolute',
                  bottom: 4,
                  width: 45,
                  height: 6,
                  borderRadius: 3,
                  overflow: 'hidden',
                  backgroundColor: miniLivePickIncorrect ? incorrectIndicatorColor : t.color.brand,
                }}
              >
                {miniFinishedPickCorrect ? (
                  <>
                    <LinearGradient colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                    <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" />
                    <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
                  </>
                ) : miniOngoingPickCorrect ? (
                  <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.62} tint="white" />
                ) : null}
              </View>
            ) : null}
          </Reanimated.View>
        </Reanimated.View>

        {isMiniExpanded ? (
          <Reanimated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            style={{ paddingTop: 2, paddingBottom: 15, paddingHorizontal: 0 }}
          >
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

            {!suppressExpandedDetails && isLiveOrResultsMini ? (
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

            {!suppressExpandedDetails && gwState !== 'GW_OPEN' ? (
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
            ) : !suppressExpandedDetails ? (
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
            ) : null}
            {suppressExpandedDetails && !footerWithExpandState && (expandedFooterInside ?? footerInside) ? (
              <View style={{ paddingHorizontal: 8, paddingTop: 4, paddingBottom: 2 }}>{expandedFooterInside ?? footerInside}</View>
            ) : null}
          </Reanimated.View>
        ) : null}
        {footerWithExpandState ? (
          <View style={{ paddingHorizontal: isMiniExpanded ? 8 : 6, paddingTop: isMiniExpanded ? 4 : 2, paddingBottom: isMiniExpanded ? 2 : 4 }}>
            {footerWithExpandState({ isExpanded: isMiniExpanded })}
          </View>
        ) : !isMiniExpanded && footerInside ? (
          <View style={{ paddingHorizontal: 6, paddingTop: 2, paddingBottom: 4 }}>{footerInside}</View>
        ) : null}
      </Reanimated.View>
    </Pressable>
  );
}
