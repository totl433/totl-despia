import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { Easing, FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';

function CheckCircle({ size = 16, color = '#1C8376' }: { size?: number; color?: string }) {
  // From `/Users/carlstratton/Desktop/check.svg` (path only), kept inline to avoid asset-pipeline differences.
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M7.99628 16C3.60019 16 0 12.3998 0 8.00372C0 3.60762 3.60019 0 7.99628 0C12.3924 0 16 3.60762 16 8.00372C16 12.3998 12.3924 16 7.99628 16ZM7.1855 11.7824C7.54254 11.7824 7.86983 11.5965 8.0781 11.2841L11.5146 6.12924C11.6634 5.92097 11.7304 5.69781 11.7304 5.49698C11.7304 4.97629 11.2692 4.59693 10.7559 4.59693C10.4138 4.59693 10.1534 4.78289 9.92283 5.13993L7.17062 9.48396L5.98791 8.0781C5.77964 7.83264 5.54905 7.71362 5.25151 7.71362C4.73826 7.71362 4.30683 8.12273 4.30683 8.65086C4.30683 8.89633 4.37378 9.08973 4.58205 9.32775L6.26313 11.3064C6.51604 11.6113 6.81358 11.7824 7.1855 11.7824Z"
        fill={color}
      />
    </Svg>
  );
}

export default function PredictionsProgressPills({
  total,
  currentIndex,
  hasPick,
}: {
  total: number;
  currentIndex: number;
  hasPick: (idx: number) => boolean;
}) {
  if (total <= 0) return null;

  const DOT = 16;
  const CURRENT_W = 34;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 10,
      }}
    >
      {Array.from({ length: total }, (_, idx) => {
        const isCurrent = idx === currentIndex;
        const picked = hasPick(idx);

        // Design:
        // - completed picks: green check circle
        // - current pick: green rounded capsule
        // - remaining: light grey/green dots
        if (picked && !isCurrent) {
          return (
            <Animated.View
              key={idx}
              entering={FadeIn.duration(140).easing(Easing.out(Easing.cubic))}
              exiting={FadeOut.duration(90).easing(Easing.in(Easing.cubic))}
              style={{ width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' }}
            >
              <Animated.View
                entering={ZoomIn.duration(160).easing(Easing.out(Easing.cubic))}
                exiting={ZoomOut.duration(120).easing(Easing.in(Easing.cubic))}
                style={{ width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' }}
              >
                <CheckCircle size={DOT} color="#1C8376" />
              </Animated.View>
            </Animated.View>
          );
        }

        return (
          <View
            key={idx}
            style={{
              width: isCurrent ? CURRENT_W : DOT,
              height: DOT,
              borderRadius: 999,
              backgroundColor: isCurrent ? '#1C8376' : 'rgba(148,163,184,0.25)',
              borderWidth: 0,
            }}
          />
        );
      })}
    </View>
  );
}

