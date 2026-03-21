import React from 'react';
import { Animated, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTokens } from '@totl/ui';

const GOAL_DOT_ROWS = [
  '0111000111000111000100001000',
  '1000101000101000100100001000',
  '1000001000101000100100001000',
  '1011101000101111100100001000',
  '1000101000101000100100000000',
  '1000101000101000100100001000',
  '0111000111001000100111101000',
] as const;

function isLightSurface(color: string): boolean {
  const value = String(color ?? '').trim();
  const hex = value.startsWith('#') ? value.slice(1) : value;
  if (!(hex.length === 6 || hex.length === 3)) return false;
  const normalized = hex.length === 3 ? hex.split('').map((char) => `${char}${char}`).join('') : hex;
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) return false;
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.72;
}

export default function HeaderGoalMatrix() {
  const t = useTokens();
  const goalScale = React.useRef(new Animated.Value(0.92)).current;
  const glowOpacity = React.useRef(new Animated.Value(0.35)).current;
  const sweepProgress = React.useRef(new Animated.Value(0)).current;
  const flareOpacity = React.useRef(new Animated.Value(0)).current;
  const isDarkMode = !isLightSurface(t.color.background);
  const textColor = isDarkMode ? '#FFFFFF' : '#111827';
  const glowColor = isDarkMode ? 'rgba(255,255,255,0.34)' : 'rgba(17,24,39,0.18)';
  const gridColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';
  const scanColor = isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(17,24,39,0.12)';
  const flareColor = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.08)';
  const offPixel = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.08)';

  React.useEffect(() => {
    goalScale.setValue(0.92);
    glowOpacity.setValue(0.35);
    sweepProgress.setValue(0);
    flareOpacity.setValue(0);

    const intro = Animated.sequence([
      Animated.parallel([
        Animated.spring(goalScale, {
          toValue: 1.04,
          useNativeDriver: true,
          damping: 8,
          stiffness: 190,
          mass: 0.7,
        }),
        Animated.sequence([
          Animated.timing(flareOpacity, { toValue: 0.22, duration: 120, useNativeDriver: true }),
          Animated.timing(flareOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]),
      ]),
      Animated.spring(goalScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 10,
        stiffness: 180,
        mass: 0.8,
      }),
    ]);

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.82, duration: 220, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.48, duration: 260, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.9, duration: 160, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.42, duration: 220, useNativeDriver: true }),
      ])
    );

    const sweepLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweepProgress, { toValue: 1, duration: 620, useNativeDriver: true }),
        Animated.timing(sweepProgress, { toValue: 0, duration: 1, useNativeDriver: true }),
        Animated.delay(90),
      ])
    );

    intro.start();
    glowLoop.start();
    sweepLoop.start();

    return () => {
      intro.stop();
      glowLoop.stop();
      sweepLoop.stop();
    };
  }, [flareOpacity, glowOpacity, goalScale, sweepProgress]);

  const sweepTranslateX = sweepProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-220, 220],
  });

  const boardWidth = 154;
  const boardHeight = 38;
  const cols = GOAL_DOT_ROWS[0].length;
  const rows = GOAL_DOT_ROWS.length;
  const stepX = boardWidth / cols;
  const stepY = boardHeight / rows;
  const pixelSize = Math.min(stepX, stepY) * 0.72;
  const glowSize = pixelSize * 1.35;

  return (
    <Animated.View
      style={{
        minHeight: 40,
        borderRadius: 999,
        overflow: 'hidden',
        transform: [{ scaleX: goalScale }, { scaleY: goalScale }],
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          opacity: flareOpacity,
          backgroundColor: flareColor,
        }}
      />

      <Animated.View
        style={{
          position: 'absolute',
          top: -12,
          bottom: -12,
          width: 64,
          transform: [{ translateX: sweepTranslateX }],
          opacity: 0.22,
          backgroundColor: scanColor,
        }}
      />

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        }}
      >
        {Array.from({ length: 20 }).map((_, index) => (
          <View
            key={`goal-scan-${index}`}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${index * 5}%`,
              height: 1,
              backgroundColor: gridColor,
              opacity: 0.7,
            }}
          />
        ))}
      </View>

      <View
        style={{
          minHeight: 40,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 14,
        }}
      >
        <View
          style={{
            width: boardWidth,
            height: boardHeight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.View style={{ position: 'absolute', opacity: glowOpacity }}>
            <Svg width={boardWidth} height={boardHeight} viewBox={`0 0 ${boardWidth} ${boardHeight}`}>
              {GOAL_DOT_ROWS.flatMap((row, rowIndex) =>
                row.split('').map((cell, colIndex) => {
                  if (cell !== '1') return null;
                  const x = stepX * colIndex + (stepX - glowSize) / 2;
                  const y = stepY * rowIndex + (stepY - glowSize) / 2;
                  return <Rect key={`glow-${rowIndex}-${colIndex}`} x={x} y={y} width={glowSize} height={glowSize} rx={1} fill={glowColor} />;
                })
              )}
            </Svg>
          </Animated.View>

          <Svg width={boardWidth} height={boardHeight} viewBox={`0 0 ${boardWidth} ${boardHeight}`}>
            {GOAL_DOT_ROWS.flatMap((row, rowIndex) =>
              row.split('').map((cell, colIndex) => {
                const x = stepX * colIndex + (stepX - pixelSize) / 2;
                const y = stepY * rowIndex + (stepY - pixelSize) / 2;
                if (cell === '1') {
                  return <Rect key={`dot-${rowIndex}-${colIndex}`} x={x} y={y} width={pixelSize} height={pixelSize} rx={1} fill={textColor} />;
                }
                return (
                  <Rect
                    key={`off-${rowIndex}-${colIndex}`}
                    x={x + pixelSize * 0.12}
                    y={y + pixelSize * 0.12}
                    width={pixelSize * 0.76}
                    height={pixelSize * 0.76}
                    rx={0.5}
                    fill={offPixel}
                  />
                );
              })
            )}
          </Svg>
        </View>
      </View>
    </Animated.View>
  );
}
