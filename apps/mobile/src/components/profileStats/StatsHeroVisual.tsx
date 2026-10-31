import React from 'react';
import { Pressable, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';
import type { UserStatsData } from '@totl/domain';

import { isGwFullyCompleteForStatsRoundUp, type StatsGwCompletionContext } from '../../lib/gameweekState';

function topPlayersSentence(pct: number | null | undefined): string {
  if (typeof pct !== 'number' || Number.isNaN(pct)) return '—';
  const top = Math.max(1, Math.min(99, Math.round(100 - pct)));
  return `You're in the top ${top}% of players.`;
}

export default function StatsHeroVisual({
  stats,
  statsGwCompletion,
  liveScore,
  onPressViewRoundUp,
  onPressViewLeaderboards,
  overallLabel = 'Overall',
  leaderboardsLinkLabel = 'View Leaderboards',
  leaderboardsA11yLabel = 'View leaderboards',
}: {
  stats: UserStatsData | null;
  statsGwCompletion?: StatsGwCompletionContext | null;
  /** Live GW points while the headline week is still in play. */
  liveScore?: number | null;
  /** Score sheet then Results for the latest completed week only. */
  onPressViewRoundUp?: () => void;
  /** Opens main tab leaderboards (2025/26 / Global) */
  onPressViewLeaderboards?: () => void;
  /** e.g. “Career overall” for pile-B users spanning seasons */
  overallLabel?: string;
  leaderboardsLinkLabel?: string;
  leaderboardsA11yLabel?: string;
}) {
  const t = useTokens();
  const heroGw = stats?.highlightGw ?? stats?.lastCompletedGw ?? null;
  const resultsSheetGw = stats?.lastCompletedGw ?? null;
  const showHeroRoundUp =
    !!resultsSheetGw &&
    !!onPressViewRoundUp &&
    (statsGwCompletion
      ? isGwFullyCompleteForStatsRoundUp({
          gw: resultsSheetGw,
          currentGw: statsGwCompletion.currentGw,
          probeHome: statsGwCompletion.probeHome,
          probeGw: statsGwCompletion.probeGw,
          lastCompletedGw: statsGwCompletion.lastCompletedGw,
          probeLoading: statsGwCompletion.probeLoading,
        })
      : true);
  const heroGwLive =
    typeof heroGw === 'number' &&
    !!statsGwCompletion &&
    !isGwFullyCompleteForStatsRoundUp({
      gw: heroGw,
      currentGw: statsGwCompletion.currentGw,
      probeHome: statsGwCompletion.probeHome,
      probeGw: statsGwCompletion.probeGw,
      lastCompletedGw: statsGwCompletion.lastCompletedGw,
      probeLoading: statsGwCompletion.probeLoading,
    });
  const livePts = heroGwLive && typeof liveScore === 'number' && Number.isFinite(liveScore) ? liveScore : null;

  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: t.color.surface,
        overflow: 'hidden',
        shadowColor: '#0F172A',
        shadowOpacity: 0.07,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
      }}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, paddingRight: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              {heroGwLive ? (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }}
                />
              ) : null}
              <TotlText variant="muted" style={{ fontSize: 13, fontWeight: '600' }}>
                {heroGw ? `Gameweek ${heroGw}` : 'Last gameweek'}
              </TotlText>
            </View>
            {livePts != null ? (
              <View
                style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}
                accessibilityLabel={`Gameweek ${heroGw}, ${livePts} points, live`}
              >
                <TotlText style={{ fontSize: 40, lineHeight: 46, fontWeight: '900', color: t.color.text }}>
                  {String(livePts)}
                </TotlText>
                <TotlText style={{ fontSize: 16, lineHeight: 22, fontWeight: '800', color: t.color.text, marginLeft: 6 }}>
                  pts
                </TotlText>
              </View>
            ) : (
              <TotlText style={{ marginTop: 8, fontSize: 19, lineHeight: 24, fontWeight: '900', color: t.color.text }}>
                {topPlayersSentence(stats?.lastCompletedGwPercentile ?? null)}
              </TotlText>
            )}
            {showHeroRoundUp ? (
              <Pressable
                onPress={onPressViewRoundUp}
                accessibilityRole="button"
                accessibilityLabel={`View Round Up for gameweek ${resultsSheetGw}`}
                style={({ pressed }) => ({ marginTop: 12, opacity: pressed ? 0.75 : 1 })}
              >
                <TotlText style={{ fontSize: 14, fontWeight: '800', color: String(t.color.brand) }}>
                  View Round Up
                </TotlText>
              </Pressable>
            ) : null}
          </View>

          <View style={{ width: 1, backgroundColor: t.color.border, alignSelf: 'stretch', marginVertical: 4 }} />

          <View style={{ flex: 1, paddingLeft: 14 }}>
            <TotlText variant="muted" style={{ fontSize: 13, fontWeight: '600' }}>
              {overallLabel}
            </TotlText>
            <TotlText style={{ marginTop: 8, fontSize: 19, lineHeight: 24, fontWeight: '900', color: t.color.text }}>
              {topPlayersSentence(stats?.overallPercentile ?? null)}
            </TotlText>
            {onPressViewLeaderboards ? (
              <Pressable
                onPress={onPressViewLeaderboards}
                accessibilityRole="button"
                accessibilityLabel={leaderboardsA11yLabel}
                style={({ pressed }) => ({ marginTop: 12, opacity: pressed ? 0.75 : 1 })}
              >
                <TotlText style={{ fontSize: 14, fontWeight: '800', color: String(t.color.brand) }}>
                  {leaderboardsLinkLabel}
                </TotlText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
