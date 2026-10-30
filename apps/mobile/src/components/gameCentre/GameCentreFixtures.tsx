import React from 'react';
import { Image, View } from 'react-native';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import { TotlText } from '@totl/ui';

import { TEAM_BADGES } from '../../lib/teamBadges';
import type { FeedFixtureRow } from '../../features/matchCenter/feed';
import { groupFixturesByDay } from '../../features/matchCenter/fixtureDays';

const CLIPBOARD = Asset.fromModule(require('../../../assets/icons/fixtures-clipboard.svg')).uri;

/** Figma 390:88272: the Gameweek fixtures card is green, with pale pills either side of the kick-off. */
export const FIXTURES_CARD = {
  background: '#118578',
  kicker: '#E6FA81',
  text: '#F7F6F6',
  pill: 'rgba(247,246,246,0.2)',
  vs: '#09443E',
};

/** The season above the title (Figma 390:88276): 12pt bold, upper case, lime. */
export const fixturesKickerStyle = {
  fontFamily: 'Gramatika-Bold',
  fontSize: 12,
  lineHeight: 14,
  letterSpacing: 0,
  textTransform: 'uppercase' as const,
  color: FIXTURES_CARD.kicker,
  // Figma puts 16pt between the season and the title; the header adds 8.
  marginBottom: 8,
};

/** Top right of the fixtures card (Figma 390:90210), sitting on the season line without pushing it down. */
export function FixturesCardIcon() {
  return (
    <View style={{ height: 14, marginTop: -4, overflow: 'visible' }}>
      <SvgUri uri={CLIPBOARD} width={32} height={32} accessibilityLabel="Fixtures" />
    </View>
  );
}

function Crest({ code }: { code: string }) {
  const badge = TEAM_BADGES[code];
  if (!badge) return <View style={{ width: 24, height: 24 }} />;
  return <Image source={badge} style={{ width: 24, height: 24 }} resizeMode="contain" />;
}

const teamText = { fontFamily: 'Gramatika-Medium', fontSize: 12, lineHeight: 14, color: FIXTURES_CARD.text };

function Side({ code, name, align }: { code: string; name: string; align: 'home' | 'away' }) {
  const home = align === 'home';
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: home ? 'flex-end' : 'flex-start',
        gap: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: FIXTURES_CARD.pill,
      }}
    >
      {home ? null : <Crest code={code} />}
      <TotlText numberOfLines={1} style={[teamText, { flexShrink: 1, textAlign: home ? 'right' : 'left' }]}>
        {name}
      </TotlText>
      {home ? <Crest code={code} /> : null}
    </View>
  );
}

/**
 * Every game in the gameweek (Figma 390:88317), grouped by day. Home club in a pill on the left,
 * the kick-off where the Figma has VS, away club mirrored on the right. 4pt
 * between rows, 8pt under a day's heading and 16pt before the next day.
 */
export function FixtureRows({ rows }: { rows: FeedFixtureRow[] }) {
  const days = React.useMemo(() => groupFixturesByDay(rows), [rows]);
  return (
    <View style={{ gap: 16 }}>
      {days.map((day) => (
        <View key={day.key} style={{ gap: 8 }}>
          <TotlText accessibilityRole="header" style={dayText}>
            {day.label}
          </TotlText>
          <View style={{ gap: 4 }}>
            {day.rows.map((row, index) => (
              <View
                key={`${row.homeCode}-${row.awayCode}-${index}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                accessible
                accessibilityLabel={`${row.homeName} versus ${row.awayName}, ${day.key === 'tbc' ? 'kick-off to be confirmed' : `${day.label.split(' ')[0]} ${row.time}`}`}
              >
                <Side code={row.homeCode} name={row.homeName} align="home" />
                <View style={timeTile}>
                  <TotlText style={timeText}>{row.time}</TotlText>
                </View>
                <Side code={row.awayCode} name={row.awayName} align="away" />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Quieter than the lime season line, so the card reads season, title, day, games. */
const dayText = { fontFamily: 'Gramatika-Medium', fontSize: 12, lineHeight: 14, color: 'rgba(247,246,246,0.7)' };

/** The kick-off sits where the Figma's VS is, in the day heading's colour, with no tile. */
const timeTile = {
  width: 45,
  height: 36,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
const timeText = {
  fontFamily: 'Gramatika-Medium',
  fontSize: 12,
  lineHeight: 14,
  color: dayText.color,
  fontVariant: ['tabular-nums' as const],
};
