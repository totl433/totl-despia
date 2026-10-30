import React from 'react';
import { Image, View, type LayoutChangeEvent } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { Pick } from '@totl/domain';
import { TotlText, useTokens } from '@totl/ui';

import { TEAM_BADGES } from '../../lib/teamBadges';
import { TEAM_COLORS } from '../../lib/teamColors';
import { cardSeen, onCardSeen } from '../../features/matchCenter/cardVisibility';
import type { FeedMatch } from '../../features/matchCenter/feed';

const COLON = Asset.fromModule(require('../../../assets/icons/score-colon.svg')).uri;

/** Figma 371:40873. */
const INK = {
  digits: '#19191C',
  muted: '#97979D',
  draw: '#D2D2D5',
  pickBg: '#EEFDB0',
  pickInk: '#118578',
  live: '#FD7A62',
  // When a club has no colour on file.
  home: '#37373D',
  away: '#2458B8',
};
/**
 * Figma's 173.76° rainbow (percentage picker, Variant3). Its later stops sit past the end of the chip,
 * so the last colour here is the gradient's value at 100%.
 */
const RAINBOW = { colors: ['#F2BC20', '#E4716C', '#DB5281', '#D34E8D'] as const, locations: [0, 0.4351, 0.8412, 1] as const };
/**
 * Mobile/12/Medium. Figma trims the 22pt line to the cap height, so these sit in tighter boxes than
 * the line height suggests: 14pt keeps the chips and the 12pt gaps at their Figma size.
 */
const label12 = { fontSize: 12, lineHeight: 14, fontFamily: 'Gramatika-Medium' };
const REVEAL_MS = 700;

function Crest({ code, size }: { code: string; size: number }) {
  const badge = TEAM_BADGES[code];
  if (!badge) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <TotlText style={{ fontWeight: '800', fontSize: 12 }}>{code || '—'}</TotlText>
      </View>
    );
  }
  return <Image source={badge} style={{ width: size, height: size }} resizeMode="contain" />;
}

function pickOutcome(home: number | null, away: number | null): Pick | null {
  if (home === null || away === null) return null;
  return home > away ? 'H' : home < away ? 'A' : 'D';
}

/**
 * The game card's crests and score (Figma 371:40876): 60pt crests either side of a 56pt light
 * score, with the match clock under it. Before kick-off (no score yet) the score reads "v".
 */
export function GameCardScore({ match, kickoff, timeLabel }: { match: FeedMatch; kickoff: boolean; timeLabel: string }) {
  const t = useTokens();
  const hasScore = match.homeScore !== null && match.awayScore !== null;
  const digit = { fontSize: 56, lineHeight: 64, fontFamily: t.font.light, color: INK.digits, textAlign: 'center' as const };
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 16 }}>
        <Crest code={match.homeCode} size={60} />
        {kickoff || hasScore ? (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8.736 }}
            accessible
            accessibilityLabel={`${match.homeCode} ${kickoff ? 0 : match.homeScore}, ${match.awayCode} ${kickoff ? 0 : match.awayScore}`}
          >
            <TotlText style={[digit, { minWidth: 48 }]}>{kickoff ? '0' : String(match.homeScore)}</TotlText>
            <SvgUri uri={COLON} width={3.99017} height={25.3169} />
            <TotlText style={[digit, { minWidth: 48 }]}>{kickoff ? '0' : String(match.awayScore)}</TotlText>
          </View>
        ) : (
          <TotlText style={[digit, { width: 119 }]}>v</TotlText>
        )}
        <Crest code={match.awayCode} size={60} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }}>
        {match.live ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: INK.live }} /> : null}
        <TotlText style={[label12, { color: INK.muted, textAlign: 'center' }]}>{timeLabel}</TotlText>
      </View>
    </View>
  );
}

function sideColor(code: string, fallback: string): string {
  return TEAM_COLORS[code]?.primary ?? fallback;
}

/**
 * Who picked what (Figma 371:40886): the vote count, one bar split home / draw / away in club
 * colours (the draw is always grey, so the two clubs never touch), and the three shares under it.
 * Your pick is the lime chip; it turns rainbow when the score on the card matches it.
 *
 * The first time the card comes on screen this session the bar fills from the left and the
 * shares count up; after that it shows straight away, and later vote changes slide into place.
 */
