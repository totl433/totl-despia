import React from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Card, TotlText } from '@totl/ui';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';
import WinnerShimmer from '../WinnerShimmer';
import RetroDailyTotlPattern from './RetroDailyTotlPattern';

/**
 * Top card: Retro Totl Daily branding + season + swipe to start.
 * Soft 3D idle + shimmer on first view.
 */
export default function RetroDailyIntroCard({
  seasonLabel,
}: {
  seasonLabel: string;
}) {
  const enter = useSharedValue(0);
  const idle = useSharedValue(0);

  React.useEffect(() => {
    enter.value = withTiming(1, {
      duration: 720,
      easing: Easing.out(Easing.cubic),
    });
    idle.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          withTiming(-1, { duration: 2400, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
  }, [enter, idle]);

  const motionStyle = useAnimatedStyle(() => {
    const enterY = interpolate(enter.value, [0, 1], [-10, 0]);
    const enterScale = interpolate(enter.value, [0, 1], [0.94, 1]);
    const idleY = interpolate(idle.value, [-1, 1], [-5, 5]);
    const idleX = interpolate(idle.value, [-1, 1], [2.2, -2.2]);
    return {
      flex: 1,
      transform: [
        { perspective: 900 },
        { rotateY: `${enterY + idleY}deg` },
        { rotateX: `${idleX}deg` },
        { scale: enterScale },
      ],
    };
  });

  return (
    <Card
      style={{
        flex: 1,
        padding: 0,
        borderRadius: 28,
        borderWidth: 0,
        overflow: 'hidden',
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
        backgroundColor: '#0F766E',
      }}
    >
      <Animated.View style={motionStyle}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
            backgroundColor: '#0F766E',
            overflow: 'hidden',
            borderRadius: 28,
          }}
        >
          <RetroDailyTotlPattern />
          <WinnerShimmer
            durationMs={1300}
            delayMs={4200}
            opacity={0.38}
            tint="white"
            skipFirstDelay
          />
          <TotlText
            style={{
              fontSize: 13,
              fontWeight: '700',
              letterSpacing: 1.2,
              color: 'rgba(255,255,255,0.75)',
              textTransform: 'uppercase',
              textAlign: 'center',
              zIndex: 1,
            }}
          >
            Retro Totl Daily
          </TotlText>
          <TotlText
            style={{
              marginTop: 20,
              fontFamily: RETRO_PIXEL_FONT,
              fontSize: 36,
              lineHeight: 48,
              color: '#FFFFFF',
              textAlign: 'center',
              zIndex: 1,
            }}
          >
            {seasonLabel}
          </TotlText>
        <TotlText
          style={{
            marginTop: 16,
            fontFamily: RETRO_PIXEL_FONT,
            fontSize: 12,
            lineHeight: 20,
            color: 'rgba(255,255,255,0.88)',
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          Ten fixtures.{'\n'}Ten seconds each.
        </TotlText>
          <TotlText
            style={{
              marginTop: 32,
              fontSize: 15,
              lineHeight: 20,
              fontWeight: '800',
              color: '#FFFFFF',
              textAlign: 'center',
              zIndex: 1,
            }}
          >
            Swipe to start
          </TotlText>
        </View>
      </Animated.View>
    </Card>
  );
}
