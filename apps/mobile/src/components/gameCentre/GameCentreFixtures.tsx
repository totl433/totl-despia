import React from 'react';
import { Image, View } from 'react-native';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import { TotlText, tokens } from '@totl/ui';

import { TEAM_BADGES } from '../../lib/teamBadges';
import type { FeedFixtureRow } from '../../features/matchCenter/feed';
import { groupFixturesByDay } from '../../features/matchCenter/fixtureDays';
import { FeedFeatureHeader } from './FeedFeatureHeader';

const CLIPBOARD = Asset.fromModule(require('../../../assets/icons/fixtures-clipboard.svg')).uri;

/** Figma 390:88272: the Gameweek fixtures card is green, with pale pills either side of the kick-off. */
export const FIXTURES_CARD = {
  background: '#118578',
  kicker: '#E6FA81',
  text: '#F7F6F6',
  pill: 'rgba(247,246,246,0.2)',
  vs: '#09443E',
};

/** Season eyebrow, title and line, with the clipboard badge (Figma 418:120014, the same header as Insights). */
export function FixturesCardHeader({ season, title, line }: { season: string; title: string; line?: string | null }) {
  return (
    <FeedFeatureHeader
      eyebrow={season}
      eyebrowColor={FIXTURES_CARD.kicker}
      title={title}
      line={line}
      // Figma has 12pt between title and line here, against 16pt on Insights.
      lineGap={4}
      textColor={FIXTURES_CARD.text}
      // The artwork carries its own tinted circle (Figma 390:90210).
      badge={<SvgUri uri={CLIPBOARD} width={32} height={32} />}
    />
  );
}

function Crest({ code }: { code: string }) {
  const badge = TEAM_BADGES[code];
  if (!badge) return <View style={{ width: 24, height: 24 }} />;
  return <Image source={badge} style={{ width: 24, height: 24 }} resizeMode="contain" />;
}

const teamText = { fontFamily: tokens.font.medium, fontSize: 12, lineHeight: 14, color: FIXTURES_CARD.text };

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
 * the kick-off in the middle, away club mirrored on the right. 4pt between rows, a lime day
 * heading over each day and 12pt before the next.
 */
export function FixtureRows({ rows }: { rows: FeedFixtureRow[] }) {
  const days = React.useMemo(() => groupFixturesByDay(rows), [rows]);
  return (
    <View style={{ gap: 12 }}>
      {days.map((day) => (
        <View key={day.key} style={{ gap: 6 }}>
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
                  <KickOff time={row.time} />
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

/**
 * The kick-off in Gramatika Black, dark green (Figma 418:120033). The trial Black has no colon,
 * so the colon alone is set in Bold; otherwise iOS would draw it in the system font.
 */
function KickOff({ time }: { time: string }) {
  const [hours, minutes] = time.split(':');
  return (
    <TotlText style={timeText}>
      {minutes == null ? (
        time
      ) : (
        <>
          {hours}
          <TotlText style={{ fontFamily: tokens.font.bold }}>:</TotlText>
          {minutes}
        </>
      )}
    </TotlText>
  );
}

const dayText = { fontFamily: tokens.font.medium, fontSize: 12, lineHeight: 14, color: FIXTURES_CARD.kicker };

const timeTile = {
  width: 45,
  height: 36,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
const timeText = {
  fontFamily: tokens.font.black,
  fontSize: 12,
  lineHeight: 14,
  color: FIXTURES_CARD.vs,
  fontVariant: ['tabular-nums' as const],
};
