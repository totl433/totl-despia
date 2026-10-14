import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { PLAYERS_COLORS } from './playersTheme';

export type PlayersDotState = 'todo' | 'active' | 'correct' | 'wrong';

const SLOT = 22;

function Dot({ state }: { state: PlayersDotState }) {
  if (state === 'active') {
    return (
      <Svg width={34} height={SLOT} viewBox="0 0 34 22">
        <Rect x={1} y={4} width={32} height={14} rx={7} fill={PLAYERS_COLORS.brand} />
      </Svg>
    );
  }
  if (state === 'correct' || state === 'wrong') {
    const fill = state === 'correct' ? PLAYERS_COLORS.brand : PLAYERS_COLORS.red;
    return (
      <Svg width={SLOT} height={SLOT} viewBox="0 0 22 22">
        <Circle cx={11} cy={11} r={9} fill={fill} />
        {state === 'correct' ? (
          <Path d="M7 11.4l2.6 2.6L15 8.6" stroke="#FFFFFF" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <Path d="M8 8l6 6M14 8l-6 6" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
        )}
      </Svg>
    );
  }
  return (
    <Svg width={SLOT} height={SLOT} viewBox="0 0 22 22">
      <Circle cx={11} cy={11} r={7} fill={PLAYERS_COLORS.mist} />
    </Svg>
  );
}

/** Ten-step progress row from the design header (22pt slots, 4pt gaps). */
export default function PlayersProgressDots({ states }: { states: PlayersDotState[] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityRole="progressbar">
      {states.map((state, i) => (
        <Dot key={i} state={state} />
      ))}
    </View>
  );
}
