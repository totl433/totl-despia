import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TotlText, useTokens } from '@totl/ui';

import {
  countTrailingGameweekParticipationStreak,
  type GameweekStreakRow,
} from '../../lib/gameweekStreakCount';
import {
  isGwFullyCompleteForStatsRoundUp,
  isGwStatsLiveDot,
  type StatsGwCompletionContext,
} from '../../lib/gameweekState';

export type { GameweekStreakRow };

const STREAK_SCORE_SIZE = 54;
/** Ionicons measure taller than type at equal pt — keep flame visually shorter than the digits */
const STREAK_FLAME_SIZE = Math.round(STREAK_SCORE_SIZE * 0.78);

/** When `lastCompletedGw` is unknown, allow Round Up for any scored chip (previous behaviour). */
function gwHasFinalResultsLegacy(gw: number, lastCompletedGw: number | null | undefined): boolean {
  if (lastCompletedGw == null || typeof lastCompletedGw !== 'number' || lastCompletedGw <= 0) return true;
  return gw <= lastCompletedGw;
}

function gwIsLiveIncompleteLegacy(gw: number, lastCompletedGw: number | null | undefined): boolean {
  return typeof lastCompletedGw === 'number' && lastCompletedGw > 0 && gw > lastCompletedGw;
}

/** Horizontal chips: ladder of GWs (played → pts, skipped → —). Big number = trailing consecutive played weeks. */
export default function StatsGameweekStreakStrip({
  rows,
  lastCompletedGw,
  statsGwCompletion,
  nestInsideStatCard,
  onViewScoresheet,
}: {
  rows: GameweekStreakRow[];
  /** Fallback when `statsGwCompletion` is missing (older callers). */
  lastCompletedGw?: number | null;
  /** Home snapshot probe — aligns Round Up / live dot with last-fixture-finished (not `app_gw_results` max gw). */
  statsGwCompletion?: StatsGwCompletionContext | null;
  /** Flat layout on `StatCard` surface (no inner gradient frame). */
  nestInsideStatCard?: boolean;
  /** Opens score sheet then Results card for that GW (`openManualResultsScoreSheetThenResults`). Labelled “Round Up” in UI. */
  onViewScoresheet?: (gw: number) => void;
}) {
  const t = useTokens();
  const scrollRef = React.useRef<ScrollView>(null);
  const n = rows.length;
  const streakCount = countTrailingGameweekParticipationStreak(rows);
  if (!n) return null;

  const scrollSig = rows.map((r) => r.gw).join(',');

  React.useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      scrollRef.current?.scrollToEnd({ animated: false });
      timeoutId = setTimeout(() => {
        if (!cancelled) scrollRef.current?.scrollToEnd({ animated: false });
      }, 72);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [scrollSig]);

  const inset = nestInsideStatCard ? 0 : 14;
  /** Matches `StatCard` horizontal padding on Profile Stats — bleed chips edge-to-edge. */
  const statCardPad = t.space[5];
  const chipBg = nestInsideStatCard ? t.color.surface2 : t.color.surface;
  const chipBorder = nestInsideStatCard ? 0 : 1;

  const scrollRow = (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginTop: 14 }}
      contentContainerStyle={{
        gap: 10,
        paddingLeft: nestInsideStatCard ? 0 : inset,
        /** Leading edge flush; extra trailing pad so last chip clears rounded corner comfortably. */
        paddingRight: nestInsideStatCard ? statCardPad + t.space[4] : 14,
        paddingBottom: 10,
      }}
    >
      {rows.map((row) => {
        const scored = typeof row.points === 'number';
        const c = statsGwCompletion;
        const showLiveDot = c
          ? isGwStatsLiveDot({
              gw: row.gw,
              scored,
              currentGw: c.currentGw,
              probeHome: c.probeHome,
              probeGw: c.probeGw,
              lastCompletedGw: c.lastCompletedGw,
              probeLoading: c.probeLoading,
            })
          : scored && gwIsLiveIncompleteLegacy(row.gw, lastCompletedGw);
        const showRoundUp = Boolean(
          onViewScoresheet &&
            scored &&
            (c
              ? isGwFullyCompleteForStatsRoundUp({
                  gw: row.gw,
                  currentGw: c.currentGw,
                  probeHome: c.probeHome,
                  probeGw: c.probeGw,
                  lastCompletedGw: c.lastCompletedGw,
                  probeLoading: c.probeLoading,
                })
              : gwHasFinalResultsLegacy(row.gw, lastCompletedGw))
        );
        return (
          <View
            key={row.gw}
            style={{
              minWidth: scored ? 96 : 78,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: chipBg,
              borderWidth: chipBorder,
              borderColor: t.color.border,
            }}
          >
            <TotlText variant="muted" style={{ fontSize: 11, fontWeight: '800' }}>
              {`GW${row.gw}`}
            </TotlText>
            {scored ? (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 }}
                accessibilityLabel={showLiveDot ? `Gameweek ${row.gw}, ${row.points} points, live` : undefined}
              >
                {showLiveDot ? (
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }}
                  />
                ) : null}
                <TotlText style={{ fontSize: 22, fontWeight: '900', color: t.color.text }}>
                  {`${row.points} pts`}
                </TotlText>
              </View>
            ) : (
              <TotlText variant="muted" style={{ marginTop: 6, fontSize: 18, fontWeight: '800' }}>
                —
              </TotlText>
            )}
            {showRoundUp ? (
              <Pressable
                onPress={() => onViewScoresheet?.(row.gw)}
                accessibilityRole="button"
                accessibilityLabel={`View Round Up for gameweek ${row.gw}`}
                hitSlop={{ top: 6, bottom: 4, left: 4, right: 4 }}
                style={({ pressed }) => ({ marginTop: 10, opacity: pressed ? 0.72 : 1 })}
              >
                <TotlText style={{ fontSize: 11, fontWeight: '800', color: String(t.color.brand), lineHeight: 14 }}>
                  View Round Up
                </TotlText>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );

  const content = (
    <>
      <View style={{ gap: 10, paddingHorizontal: inset }}>
        <TotlText variant="muted" style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
          Your Streak
        </TotlText>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <View accessible={false}>
            <Ionicons name="flame" size={STREAK_FLAME_SIZE} color={String(t.color.warning)} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <TotlText
              style={{
                fontSize: STREAK_SCORE_SIZE,
                lineHeight: STREAK_SCORE_SIZE + 2,
                fontWeight: '900',
                letterSpacing: -2,
                fontFamily: t.font.heading,
                color: String(t.color.brand),
              }}
            >
              {String(streakCount)}
            </TotlText>
            <TotlText variant="muted" style={{ fontSize: 17, fontWeight: '800' }}>
              {streakCount === 1 ? 'gameweek in a row' : 'gameweeks in a row'}
            </TotlText>
          </View>
        </View>
      </View>

      {nestInsideStatCard ? (
        <View style={{ marginHorizontal: -statCardPad }}>{scrollRow}</View>
      ) : (
        scrollRow
      )}

      <View style={{ paddingHorizontal: inset, paddingTop: 4, paddingBottom: nestInsideStatCard ? 0 : 14 }}>
        <TotlText variant="muted" style={{ fontSize: 12, fontWeight: '600' }}>
          {`GW${rows[0]!.gw}–GW${rows[n - 1]!.gw}`}
        </TotlText>
      </View>
    </>
  );

  if (nestInsideStatCard) {
    return <View>{content}</View>;
  }

  return (
    <LinearGradient
      colors={[String(t.color.surface2), String(t.color.surface)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{
        marginTop: 14,
        borderRadius: 14,
        overflow: 'hidden',
        paddingTop: 14,
        paddingBottom: 0,
        borderWidth: 1,
        borderColor: t.color.border,
      }}
    >
      {content}
    </LinearGradient>
  );
}
