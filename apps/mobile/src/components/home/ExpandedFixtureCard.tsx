import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated from 'react-native-reanimated';
import { TotlText, useTokens } from '@totl/ui';
import type { Pick } from '@totl/domain';
import WinnerShimmer from '../WinnerShimmer';
import type { ExpandedFixtureCardProps } from './fixtureCardTypes';

function FixtureHeaderMorph({
  expanded,
  headerPrimary,
  headerHome,
  headerAway,
  homeBadge,
  awayBadge,
  homeTeamFontWeight,
  awayTeamFontWeight,
}: {
  expanded: boolean;
  headerPrimary: string;
  headerHome: string;
  headerAway: string;
  homeBadge: any | null;
  awayBadge: any | null;
  homeTeamFontWeight: '600' | '800';
  awayTeamFontWeight: '600' | '800';
}) {
  const t = useTokens();
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: expanded ? 'space-between' : 'center',
          paddingVertical: 2,
        }}
      >
        <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end', paddingRight: 6 }}>
          <TotlText
            numberOfLines={1}
            style={{
              fontWeight: homeTeamFontWeight,
              color: t.color.text,
              fontSize: 14,
              lineHeight: 20,
              flexShrink: 1,
              textAlign: 'right',
            }}
          >
            {headerHome}
          </TotlText>
        </View>
        <View style={{ minWidth: 118, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            {homeBadge ? <Image source={homeBadge} style={{ width: 24, height: 24, marginRight: 6 }} /> : null}
            <TotlText style={{ fontWeight: '800', color: t.color.text, fontSize: 14, lineHeight: 20 }}>{headerPrimary}</TotlText>
            {awayBadge ? <Image source={awayBadge} style={{ width: 24, height: 24, marginLeft: 6 }} /> : null}
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start', paddingLeft: 6 }}>
          <TotlText
            numberOfLines={1}
            style={{
              fontWeight: awayTeamFontWeight,
              color: t.color.text,
              fontSize: 14,
              lineHeight: 20,
              flexShrink: 1,
              textAlign: 'left',
            }}
          >
            {headerAway}
          </TotlText>
        </View>
      </View>
    </>
  );
}

