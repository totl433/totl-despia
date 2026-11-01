import React from 'react';
import { ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TotlText, useTokens } from '@totl/ui';

import {
  countTrailingGameweekParticipationStreak,
  formatStreakLadderFooter,
  shortSeasonLabel,
  streakRowKey,
  type GameweekStreakRow,
} from '../../lib/gameweekStreakCount';
import { isGwStatsLiveDot, type StatsGwCompletionContext } from '../../lib/gameweekState';

export type { GameweekStreakRow };

const STREAK_SCORE_SIZE = 54;
/** Ionicons measure taller than type at equal pt — keep flame visually shorter than the digits */
const STREAK_FLAME_SIZE = Math.round(STREAK_SCORE_SIZE * 0.78);

function gwIsLiveIncompleteLegacy(gw: number, lastCompletedGw: number | null | undefined): boolean {
  return typeof lastCompletedGw === 'number' && lastCompletedGw > 0 && gw > lastCompletedGw;
}

function chipGwLabel(row: GameweekStreakRow, multiSeason: boolean): string {
  if (!multiSeason) return `GW${row.gw}`;
  const short = shortSeasonLabel(row.seasonLabel);
  return short ? `${short} · GW${row.gw}` : `GW${row.gw}`;
}

/** Horizontal chips: ladder of GWs (played → pts, skipped → —). Big number = trailing consecutive played weeks. */
export default function StatsGameweekStreakStrip({
  rows,
  lastCompletedGw,
  statsGwCompletion,
  nestInsideStatCard,
  liveSeasonLabel,
}: {
  rows: GameweekStreakRow[];
  /** Fallback when `statsGwCompletion` is missing (older callers). */
  lastCompletedGw?: number | null;
  /** Home snapshot probe — live dot on the in-progress week. */
  statsGwCompletion?: StatsGwCompletionContext | null;
  /** Flat layout on `StatCard` surface (no inner gradient frame). */
  nestInsideStatCard?: boolean;
  /** Live season label e.g. "2026/27". Prior-season chips never show a live dot. */
  liveSeasonLabel?: string | null;
}) {
  const t = useTokens();
  const scrollRef = React.useRef<ScrollView>(null);
  const n = rows.length;
  const streakCount = countTrailingGameweekParticipationStreak(rows);
  if (!n) return null;

  const multiSeason =
    new Set(rows.map((r) => r.seasonLabel?.trim()).filter((s): s is string => !!s && s.length > 0)).size > 1;
  const footer = formatStreakLadderFooter(rows);
  const scrollSig = rows.map((r) => streakRowKey(r)).join(',');
  const liveSeason = liveSeasonLabel?.trim() || null;

  const chipIsPriorSeason = (row: GameweekStreakRow) => {
    const s = row.seasonLabel?.trim();
    if (!s || !liveSeason) return false;
    return s !== liveSeason;
  };
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
        paddingRight: nestInsideStatCard ? statCardPad + t.space[4] : 14,
        paddingBottom: 10,
      }}
    >
      {rows.map((row) => {
        const scored = typeof row.points === 'number';
        const priorSeason = chipIsPriorSeason(row);
        const c = priorSeason ? null : statsGwCompletion;
        // Prior-season chips (e.g. 25/26 while live meta is 26/27 GW1): always final when scored.
        // Using live `currentGw` (=1) would hide Round Up on every GW > 1 of the old ladder.
        const showLiveDot =
          scored &&
          !priorSeason &&
          (c
            ? isGwStatsLiveDot({
                gw: row.gw,
                scored,
                currentGw: c.currentGw,
                probeHome: c.probeHome,
                probeGw: c.probeGw,
                lastCompletedGw: c.lastCompletedGw,
                probeLoading: c.probeLoading,
              })
            : gwIsLiveIncompleteLegacy(row.gw, lastCompletedGw));
        return (
          <View
            key={streakRowKey(row)}
            style={{
              minWidth: scored ? (multiSeason ? 108 : 96) : multiSeason ? 92 : 78,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: chipBg,
              borderWidth: chipBorder,
              borderColor: t.color.border,
            }}
          >
            <TotlText variant="muted" style={{ fontSize: multiSeason ? 10 : 11, fontWeight: '800' }}>
              {chipGwLabel(row, multiSeason)}
            </TotlText>
            {scored ? (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 }}
                accessibilityLabel={
                  showLiveDot
                    ? `Gameweek ${row.gw}, ${row.points} points, live`
                    : `Gameweek ${row.gw}, ${row.points} points`
                }
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
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <TotlText
              style={{
                fontSize: STREAK_SCORE_SIZE,
                lineHeight: STREAK_SCORE_SIZE + 8,
                fontWeight: '900',
                letterSpacing: -2,
                // iOS clips the last glyph when letterSpacing is negative.
                paddingRight: 6,
                includeFontPadding: false,
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
        <TotlText variant="muted" style={{ fontSize: 12, fontWeight: '600', lineHeight: 16 }}>
          Streaks run across seasons — keep predicting every week to climb.
        </TotlText>
      </View>

      {nestInsideStatCard ? (
        <View style={{ marginHorizontal: -statCardPad }}>{scrollRow}</View>
      ) : (
        scrollRow
      )}

      <View style={{ paddingHorizontal: inset, paddingTop: 8, paddingBottom: nestInsideStatCard ? 0 : 14 }}>
        <TotlText
          variant="muted"
          style={{ fontSize: 12, fontWeight: '600', lineHeight: 18, paddingTop: 2 }}
        >
          {footer}
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
