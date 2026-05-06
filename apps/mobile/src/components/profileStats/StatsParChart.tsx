import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

type Row = { gw: number; userPoints: number; averagePoints: number };

const GRAPH_HEIGHT = 120;
const BAR_WIDTH = 48;
const GAP = 8;

/** Weekly vs avg chart palette — matches native Stats reference (soft green/red + pale gray base). */
const BAR_GREY = '#E1E4E8';
const GREEN_POS = '#56B881';
const RED_NEG = '#DB524B';
/** At-par column (needs contrast for white “Par” label). */
const BAR_PAR = '#9CA3AF';

/** Matches web `LiveGamesToggle` for Stats par chart: Simple ↔ Complex. */
export function WeeklyParChartToggle({
  complex,
  onChange,
}: {
  complex: boolean;
  onChange: (next: boolean) => void;
}) {
  const t = useTokens();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TotlText style={{ fontSize: 10, fontWeight: '600', color: complex ? t.color.muted : t.color.text }}>
        Simple
      </TotlText>
      <Pressable
        onPress={() => onChange(!complex)}
        accessibilityRole="switch"
        accessibilityState={{ checked: complex }}
        accessibilityLabel={complex ? 'Show simple chart' : 'Show complex chart'}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View
          style={{
            width: 48,
            height: 24,
            borderRadius: 12,
            backgroundColor: complex ? '#DC2626' : '#CBD5E1',
            justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: '#FFFFFF',
              alignSelf: complex ? 'flex-end' : 'flex-start',
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          />
        </View>
      </Pressable>
      <TotlText style={{ fontSize: 10, fontWeight: '600', color: complex ? t.color.text : t.color.muted }}>
        Complex
      </TotlText>
    </View>
  );
}

function ParColumn({
  data,
  latestGw,
  range,
  showInfo,
  brandHex,
}: {
  data: Row;
  latestGw: number | null;
  range: number;
  showInfo: boolean;
  brandHex: string;
}) {
  const t = useTokens();
  const { gw, userPoints, averagePoints } = data;
  const minValue = 0;
  const diff = userPoints - averagePoints;
  const isLatest = latestGw !== null && gw === latestGw;
  const isAbovePar = diff > 0;
  const isBelowPar = diff < 0;

  const userBarHeight = ((userPoints - minValue) / range) * GRAPH_HEIGHT;
  const parBarHeight = ((averagePoints - minValue) / range) * GRAPH_HEIGHT;
  const maxBarHeight = Math.max(userBarHeight, parBarHeight);

  const scoreColor = isLatest ? brandHex : isAbovePar ? GREEN_POS : isBelowPar ? RED_NEG : t.color.text;

  const diffLabel =
    isAbovePar ? `+${diff.toFixed(1)}` : isBelowPar ? `${diff.toFixed(1)}` : 'Par';
  /** Positive: green on pale gray segment; negative / tie: white on colored bar. */
  const diffColor = isAbovePar ? GREEN_POS : '#FFFFFF';

  return (
    <View style={{ width: BAR_WIDTH, alignItems: 'center' }}>
      <View
        style={{
          height: GRAPH_HEIGHT,
          width: '100%',
          justifyContent: 'flex-end',
          alignItems: 'center',
          overflow: 'visible',
        }}
      >
        <View
          style={{
            height: maxBarHeight,
            width: BAR_WIDTH,
            position: 'relative',
            overflow: 'visible',
          }}
        >
          {isAbovePar ? (
            <>
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: Math.max(parBarHeight, 2),
                  backgroundColor: BAR_GREY,
                  borderTopLeftRadius: 2,
                  borderTopRightRadius: parBarHeight >= maxBarHeight - 0.5 ? 2 : 0,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: parBarHeight,
                  left: 0,
                  right: 0,
                  height: Math.max(userBarHeight - parBarHeight, 2),
                  backgroundColor: GREEN_POS,
                  borderTopLeftRadius: 2,
                  borderTopRightRadius: 2,
                }}
              />
            </>
          ) : isBelowPar ? (
            <>
              <View
                style={{
                  position: 'absolute',
                  bottom: userBarHeight,
                  left: 0,
                  right: 0,
                  height: Math.max(parBarHeight - userBarHeight, 2),
                  backgroundColor: BAR_GREY,
                  borderTopLeftRadius: 2,
                  borderTopRightRadius: 2,
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: Math.max(userBarHeight, 2),
                  backgroundColor: RED_NEG,
                  borderTopLeftRadius: userBarHeight >= maxBarHeight - 0.5 ? 2 : 0,
                  borderTopRightRadius: userBarHeight >= maxBarHeight - 0.5 ? 2 : 0,
                }}
              />
            </>
          ) : (
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: Math.max(userBarHeight, 4),
                backgroundColor: BAR_PAR,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
              }}
            />
          )}

          {maxBarHeight > 15 ? (
            <View
              style={{
                position: 'absolute',
                bottom: 4,
                left: 0,
                right: 0,
                alignItems: 'center',
                justifyContent: 'center',
                height: 16,
                zIndex: 5,
              }}
            >
              <TotlText style={{ fontSize: 13, lineHeight: 16, fontWeight: '900', color: diffColor }}>{diffLabel}</TotlText>
            </View>
          ) : null}

          {/* Same as web `ParChart`: score sits ~4px above the stacked bar (not above full chart height). */}
          {showInfo ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: maxBarHeight + 4,
                alignItems: 'center',
                zIndex: 10,
              }}
            >
              <TotlText style={{ fontSize: 12, lineHeight: 14, fontWeight: '700', color: scoreColor }}>
                {String(userPoints)}
              </TotlText>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: 4, alignItems: 'center', minHeight: 28 }}>
        <TotlText
          style={{
            fontSize: 10,
            fontWeight: isLatest ? '800' : '600',
            color: isLatest ? brandHex : t.color.text,
          }}
        >
          {`GW${gw}`}
        </TotlText>
        {showInfo ? (
          <TotlText style={{ fontSize: 9, fontWeight: '600', color: t.color.muted, marginTop: 2 }}>
            {`av. ${averagePoints.toFixed(1)}`}
          </TotlText>
        ) : (
          <View style={{ height: 12 }} />
        )}
      </View>
    </View>
  );
}