export default function ExpandedFixtureCard({
  fixtureId,
  isExpandedVisual,
  isDetailsViewActive,
  isCompactStack,
  isCompactCard,
  fixtureMarginTop,
  stackZIndex,
  stackElevation,
  onPress,
  homeCode,
  awayCode,
  headerPrimary,
  headerSecondary,
  headerHome,
  headerAway,
  homeBadge,
  awayBadge,
  homeTeamFontWeight,
  awayTeamFontWeight,
  gwState,
  pick,
  derivedOutcome,
  hasScore,
  isFinished,
  isLiveOrResultsCard,
  percentBySide,
  showTabsRow,
  showTabPercentages,
  showPercentagesOnTabs,
  tabsAboveScorers,
  homeScorers,
  awayScorers,
  kickoffDetail,
  hideStatusRowCompletely,
  hideRepeatedKickoffInDetails,
  hideRepeatedKickoffInCompact,
  hideRepeatedKickoffInLiveScheduled,
  onLayout,
}: ExpandedFixtureCardProps) {
  const t = useTokens();

  return (
    <Reanimated.View
      onLayout={onLayout ? (event) => {
        const measured = event.nativeEvent.layout.height;
        if (!Number.isFinite(measured) || measured <= 0) return;
        onLayout(measured);
      } : undefined}
      style={{
        marginTop: fixtureMarginTop,
        elevation: stackElevation,
        zIndex: stackZIndex,
        shadowColor: '#0F172A',
        shadowOpacity: 0.06,
        shadowRadius: 1.8,
        shadowOffset: { width: 0, height: -0.8 },
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${headerHome} versus ${headerAway}`}
        onPress={onPress}
        style={({ pressed }) => ({
          borderWidth: 1,
          borderColor: t.color.border,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
          paddingHorizontal: gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW' ? 16 : 12,
          paddingTop: gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW' ? 14 : 12,
          paddingBottom: gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW' ? 14 : 12,
          backgroundColor: t.color.surface,
          opacity: pressed ? 0.96 : 1,
          transform: [{ scale: pressed ? 0.995 : 1 }],
        })}
      >
        <View style={{ paddingLeft: 0 }}>
          <FixtureHeaderMorph
            expanded={isExpandedVisual}
            headerPrimary={headerPrimary}
            headerHome={headerHome}
            headerAway={headerAway}
            homeBadge={homeBadge}
            awayBadge={awayBadge}
            homeTeamFontWeight={homeTeamFontWeight}
            awayTeamFontWeight={awayTeamFontWeight}
          />
        </View>

        {isExpandedVisual || !isDetailsViewActive ? (
          <Reanimated.View>
            <View style={{ position: 'relative', overflow: 'hidden', backgroundColor: t.color.surface }}>
              <View style={{ position: 'relative', zIndex: 1, paddingHorizontal: 0, paddingBottom: 2 }}>
                {!hideStatusRowCompletely ? (
                  <View style={{ marginTop: 2, alignItems: 'center' }}>
                    <TotlText
                      style={{
                        color: t.color.muted,
                        fontSize: 12,
                        opacity:
                          hideRepeatedKickoffInDetails || hideRepeatedKickoffInCompact || hideRepeatedKickoffInLiveScheduled ? 0 : 1,
                      }}
                    >
                      {headerSecondary}
                    </TotlText>
                  </View>
                ) : null}
                {isLiveOrResultsCard && !tabsAboveScorers && homeScorers.length + awayScorers.length > 0 ? (
                  <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12 }}>
                    <View style={{ width: '40%', alignItems: 'flex-end', paddingRight: 6 }}>
                      {homeScorers.map((line) => (
                        <TotlText key={`${fixtureId}-h-${line}`} numberOfLines={1} style={{ fontSize: 11, lineHeight: 17, color: t.color.text, textAlign: 'right' }}>
                          {line}
                        </TotlText>
                      ))}
                    </View>
                    <View style={{ width: '20%' }} />
                    <View style={{ width: '40%', alignItems: 'flex-start', paddingLeft: 6 }}>
                      {awayScorers.map((line) => (
                        <TotlText key={`${fixtureId}-a-${line}`} numberOfLines={1} style={{ fontSize: 11, lineHeight: 17, color: t.color.text, textAlign: 'left' }}>
                          {line}
                        </TotlText>
                      ))}
                    </View>
                  </View>
                ) : null}
                {showTabsRow ? (
                  <View style={{ marginTop: isLiveOrResultsCard ? 12 : 4, flexDirection: 'row', gap: isLiveOrResultsCard ? 6 : 8, paddingHorizontal: 12 }}>
                    {(['H', 'D', 'A'] as const).map((side) => {
                      const active = pick === side;
                      const sideBadge = side === 'H' ? homeBadge : side === 'A' ? awayBadge : null;
                      const showPercentagesForCard = showPercentagesOnTabs && !isCompactCard;
                      const label = showPercentagesForCard && side === 'D' ? 'Draw' : '';
                      const showWinnerTabShiny = isLiveOrResultsCard && isFinished && !!pick && !!derivedOutcome && pick === derivedOutcome && derivedOutcome === side;
                      const showOngoingCorrectShimmer =
                        isLiveOrResultsCard && !isFinished && active && !!pick && !!derivedOutcome && pick === derivedOutcome && derivedOutcome === side;
                      const showLiveWrongPicked = (gwState === 'LIVE' || gwState === 'RESULTS_PRE_GW') && active && isFinished && !!pick && !!derivedOutcome && pick !== derivedOutcome;
                      const showWrongFinishedPickedTab =
                        isFinished && active && !!pick && !!derivedOutcome && pick !== derivedOutcome && !showLiveWrongPicked;
                      const showSolidPickedTab =
                        (active && !isFinished && !showWinnerTabShiny && !showWrongFinishedPickedTab) || showLiveWrongPicked;
                      return (
                        <View
                          key={`${fixtureId}-${side}`}
                          style={{
                            flex: 1,
                            borderRadius: 9,
                            borderWidth: showWinnerTabShiny ? 0 : 1,
                            borderColor: showWrongFinishedPickedTab
                              ? t.color.border
                              : showLiveWrongPicked
                                ? t.color.border
                                : showSolidPickedTab
                                  ? t.color.brand
                                  : active
                                    ? 'rgba(28,131,118,0.45)'
                                    : t.color.border,
                            backgroundColor: showWinnerTabShiny
                              ? 'transparent'
                              : showWrongFinishedPickedTab
                                ? t.color.surface2
                                : showLiveWrongPicked
                                  ? t.color.surface2
                                  : showSolidPickedTab
                                    ? t.color.brand
                                    : isLiveOrResultsCard
                                      ? active
                                        ? 'rgba(28,131,118,0.12)'
                                        : t.color.surface2
                                      : active
                                        ? 'rgba(28,131,118,0.12)'
                                        : t.color.background,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: isLiveOrResultsCard ? 10 : 5,
                            overflow: 'hidden',
                          }}
                        >
                          {showWinnerTabShiny ? (
                            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 9, overflow: 'hidden' }}>
                              <LinearGradient
                                colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                              />
                              <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" />
                              <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
                            </View>
                          ) : showOngoingCorrectShimmer ? (
                            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
                              <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.62} tint="white" />
                            </View>
                          ) : null}
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {sideBadge ? <Image source={sideBadge} style={{ width: 16, height: 16, marginRight: 4 }} /> : null}
                            {label ? (
                              <TotlText style={{ fontSize: 13, fontWeight: '500', color: showWinnerTabShiny || showSolidPickedTab ? '#FFFFFF' : t.color.text }}>
                                {label}{' '}
                              </TotlText>
                            ) : null}
                            {showPercentagesForCard ? (
                              <TotlText
                                style={{
                                  fontSize: 15,
                                  fontWeight: active ? '700' : '500',
                                  color: showWinnerTabShiny
                                    ? '#FFFFFF'
                                    : showSolidPickedTab
                                      ? '#FFFFFF'
                                      : showWrongFinishedPickedTab
                                        ? t.color.muted
                                        : active
                                          ? t.color.brand
                                          : t.color.text,
                                }}
                              >
                                {`${percentBySide[side]}%`}
                              </TotlText>
                            ) : (
                              <TotlText
                                style={{
                                  fontSize: 14,
                                  fontWeight: active ? '800' : '600',
                                  color: showWinnerTabShiny ? '#FFFFFF' : showSolidPickedTab ? '#FFFFFF' : active ? '#047857' : t.color.muted,
                                }}
                              >
                                {side === 'D' ? 'Draw' : 'Win'}
                              </TotlText>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
                {isLiveOrResultsCard && tabsAboveScorers && homeScorers.length + awayScorers.length > 0 ? (
                  <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12 }}>
                    <View style={{ width: '40%', alignItems: 'flex-end', paddingRight: 6 }}>
                      {homeScorers.map((line) => (
                        <TotlText key={`${fixtureId}-h2-${line}`} numberOfLines={1} style={{ fontSize: 11, lineHeight: 17, color: t.color.text, textAlign: 'right' }}>
                          {line}
                        </TotlText>
                      ))}
                    </View>
                    <View style={{ width: '20%' }} />
                    <View style={{ width: '40%', alignItems: 'flex-start', paddingLeft: 6 }}>
                      {awayScorers.map((line) => (
                        <TotlText key={`${fixtureId}-a2-${line}`} numberOfLines={1} style={{ fontSize: 11, lineHeight: 17, color: t.color.text, textAlign: 'left' }}>
                          {line}
                        </TotlText>
                      ))}
                    </View>
                  </View>
                ) : null}
                {isLiveOrResultsCard && kickoffDetail ? (
                  <View style={{ marginTop: 14, alignItems: 'center' }}>
                    <TotlText style={{ fontSize: 14, color: t.color.muted }}>{kickoffDetail}</TotlText>
                  </View>
                ) : null}
              </View>
            </View>
          </Reanimated.View>
        ) : null}
      </Pressable>
    </Reanimated.View>
  );
}
