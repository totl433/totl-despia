import React from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { TotlText } from '@totl/ui';

export type PipResult = 'correct' | 'wrong' | 'pending';

const SLOT = { width: 28, height: 28, alignItems: 'center' as const, justifyContent: 'center' as const };

/** Same blue→red ramp as the old top timer bar. */
function timerColorFromPct(p: number): string {
  const t = Math.min(1, Math.max(0, p));
  const r = Math.round(59 + (220 - 59) * (1 - t));
  const g = Math.round(130 + (38 - 130) * (1 - t));
  const b = Math.round(246 + (38 - 246) * (1 - t));
  return `rgb(${r},${g},${b})`;
}

function PulsePip({ label, color }: { label: string; color: string }) {
  const beat = useSharedValue(0);
  React.useEffect(() => {
    beat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 450, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 450, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [beat]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(beat.value, [0, 1], [1, 1.12]) }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
        },
        style,
      ]}
    >
      <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 11, lineHeight: 14 }}>{label}</TotlText>
    </Animated.View>
  );
}

/**
 * Dual-mode pips (fixed slot size so the row doesn’t jump between states):
 * - progress: fixture steps (empty → current → ✓)
 * - countdown: 10s timer — each pip is a second; active one pulses with the number
 * - results: end-of-run ✓ / ✗ / empty from actual outcomes
 */
export default function RetroDailyProgressPips({
  total,
  completed,
  current,
  mode = 'progress',
  secondsLeft = 10,
  timerPct = 1,
  results,
}: {
  total: number;
  completed: number;
  current: number;
  mode?: 'progress' | 'countdown' | 'results';
  secondsLeft?: number;
  timerPct?: number;
  results?: PipResult[];
}) {
  if (mode === 'countdown') {
    const n = Math.max(1, Math.min(total, Math.round(secondsLeft)));
    const activeIndex = n - 1;
    const color = timerColorFromPct(timerPct);

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 28 }}>
        {Array.from({ length: total }, (_, i) => {
          const elapsed = i > activeIndex;
          const active = i === activeIndex;
          return (
            <View key={i} style={SLOT}>
              {active ? (
                <PulsePip label={String(n)} color={color} />
              ) : (
                <View
                  style={{
                    width: elapsed ? 12 : 14,
                    height: elapsed ? 12 : 14,
                    borderRadius: 999,
                    backgroundColor: elapsed ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.4)',
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
    );
  }

  if (mode === 'results') {
    const row = results ?? Array.from({ length: total }, () => 'pending' as PipResult);
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 28 }}>
        {Array.from({ length: total }, (_, i) => {
          const r = row[i] ?? 'pending';
          return (
            <View key={i} style={SLOT}>
              {r === 'correct' || r === 'wrong' ? (
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: r === 'correct' ? '#1C8376' : '#DC2626',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 11, lineHeight: 14 }}>
                    {r === 'correct' ? '✓' : '✗'}
                  </TotlText>
                </View>
              ) : (
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.25)',
                  }}
                />
              )}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 28 }}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < completed;
        const active = !done && i === current;
        return (
          <View key={i} style={SLOT}>
            {done ? (
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: '#1C8376',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 11, lineHeight: 14 }}>✓</TotlText>
              </View>
            ) : (
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
