import React from 'react';
import { Pressable, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';
import type { UserStatsData } from '@totl/domain';

function topPlayersSentence(pct: number | null | undefined): string {
  if (typeof pct !== 'number' || Number.isNaN(pct)) return '—';
  const top = Math.max(1, Math.min(99, Math.round(100 - pct)));
  return `You're in the top ${top}% of players.`;
}

export default function StatsHeroVisual({
  stats,
  onPressViewRoundUp,
  onPressViewLeaderboards,
}: {
  stats: UserStatsData | null;
  /** Score sheet then Results for `lastCompletedGw` — same as streak strip. */
  onPressViewRoundUp?: () => void;
  /** Opens main tab leaderboards (2025/26 / Global) */
  onPressViewLeaderboards?: () => void;
}) {
  const t = useTokens();
  const heroGw = stats?.highlightGw ?? stats?.lastCompletedGw ?? null;
  const resultsSheetGw = stats?.lastCompletedGw ?? null;

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
            <TotlText variant="muted" style={{ fontSize: 13, fontWeight: '600' }}>
              {heroGw ? `Gameweek ${heroGw}` : 'Last gameweek'}
            </TotlText>
            <TotlText style={{ marginTop: 8, fontSize: 19, lineHeight: 24, fontWeight: '900', color: t.color.text }}>
              {topPlayersSentence(stats?.lastCompletedGwPercentile ?? null)}
            </TotlText>
            {resultsSheetGw && onPressViewRoundUp ? (
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
              Overall
            </TotlText>
            <TotlText style={{ marginTop: 8, fontSize: 19, lineHeight: 24, fontWeight: '900', color: t.color.text }}>
              {topPlayersSentence(stats?.overallPercentile ?? null)}
            </TotlText>
            {onPressViewLeaderboards ? (
              <Pressable
                onPress={onPressViewLeaderboards}
                accessibilityRole="button"
                accessibilityLabel="View leaderboards, 2025/26 season"
                style={({ pressed }) => ({ marginTop: 12, opacity: pressed ? 0.75 : 1 })}
              >
                <TotlText style={{ fontSize: 14, fontWeight: '800', color: String(t.color.brand) }}>
                  View Leaderboards
                </TotlText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