export function PickBar({ match, cardId }: { match: FeedMatch; cardId: string }) {
  const reduceMotion = useReducedMotion();
  const percents = match.percents ?? null;
  const outcome = pickOutcome(match.homeScore, match.awayScore);
  const shinySide = match.pick && outcome && match.pick === outcome ? outcome : null;

  // 0 → 1 as the bar is revealed. Starts full when this card has already played (or motion is off).
  const playedAlready = reduceMotion || cardSeen(cardId);
  const reveal = useSharedValue(playedAlready ? 1 : 0);
  const [countUp, setCountUp] = React.useState(playedAlready ? 1 : 0);
  React.useEffect(() => {
    if (!percents || reveal.value === 1) return;
    const play = () => {
      reveal.value = withDelay(120, withTiming(1, { duration: REVEAL_MS, easing: Easing.out(Easing.cubic) }));
    };
    if (cardSeen(cardId)) {
      play();
      return;
    }
    return onCardSeen(cardId, play);
    // `percents` only matters for whether there is a bar at all.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, !!percents]);
  useAnimatedReaction(
    () => Math.round(reveal.value * 50) / 50,
    (next, prev) => {
      if (next !== prev) runOnJS(setCountUp)(next);
    }
  );

  // Segment shares slide to new values when votes come in.
  const h = useSharedValue(percents?.H ?? 0);
  const d = useSharedValue(percents?.D ?? 0);
  const a = useSharedValue(percents?.A ?? 0);
  React.useEffect(() => {
    if (!percents) return;
    const ease = { duration: reduceMotion ? 0 : 450, easing: Easing.out(Easing.cubic) };
    h.value = withTiming(percents.H, ease);
    d.value = withTiming(percents.D, ease);
    a.value = withTiming(percents.A, ease);
  }, [percents?.H, percents?.D, percents?.A, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  const [trackWidth, setTrackWidth] = React.useState(0);
  const onTrackLayout = React.useCallback((e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width), []);
  const clipStyle = useAnimatedStyle(() => ({ width: `${reveal.value * 100}%` }));
  const homeStyle = useAnimatedStyle(() => ({ flexGrow: h.value }));
  const drawStyle = useAnimatedStyle(() => ({ flexGrow: d.value }));
  const awayStyle = useAnimatedStyle(() => ({ flexGrow: a.value }));

  if (!match.pick && !percents) return null;
  const votes = percents?.votes;

  const share = (side: Pick) => (percents ? Math.round(percents[side] * countUp) : null);
  const labelFor = (side: Pick) => {
    const pct = share(side);
    const name = side === 'H' ? match.homeCode : side === 'A' ? match.awayCode : 'Draw';
    return pct == null ? name : `${pct}% ${name}`;
  };

  return (
    <View style={{ gap: 12, marginTop: 20 }}>
      {typeof votes === 'number' && votes > 0 ? (
        <TotlText style={[label12, { color: INK.muted }]}>{`${votes.toLocaleString('en-GB')} ${votes === 1 ? 'vote' : 'votes'}`}</TotlText>
      ) : null}
      {percents ? (
        <View onLayout={onTrackLayout} style={{ height: 13 }}>
          <Reanimated.View style={[{ height: 13, borderRadius: 4, overflow: 'hidden' }, clipStyle]}>
            <View style={{ width: trackWidth, height: 13, flexDirection: 'row' }}>
              <Reanimated.View style={[{ flexBasis: 0, backgroundColor: sideColor(match.homeCode, INK.home) }, homeStyle]} />
              <Reanimated.View style={[{ flexBasis: 0, backgroundColor: INK.draw }, drawStyle]} />
              <Reanimated.View style={[{ flexBasis: 0, backgroundColor: sideColor(match.awayCode, INK.away) }, awayStyle]} />
            </View>
          </Reanimated.View>
        </View>
      ) : null}
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        accessible
        accessibilityLabel={(['H', 'D', 'A'] as const)
          .map((side) => `${percents ? `${percents[side]}% ` : ''}${side === 'H' ? match.homeCode : side === 'A' ? match.awayCode : 'draw'}${match.pick === side ? ', your pick' : ''}`)
          .join('; ')}
      >
        {(['H', 'D', 'A'] as const).map((side) => (
          <PercentagePicker key={side} label={labelFor(side)} variant={shinySide === side ? 'correct' : match.pick === side ? 'picked' : 'plain'} />
        ))}
      </View>
    </View>
  );
}

/**
 * One share under the bar (Figma 367:46660, "percentage picker"): plain grey, your pick in lime
 * with a tick, or your pick in rainbow once the score matches it. 4pt padding at the sides and
 * 6pt top and bottom around the 8pt cap height: 20pt tall.
 */
function PercentagePicker({ label, variant }: { label: string; variant: 'plain' | 'picked' | 'correct' }) {
  const ink = variant === 'correct' ? '#F7F6F6' : variant === 'picked' ? INK.pickInk : INK.muted;
  return (
    <View
      style={{
        height: 20,
        paddingHorizontal: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: variant === 'picked' ? INK.pickBg : undefined,
      }}
    >
      {variant === 'correct' ? (
        <LinearGradient
          colors={RAINBOW.colors}
          locations={RAINBOW.locations}
          start={{ x: 0.446, y: 0 }}
          end={{ x: 0.554, y: 1 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
      ) : null}
      {variant === 'plain' ? null : <Ionicons name="checkmark" size={11} color={ink} />}
      <TotlText style={[label12, { color: ink, includeFontPadding: false }]}>{label}</TotlText>
    </View>
  );
}
