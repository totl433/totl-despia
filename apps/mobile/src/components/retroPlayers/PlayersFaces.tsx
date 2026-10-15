import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { TotlText } from '@totl/ui';

import type { PlayersCard } from '../../lib/retroPlayers/buildPuzzle';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';
import RetroDailyFlip from '../retroDaily/RetroDailyFlip';
import PlayersPatternCard from './PlayersPatternCard';
import PlayersTimerRing from './PlayersTimerRing';
import { PLAYERS_COLORS, PLAYERS_FONTS, PlayersCardScale, playersFinishedMessage } from './playersTheme';

/**
 * Card faces for The Players. Sizes follow the 353pt-wide design card and
 * scale with the real card width (provided by PlayersCardScale in playersTheme).
 * Every face accepts `instant` because the swipe stack clones the outgoing face with it.
 */
type FaceProps = { instant?: boolean };

function useScale() {
  return React.useContext(PlayersCardScale);
}

function ArrowRight({ size = 14, color = PLAYERS_COLORS.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size * (16 / 14)} height={size} viewBox="0 0 16 14" fill="none">
      <Path
        d="M1 7h13.5M8.5 1l6 6-6 6"
        stroke={color}
        strokeWidth={2.18}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Blank green face, used behind the top card in the stack. */
export function PlayersBackFace() {
  return <PlayersPatternCard variant="green" />;
}

/**
 * Holds `front`, then 3D-flips to `back`. When the swipe stack freezes this
 * face as the outgoing card (`instant`), it shows `back` straight away.
 */
export function PlayersFlipIn({
  front,
  back,
  flipKey,
  delayMs,
  durationMs,
  instant = false,
}: FaceProps & {
  front: React.ReactNode;
  back: React.ReactNode;
  flipKey: string | number;
  delayMs: number;
  durationMs: number;
}) {
  const [showBack, setShowBack] = React.useState(instant);
  const bornInstant = React.useRef(instant).current;
  React.useEffect(() => {
    if (instant) return;
    setShowBack(false);
    const id = setTimeout(() => setShowBack(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs, flipKey, instant]);

  if (bornInstant) return <View style={{ flex: 1 }}>{back}</View>;
  // Turning instant on a mounted flip keeps the same tree, so the landed back face isn't remounted.
  return (
    <RetroDailyFlip resetKey={flipKey} showB={showBack || instant} durationMs={durationMs} faceA={front} faceB={back} />
  );
}

export function PlayersIntroFace({
  mode,
  nextGame,
}: FaceProps & { mode: 'daily' | 'practice' | 'played'; nextGame: string }) {
  const s = useScale();
  const title = 93.75 * s;
  const body = {
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 17.94 * s,
    lineHeight: 26 * s,
    letterSpacing: 0.18 * s,
    color: PLAYERS_COLORS.white,
    textAlign: 'center' as const,
  };
  const lines =
    mode === 'played'
      ? ["Today's been played.", nextGame.replace(' available', '') + '.']
      : mode === 'practice'
        ? ['Practice mode.', "Scores won't count."]
        : ['10 players. 10 clubs.', 'Can you match them all?'];

  return (
    <PlayersPatternCard variant="green">
      <View style={[styles.center, { paddingHorizontal: 20 * s }]}>
        <TotlText
          accessibilityRole="header"
          style={{
            fontFamily: PLAYERS_FONTS.display,
            fontSize: title,
            lineHeight: title * 0.86,
            paddingTop: title * 0.12,
            color: PLAYERS_COLORS.white,
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
        >
          {'The\nPlayers'}
        </TotlText>
        <View style={{ marginTop: 52 * s, alignItems: 'center' }}>
          {lines.map((line) => (
            <TotlText key={line} style={body}>
              {line}
            </TotlText>
          ))}
        </View>
        {mode === 'played' ? null : (
          <View style={{ marginTop: 22 * s, flexDirection: 'row', alignItems: 'center', gap: 8 * s }}>
            <TotlText style={body}>Swipe to play</TotlText>
            <ArrowRight size={12 * s} />
          </View>
        )}
      </View>
    </PlayersPatternCard>
  );
}

/** Each new number settles in from slightly larger. */
const COUNTDOWN_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.35 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(320);

export function PlayersCountdownFace({ value }: FaceProps & { value: string }) {
  const s = useScale();
  const size = 187.5 * s;
  // Only animate a change of number. The first number is already on screen (it sits
  // under the intro card), and the swipe stack can remount this face mid-countdown.
  const mounted = React.useRef(false);
  const animate = mounted.current;
  React.useEffect(() => {
    mounted.current = true;
  }, []);
  return (
    <PlayersPatternCard variant="green">
      <Animated.View key={value} entering={animate ? COUNTDOWN_ENTER : undefined} style={styles.center}>
        <TotlText
          style={{
            fontFamily: PLAYERS_FONTS.display,
            fontSize: size,
            lineHeight: size * 0.85,
            paddingTop: size * 0.12,
            letterSpacing: -3.75 * s,
            color: PLAYERS_COLORS.white,
            textAlign: 'center',
          }}
        >
          {value}
        </TotlText>
      </Animated.View>
    </PlayersPatternCard>
  );
}

export function PlayersQuestionFace({
  card,
  secondsLeft,
  timerFraction,
}: FaceProps & { card: PlayersCard; secondsLeft: number; timerFraction: number }) {
  const s = useScale();
  const text = {
    fontFamily: PLAYERS_FONTS.body,
    fontSize: 31 * s,
    lineHeight: 37.2 * s,
    letterSpacing: 0.31 * s,
    color: PLAYERS_COLORS.ink,
    textAlign: 'center' as const,
  };
  return (
    <PlayersPatternCard variant="light">
      <View style={{ position: 'absolute', top: 20 * s, right: 20 * s }}>
        <PlayersTimerRing secondsLeft={secondsLeft} fraction={timerFraction} />
      </View>
      <View style={[styles.center, { paddingHorizontal: 24 * s, gap: 8 * s }]}>
        <TotlText style={text}>Which club did</TotlText>
        <TotlText style={[text, { color: PLAYERS_COLORS.brand }]} numberOfLines={2} adjustsFontSizeToFit>
          {card.playerName}
        </TotlText>
        <TotlText style={text}>
          play for in <TotlText style={[text, { color: PLAYERS_COLORS.brand }]}>{card.questionSeason}</TotlText> ?
        </TotlText>
      </View>
    </PlayersPatternCard>
  );
}

export function PlayersRevealFace({
  card,
  correct,
  timedOut,
}: FaceProps & { card: PlayersCard; correct: boolean; timedOut: boolean }) {
  const s = useScale();
  const badge = TEAM_BADGES[normalizeTeamCode(card.correct.clubCode)] ?? null;
  const headline = { fontFamily: PLAYERS_FONTS.body, fontSize: 31 * s, lineHeight: 37 * s, textAlign: 'center' as const };
  const detail = {
    fontFamily: PLAYERS_FONTS.body,
    fontSize: 16 * s,
    lineHeight: 19.2 * s,
    letterSpacing: 0.16 * s,
    textAlign: 'center' as const,
  };
  const crest = 166 * s;
  return (
    <PlayersPatternCard variant="light">
      <View style={[styles.center, { paddingHorizontal: 20 * s, gap: 20 * s }]}>
        <View style={{ alignItems: 'center' }}>
          <TotlText style={[headline, { color: correct ? PLAYERS_COLORS.brand : PLAYERS_COLORS.red }]}>
            {correct ? 'Correct' : timedOut ? 'Too slow' : 'Incorrect'}
          </TotlText>
          <TotlText style={[headline, { color: PLAYERS_COLORS.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {card.playerName}
          </TotlText>
        </View>
        <View style={{ width: crest, height: crest, alignItems: 'center', justifyContent: 'center' }}>
          {badge ? <Image source={badge} style={{ width: crest, height: crest }} resizeMode="contain" /> : null}
        </View>
        {/* Figma 76:14926: club · years on one line, appearances 8pt below. */}
        <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: 8 * s }}>
          <TotlText style={[detail, { color: PLAYERS_COLORS.ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {card.correct.clubName}
            {card.yearsAtClub ? ` · ${card.yearsAtClub}` : ''}
          </TotlText>
          <TotlText style={[detail, { color: PLAYERS_COLORS.muted }]}>
            {card.appearances} Premier League appearance{card.appearances === 1 ? '' : 's'}
          </TotlText>
        </View>
      </View>
    </PlayersPatternCard>
  );
}

const TOTL_MARK_PATHS = [
  'M0 667.914L729.974 170.564L772.17 235.001L234.318 601.453L517.633 1034.1L452.473 1078.5L169.158 645.849L42.1959 732.351L0 667.914Z',
  'M713.241 388.306L775.714 345.741L822.732 417.542L870.427 385.046L904.786 437.516L857.092 470.012L1007.79 700.143L945.318 742.708L794.619 512.576L732.368 554.99L698.008 502.52L760.259 460.106L713.241 388.306Z',
  'M783.713 133.949L848.874 89.5539L1132.19 522.201L1263.63 432.646L1305.83 497.083L1109.22 631.033L783.713 133.949Z',
  'M729.011 890.081C708.112 904.32 685.838 912.174 662.19 913.643C638.34 914.805 615.613 910.099 594.009 899.525C572.703 888.748 555.018 872.619 540.953 851.141C526.887 829.662 519.155 806.974 517.755 783.078C516.654 758.979 521.297 736.069 531.684 714.349C541.87 692.322 557.412 674.188 578.311 659.949C599.509 645.507 621.932 637.551 645.581 636.082C669.229 634.613 691.706 639.268 713.012 650.045C734.415 660.312 752.149 676.185 766.215 697.664C780.28 719.143 787.964 742.085 789.266 766.491C790.867 790.694 786.574 813.809 776.388 835.836C766.001 857.557 750.209 875.638 729.011 890.081ZM697.063 841.293C709.304 832.953 718.243 822.868 723.882 811.039C729.618 798.7 731.708 785.738 730.153 772.155C728.896 758.367 724.048 745.03 715.609 732.143C707.17 719.255 697.048 709.733 685.245 703.575C673.441 697.418 661.103 694.731 648.231 695.513C635.158 695.989 622.501 700.397 610.26 708.737C598.317 716.874 589.478 727.112 583.742 739.451C578.104 751.28 575.812 763.935 576.868 777.415C578.222 790.692 583.119 803.774 591.558 816.662C599.997 829.549 610.07 839.327 621.776 845.994C633.781 852.459 646.32 855.453 659.393 854.977C672.564 853.991 685.12 849.429 697.063 841.293Z',
];

function Glow({ color, size, opacity }: { color: string; size: number; opacity: number }) {
  return (
    <Svg width={size} height={size} style={{ position: 'absolute' }} pointerEvents="none">
      <Defs>
        <RadialGradient id="g" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={size} height={size} fill="url(#g)" />
    </Svg>
  );
}

/** Short gold dashes either side of the score on a new personal best. */
function Rays({ width, height }: { width: number; height: number }) {
  const cx = width / 2;
  const cy = height / 2;
  const inner = width * 0.36;
  const len = width * 0.11;
  const rays = [0, 28, -28, 180, 152, 208];
  return (
    <Svg width={width} height={height} style={{ position: 'absolute' }} pointerEvents="none">
      {rays.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const r1 = deg % 180 === 0 ? inner : inner * 0.92;
        return (
          <Line
            key={deg}
            x1={cx + Math.cos(rad) * r1}
            y1={cy + Math.sin(rad) * r1 * 0.55}
            x2={cx + Math.cos(rad) * (r1 + len)}
            y2={cy + Math.sin(rad) * (r1 + len) * 0.55}
            stroke={PLAYERS_COLORS.goldEnd}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

export function PlayersFinishedFace({
  score,
  total,
  personalBest,
  practice,
}: FaceProps & { score: number; total: number; personalBest: boolean; practice: boolean }) {
  const s = useScale();
  const [lead, rest] = playersFinishedMessage({ score, total, personalBest, practice });
  const hero = 194 * s;
  const msg = {
    fontFamily: PLAYERS_FONTS.body,
    fontSize: 14 * s,
    lineHeight: 19.6 * s,
    color: PLAYERS_COLORS.muted,
    textAlign: 'center' as const,
  };
  return (
    <PlayersPatternCard variant="light">
      <View style={[styles.center, { paddingHorizontal: 20 * s }]}>
        <View style={{ height: hero + 40 * s, alignItems: 'center', justifyContent: 'center' }}>
          {personalBest ? (
            <>
              <Glow color={PLAYERS_COLORS.goldEnd} size={340 * s} opacity={0.55} />
              <TotlText
                style={{ fontSize: 150 * s, lineHeight: 172 * s, textAlign: 'center' }}
                accessibilityLabel="Trophy"
              >
                🏆
              </TotlText>
            </>
          ) : (
            <>
              <Glow color={PLAYERS_COLORS.brand} size={300 * s} opacity={0.16} />
              <Svg width={hero} height={hero * (1165 / 1306)} viewBox="0 0 1306 1165" accessibilityLabel="TotL">
                {TOTL_MARK_PATHS.map((d) => (
                  <Path key={d.slice(0, 12)} d={d} fill={PLAYERS_COLORS.brand} />
                ))}
              </Svg>
            </>
          )}
        </View>
        <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 12 * s }}>
          {personalBest ? <Rays width={300 * s} height={110 * s} /> : null}
          <TotlText
            style={{
              fontFamily: PLAYERS_FONTS.body,
              fontSize: 52 * s,
              lineHeight: 62 * s,
              letterSpacing: 0.52 * s,
              color: PLAYERS_COLORS.ink,
            }}
          >
            {score}/{total}
          </TotlText>
          <TotlText style={[msg, { fontFamily: PLAYERS_FONTS.medium, marginTop: 4 * s }]}>{lead}</TotlText>
          <TotlText style={msg}>{rest}</TotlText>
        </View>
      </View>
    </PlayersPatternCard>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