/**
 * Mirrors web `ParChart.tsx`: stacked avg vs user bars, +/- diff inside column,
 * Simple (default) hides score + “av.” row; Complex shows them.
 */
export default function StatsParChart({
  weeklyData,
  latestGw,
  showInfo,
  nestInsideStatCard,
}: {
  weeklyData: Row[];
  latestGw: number | null;
  showInfo: boolean;
  /** Negative horizontal margin so bars scroll flush with `StatCard` edges (matches web bleed). */
  nestInsideStatCard?: boolean;
}) {
  const t = useTokens();
  const scrollRef = React.useRef<ScrollView>(null);
  const brandHex = String(t.color.brand);

  const weeklySig =
    weeklyData.length === 0 ? '' : `${weeklyData.length}:${weeklyData[weeklyData.length - 1]!.gw}`;
  React.useEffect(() => {
    if (!weeklySig) return;
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [weeklySig]);

  const allValues = weeklyData.flatMap((d) => [d.userPoints, d.averagePoints]);
  const maxValue = allValues.length ? Math.max(...allValues, 10) : 10;
  const range = maxValue || 1;

  const statCardPad = t.space[5];
  const trailingPad = nestInsideStatCard ? statCardPad + t.space[4] : statCardPad;

  const scrollBody = (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingBottom: 8,
        paddingLeft: nestInsideStatCard ? 0 : 4,
        paddingRight: trailingPad,
      }}
    >
      {weeklyData.map((data, idx) => (
        <View key={data.gw} style={{ marginRight: idx < weeklyData.length - 1 ? GAP : 0 }}>
          <ParColumn data={data} latestGw={latestGw} range={range} showInfo={showInfo} brandHex={brandHex} />
        </View>
      ))}
    </ScrollView>
  );

  if (nestInsideStatCard) {
    return <View style={{ marginHorizontal: -statCardPad }}>{scrollBody}</View>;
  }

  return scrollBody;
}
