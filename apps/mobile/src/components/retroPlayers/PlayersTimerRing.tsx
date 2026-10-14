import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { TotlText } from '@totl/ui';

import { PLAYERS_COLORS, PLAYERS_FONTS } from './playersTheme';

const SIZE = 32;
const STROKE = 3.5;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** Countdown ring in the question card's top-right corner (design: 32pt, brand-green number). */
export default function PlayersTimerRing({ secondsLeft, fraction }: { secondsLeft: number; fraction: number }) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <View
      style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel={`${secondsLeft} seconds left`}
    >
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={PLAYERS_COLORS.mist} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={PLAYERS_COLORS.brand}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={CIRC * (1 - clamped)}
        />
      </Svg>
      <TotlText style={{ fontFamily: PLAYERS_FONTS.medium, fontSize: 16, lineHeight: 20, color: PLAYERS_COLORS.brand }}>
        {secondsLeft}
      </TotlText>
    </View>
  );
}
