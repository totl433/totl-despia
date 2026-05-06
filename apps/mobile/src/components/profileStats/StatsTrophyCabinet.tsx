import React from 'react';
import { Alert, Animated, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TotlText, useTokens } from '@totl/ui';

/** Same cup path as web `TrophyCabinet.tsx` (Heroicons-style trophy). */
const TROPHY_PATH =
  'M16 3c1.1046 0 2 0.89543 2 2h2c1.1046 0 2 0.89543 2 2v1c0 2.695-2.1323 4.89-4.8018 4.9941-.8777 1.5207-2.4019 2.6195-4.1982 2.9209V19h3c.5523 0 1 .4477 1 1s-.4477 1-1 1H8c-.55228 0-1-.4477-1-1s.44772-1 1-1h3v-3.085c-1.7965-.3015-3.32148-1.4-4.19922-2.9209C4.13175 12.8895 2 10.6947 2 8V7c0-1.10457.89543-2 2-2h2c0-1.10457.89543-2 2-2zm-8 7c0 2.2091 1.79086 4 4 4 2.2091 0 4-1.7909 4-4V5H8zM4 8c0 1.32848.86419 2.4532 2.06055 2.8477C6.02137 10.5707 6 10.2878 6 10V7H4zm14 2c0 .2878-.0223.5706-.0615.8477C19.1353 10.4535 20 9.32881 20 8V7h-2z';

/** Rendered trophy size (viewBox stays 24×24). */
const TROPHY_GLYPH_PX = 56;
const TROPHY_SLOT = { width: 68, height: 58 };

function AnimatedTrophyGlyph({ active }: { active: boolean }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const rotate = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!active) {
      scale.setValue(1);
      rotate.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.05, duration: 500, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: -1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.1, duration: 500, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.05, duration: 500, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: -1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      scale.setValue(1);
      rotate.setValue(0);
    };
  }, [active, rotate, scale]);

  const rotateStr = rotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-3deg', '0deg', '3deg'],
  });

  return (
    <Animated.View
      style={{
        transform: [{ scale }, { rotate: rotateStr }],
        opacity: active ? 1 : 0.4,
        shadowColor: active ? '#FBBF24' : 'transparent',
        shadowOpacity: active ? 0.55 : 0,
        shadowRadius: active ? 14 : 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: active ? 8 : 0,
      }}
    >
      <Svg width={TROPHY_GLYPH_PX} height={TROPHY_GLYPH_PX} viewBox="0 0 24 24">
        <Path fill="#EAB308" d={TROPHY_PATH} />
      </Svg>
    </Animated.View>
  );
}

function TrophyTile({ label, count, onPress }: { label: string; count: number; onPress?: () => void }) {
  const active = count > 0;
  const badgeLabel = count > 99 ? '99+' : String(count);
  const badgeFontSize = count > 99 ? 10 : 12;
  /** Match lineHeight to font size so the digit sits vertically centred in the pill/circle. */
  const badgeLineHeight = badgeFontSize;

  const shellStyle = {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center' as const,
    justifyContent: 'flex-start' as const,
  };

  const body = (
    <>
      <View
        style={{
          position: 'relative',
          marginBottom: 10,
          alignItems: 'center',
          justifyContent: 'center',
          width: TROPHY_SLOT.width,
          height: TROPHY_SLOT.height,
        }}
      >
        <AnimatedTrophyGlyph active={active} />
        {active ? (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -6,
              backgroundColor: '#FACC15',
              borderRadius: 999,
              minWidth: 26,
              height: 26,
              paddingHorizontal: count > 99 ? 6 : 0,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#FFFFFF',
              zIndex: 2,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: badgeFontSize,
                lineHeight: badgeLineHeight,
                fontWeight: '800',
                color: '#713F12',
                textAlign: 'center',
                ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' as const } : {}),
              }}
            >
              {badgeLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <TotlText style={{ fontSize: 12, fontWeight: '600', color: '#475569', textAlign: 'center' }} numberOfLines={2}>
        {label}
      </TotlText>
    </>
  );

  if (active && onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityHint="Opens your winner cards for this trophy type, newest first"
        accessibilityLabel={`${label} trophies, view winner cards`}
        style={({ pressed }) => [shellStyle, { opacity: pressed ? 0.9 : 1 }]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={shellStyle}>{body}</View>;
}

export default function StatsTrophyCabinet({
  gameweekWins,
  monthlyWins,
  onPressGameweek,
  onPressMonthly,
}: {
  gameweekWins: number;
  monthlyWins: number;
  onPressGameweek?: () => void;
  onPressMonthly?: () => void;
}) {
  const t = useTokens();

  const items = [
    { label: 'Gameweek', count: gameweekWins, onPress: onPressGameweek },
    { label: 'Monthly', count: monthlyWins, onPress: onPressMonthly },
  ];
  const total = gameweekWins + monthlyWins;
  const anyTappable =
    (gameweekWins > 0 && !!onPressGameweek) || (monthlyWins > 0 && !!onPressMonthly);
  const footerTapCue = Platform.OS === 'web' ? 'Click a trophy to open your cards.' : 'Tap a trophy to open your cards.';

  const onInfo = () => {
    Alert.alert(
      'Leaderboard trophy cabinet',
      'You earn a trophy when you finish first on the global leaderboard for a completed gameweek or monthly period. If several players tie for first, everyone at the top gets a trophy.'
    );
  };

  return (
    <View>
      <View style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TotlText style={{ flex: 1, fontSize: 17, fontWeight: '800', color: t.color.text }}>Leaderboard trophy cabinet</TotlText>
        <Pressable
          onPress={onInfo}
          accessibilityRole="button"
          accessibilityLabel="About trophy cabinet"
          hitSlop={10}
          style={({ pressed }) => ({
            width: 22,
            height: 22,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: t.color.border,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <TotlText variant="muted" style={{ fontSize: 11, fontWeight: '900' }}>
            i
          </TotlText>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        {items.map((it) => (
          <TrophyTile key={it.label} label={it.label} count={it.count} onPress={it.onPress} />
        ))}
      </View>

      <TotlText variant="muted" style={{ marginTop: 14, fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 18 }}>
        {total > 0 ? `You have ${total} ${total === 1 ? 'trophy' : 'trophies'}.` : 'No trophies yet.'}
      </TotlText>
      {total > 0 && anyTappable ? (
        <TotlText variant="muted" style={{ marginTop: 6, fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 16, color: '#64748B' }}>
          {footerTapCue}
        </TotlText>
      ) : null}
    </View>
  );
}
