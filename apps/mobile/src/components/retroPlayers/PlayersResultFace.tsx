import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { TotlText } from '@totl/ui';

import {
  playersOrdinal,
  playersPositionLabel,
  playersWinnerLabel,
  type PlayersResult,
} from '../../lib/retroPlayers/results';
import PlayersPatternCard from './PlayersPatternCard';
import { PLAYERS_COLORS, PLAYERS_FONTS, PlayersCardScale } from './playersTheme';

/** The glow behind the trophy / medal (Figma drop shadows #FCE56B and #FCC43D). */
const GLOW = { outer: '#FCE56B', inner: '#FCC43D' };

function GoldGlow({ size, centerY }: { size: number; centerY: number }) {
  return (
    <Svg
      width={size}
      height={size}
      pointerEvents="none"
      style={{ position: 'absolute', top: centerY - size / 2, left: '50%', marginLeft: -size / 2 }}
    >
      <Defs>
        <RadialGradient id="result-glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={GLOW.inner} stopOpacity={0.55} />
          <Stop offset="0.35" stopColor={GLOW.outer} stopOpacity={0.22} />
          <Stop offset="1" stopColor={GLOW.outer} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={size} height={size} fill="url(#result-glow)" />
    </Svg>
  );
}

/**
 * A result card for The Players (Figma 171:34277): yesterday, last week or last month,
 * winner (trophy) or not (medal). Laid out on the design's 353pt card and scaled with it.
 * Every face accepts `instant` because the swipe stack clones the outgoing face with it.
 */
export default function PlayersResultFace({
  result,
  userId,
  names,
}: {
  result: PlayersResult;
  userId: string;
  /** Display names of the period's winners. */
  names: Record<string, string>;
  instant?: boolean;
}) {
  const s = React.useContext(PlayersCardScale);
  const daily = result.period === 'day';
  const title = 60 * s;
  const titlePad = title * 0.12;

  // Yesterday: a smaller trophy with the place under it (Figma 207:40986).
  // Week and month: a larger trophy alone (Figma 207:39012).
  const icon = daily ? { top: 156, width: 86, height: 90, size: 75.6 } : { top: 155, width: 120.4, height: 126, size: 105.84 };
  const iconCenter = (icon.top + icon.height / 2) * s;

  const place = daily
    ? `${result.position.tied ? 'Joint ' : ''}${playersOrdinal(result.position.rank)} Place`
    : null;

  const rows: Array<[string, string]> =
    daily && result.standings
      ? [
          ['Week', playersPositionLabel(result.standings.week)],
          [result.standings.monthName, playersPositionLabel(result.standings.month)],
          ['Overall', playersPositionLabel(result.standings.overall)],
        ]
      : [
          ['Position', playersPositionLabel(result.position)],
          ['Points', `${result.points}/${result.maxPoints}`],
          ['Winner', playersWinnerLabel(result.winners, userId, names)],
        ];

  const rowText = {
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 17.94 * s,
    lineHeight: 28.7 * s,
    letterSpacing: 0.18 * s,
    color: PLAYERS_COLORS.white,
  };

  return (
    <PlayersPatternCard variant="green">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <GoldGlow size={(daily ? 300 : 380) * s} centerY={iconCenter} />

        <TotlText
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            position: 'absolute',
            top: 47 * s - titlePad,
            left: 20 * s,
            right: 20 * s,
            paddingTop: titlePad,
            fontFamily: PLAYERS_FONTS.display,
            fontSize: title,
            lineHeight: title * 0.86,
            letterSpacing: -1.2 * s,
            color: PLAYERS_COLORS.white,
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
        >
          {result.title}
        </TotlText>

        <View style={{ position: 'absolute', top: icon.top * s, left: 0, right: 0, alignItems: 'center' }}>
          <TotlText
            accessibilityLabel={result.winner ? 'Trophy' : 'Medal'}
            style={{
              width: icon.width * s,
              height: icon.height * s,
              fontSize: icon.size * s,
              lineHeight: icon.height * s,
              textAlign: 'center',
            }}
          >
            {result.winner ? '🏆' : '🏅'}
          </TotlText>
          {place ? (
            <TotlText
              style={{
                marginTop: 4 * s,
                fontFamily: PLAYERS_FONTS.medium,
                fontSize: 14 * s,
                lineHeight: 22.4 * s,
                letterSpacing: 0.14 * s,
                color: PLAYERS_COLORS.white,
              }}
            >
              {place}
            </TotlText>
          ) : null}
        </View>

        {rows.map(([label, value], i) => (
          <View
            key={label}
            style={{
              position: 'absolute',
              // Rows are 34pt apart from y 331; the taller line box is centred on each.
              top: (330.9 + i * 34) * s - (28.7 * s - 13 * s) / 2,
              left: 40 * s,
              right: 40 * s,
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 12 * s,
            }}
          >
            <TotlText style={rowText} numberOfLines={1}>
              {label}
            </TotlText>
            <TotlText style={[rowText, { flexShrink: 1, textAlign: 'right' }]} numberOfLines={1}>
              {value}
            </TotlText>
          </View>
        ))}
      </View>
    </PlayersPatternCard>
  );
}
