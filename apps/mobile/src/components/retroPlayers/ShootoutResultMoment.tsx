import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfettiCannon from 'react-native-confetti-cannon';
import { StatusBar } from 'expo-status-bar';
import { TotlText } from '@totl/ui';
import type { PlayersShootout, PlayersShootoutGame } from '@totl/api-client';

import { shootoutGameLabel, shootoutSides, type ShootoutHeadToHead } from '../../lib/retroPlayers/shootout';
import { CARD_FLIP_MS } from '../predictions/FlippableSwipePredictionCard';
import { ShootoutAvatar, ShootoutScoreHeader } from './PlayersShootoutBits';
import { ShootoutRoundRow } from './ShootoutRoundRow';
import { PlayersButton, PlayersTextLink } from './PlayersControls';
import PlayersPatternCard from './PlayersPatternCard';
import { PLAYERS_COLORS, PLAYERS_FONTS } from './playersTheme';
import { useShootoutCardLayout } from './ShootoutCardScreen';

/**
 * The moment a round (or the whole Shootout) is decided: who won, the score,
 * and the card that settled it with both picks. Confetti when it's you.
 * At full time it stays as the finished Shootout's screen, with Rematch.
 */
export default function ShootoutResultMoment({
  challenge,
  game,
  final,
  onDone,
  onPlayNext,
  onRematch,
  onBackToList,
  busy = false,
  celebrate = true,
  headToHead = null,
}: {
  challenge: PlayersShootout;
  game: PlayersShootoutGame | null;
  final: boolean;
  /** Between rounds: back to the score (Continue). */
  onDone: () => void;
  /** Between rounds, when you start the next one: its countdown, straight from here. */
  onPlayNext?: () => void;
  /** Full time: a new Shootout against the same player. */
  onRematch?: () => void;
  /** Full time: back to the list of Shootouts. */
  onBackToList?: () => void;
  busy?: boolean;
  /** Confetti for a win; off when the result has been seen before. */
  celebrate?: boolean;
  /** Full time: your all-time Shootout record against this player, shown on the card's back. */
  headToHead?: ShootoutHeadToHead | null;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const them = challenge.them.name;
  const sides = shootoutSides(challenge);
  const won = final ? challenge.result === 'won' : game?.result === 'me';
  const lost = final ? challenge.result === 'lost' : game?.result === 'them';
  const forfeit = final && (challenge.endReason === 'forfeit' || challenge.endReason === 'left');
  const afterSuddenDeath = final && challenge.games.some((g) => g.suddenDeath);

  // Short enough to sit big on the card: the header above says which game, or full time.
  // "You win!" is kept for winning the Shootout; a round says which round.
  const roundName = game?.suddenDeath ? 'sudden death' : `round ${game?.number ?? 1}`;
  const headline = final
    ? won
      ? 'You win!'
      : `${them} wins`
    : won
      ? `You win ${roundName}`
      : lost
        ? `${them} wins ${roundName}`
        : `${game?.suddenDeath ? 'Sudden death' : `Round ${game?.number ?? 1}`} drawn`;
  const sub = forfeit
    ? challenge.endReason === 'left'
      ? won
        ? `${them} left the Shootout.`
        : 'You left the Shootout.'
      : won
        ? `${them} didn't play in time.`
        : "You didn't play in time."
    : afterSuddenDeath
      ? 'Settled in sudden death.'
      : !final && !won && !lost
        ? 'You both missed.'
        : null;

  // What happens next, on the button.
  const nextGame = challenge.games.find((g) => g.result == null);
  // Between rounds: start the next one straight from here when it's yours to start.
  const startsNext =
    !final &&
    !!nextGame &&
    nextGame.rounds.length === 0 &&
    nextGame.number === (game?.number ?? 0) + 1 &&
    challenge.nextAction === 'play';
  const button = final
    ? 'Rematch'
    : startsNext
      ? nextGame?.suddenDeath
        ? 'Play sudden death'
        : `Play Round ${nextGame?.number}`
      : 'Continue';

  const deciding = game?.rounds[game.rounds.length - 1] ?? null;

  const { HEADER_H, GAP, SLOT_H, cardW, cardH, s } = useShootoutCardLayout();

  // Full time flips to the head-to-head, as the prediction cards flip to their stats:
  // one show of the back after a pause, then tap to flip.
  const flippable = final && !!headToHead && headToHead.played > 0;
  const [flipped, setFlipped] = React.useState(false);
  const progress = useSharedValue(0);
  React.useEffect(() => {
    progress.value = withTiming(flipped ? 1 : 0, { duration: CARD_FLIP_MS, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [flipped, progress]);
  React.useEffect(() => {
    if (!flippable) return;
    const toStats = setTimeout(() => setFlipped(true), INTRO_PAUSE_MS);
    const back = setTimeout(() => setFlipped(false), INTRO_PAUSE_MS + CARD_FLIP_MS + INTRO_HOLD_MS);
    return () => {
      clearTimeout(toStats);
      clearTimeout(back);
    };
  }, [flippable]);
  const shellStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ perspective: 1400 }, { scale: interpolate(progress.value, [0, 0.5, 1], [1, FLIP_PEAK_SCALE, 1]) }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden' as const,
    transform: [{ rotateY: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: 'hidden' as const,
    transform: [{ rotateY: `${interpolate(progress.value, [0, 1], [180, 360])}deg` }],
  }));

  const h2h = headToHead;
  const h2hHome = h2h ? (sides.homeIsMe ? h2h.me : h2h.them) : 0;
  const h2hAway = h2h ? (sides.homeIsMe ? h2h.them : h2h.me) : 0;
  // Smaller as the record grows, so even "123–98" fits between the photos.
  const h2hChars = `${h2hHome}–${h2hAway}`.length;
  const h2hScoreSize = h2hChars <= 3 ? 86 : Math.round((86 * 3.2) / h2hChars);
  const streak = (() => {
    if (!h2h || h2h.played === 0) return null;
    if (h2h.played === 1) return `Your first Shootout against ${them}.`;
    const first = h2h.form[0];
    let n = 0;
    while (n < h2h.form.length && h2h.form[n] === first) n++;
    if (n < 2) return null;
    return first === 'W' ? `You've won the last ${n}.` : `${them} has won the last ${n}.`;
  })();

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      style={[StyleSheet.absoluteFill, styles.backdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <StatusBar style="light" />
      {/* Same header as the playing screen. */}
      <View style={{ height: HEADER_H, alignItems: 'center', paddingTop: 17 }}>
        {/* At full time the score is on the card, so not up here too. */}
        {final ? <TotlText style={styles.headerLine}>Best of three</TotlText> : <ShootoutScoreHeader challenge={challenge} />}
        <TotlText style={styles.headerLabel}>{final ? 'Full time' : shootoutGameLabel(game)}</TotlText>
      </View>

      <View style={{ alignItems: 'center' }}>
        {/* Delayed: an undelayed entering animation nested in the backdrop's can stay invisible. */}
        <Animated.View entering={FadeIn.duration(300).delay(120)} style={{ width: cardW, height: cardH }}>
          <Pressable
            accessibilityRole={flippable ? 'button' : undefined}
            accessibilityLabel={flippable ? (flipped ? 'Flip back' : 'See overall head to head') : undefined}
            disabled={!flippable}
            onPress={() => setFlipped((f) => !f)}
            style={{ flex: 1 }}
          >
            <Animated.View style={shellStyle}>
              <Animated.View style={frontStyle} pointerEvents="none">
              <PlayersPatternCard variant="green">
                <View style={{ flex: 1, paddingHorizontal: 22 * s, paddingVertical: 28 * s, justifyContent: 'space-between' }}>
                  <View style={{ alignItems: 'center' }}>
                    <TotlText
                      style={[
                        styles.headline,
                        { fontSize: 76 * s, lineHeight: 72 * s, paddingTop: 10 * s },
                        won && { color: PLAYERS_COLORS.goldEnd },
                      ]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
                    >
                      {headline}
                    </TotlText>
                    {/* Always the final score, forfeits included. */}
                    <TotlText style={[styles.score, { fontSize: 112 * s, lineHeight: 108 * s, paddingTop: 12 * s }]}>
                      {sides.homeScore}–{sides.awayScore}
                    </TotlText>
                    {sub ? <TotlText style={[styles.sub, { fontSize: 16 * s, lineHeight: 22 * s }]}>{sub}</TotlText> : null}
                  </View>

                  {deciding && deciding.card ? (
                    <View style={[styles.decider, { padding: 14 * s, gap: 8 * s }]}>
                      <TotlText style={styles.deciderLabel}>{final ? 'The last card' : 'The deciding card'}</TotlText>
                      <ShootoutRoundRow round={deciding} themName={them} meFirst={sides.homeIsMe} light />
                    </View>
                  ) : null}
                </View>
              </PlayersPatternCard>
              </Animated.View>
              {flippable && h2h ? (
                <Animated.View style={backStyle} pointerEvents="none">
                  <PlayersPatternCard variant="green">
                    {/* Laid out like the front: the score at the top, the record in a panel below. */}
                    <View style={[styles.h2hBody, { paddingHorizontal: 14 * s, paddingVertical: 28 * s }]}>
                      <TotlText style={[styles.h2hKicker, { fontSize: 30 * s, lineHeight: 32 * s, paddingTop: 4 * s }]}>Overall head to head</TotlText>
                      {/* The score in the middle of the card, between the title and the panel. */}
                      <View style={{ flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: 18 * s }}>
                        <View style={styles.h2hRow}>
                          <View style={[styles.h2hSide, { width: 74 * s }]}>
                            <ShootoutAvatar person={sides.home} size={56 * s} />
                            <TotlText style={[styles.h2hName, { fontSize: 16 * s }]} numberOfLines={1}>
                              {sides.homeIsMe ? 'You' : sides.home.name}
                            </TotlText>
                          </View>
                          <TotlText
                            style={[
                              styles.score,
                              styles.h2hScore,
                              { fontSize: h2hScoreSize * s, lineHeight: h2hScoreSize * 0.95 * s, paddingTop: h2hScoreSize * 0.12 * s },
                            ]}
                            numberOfLines={1}
                          >
                            {h2hHome}–{h2hAway}
                          </TotlText>
                          <View style={[styles.h2hSide, { width: 74 * s }]}>
                            <ShootoutAvatar person={sides.away} size={56 * s} />
                            <TotlText style={[styles.h2hName, { fontSize: 16 * s }]} numberOfLines={1}>
                              {sides.homeIsMe ? sides.away.name : 'You'}
                            </TotlText>
                          </View>
                        </View>
                        <TotlText style={[styles.sub, { fontSize: 16 * s, lineHeight: 22 * s, marginTop: 0 }]}>
                          {h2h.played} Shootout{h2h.played === 1 ? '' : 's'} played
                        </TotlText>
                      </View>

                      <View style={[styles.decider, { padding: 14 * s, gap: 10 * s, alignSelf: 'stretch', alignItems: 'center' }]}>
                        <TotlText style={styles.deciderLabel}>Your last 5</TotlText>
                        {/* The mini league form colours: green win, red loss, grey not played yet. */}
                        <View style={{ flexDirection: 'row', gap: 8 * s }}>
                          {Array.from({ length: 5 }, (_, i) => h2h.form[i] ?? null).map((r, i) => (
                            <View
                              key={i}
                              style={[
                                styles.formPill,
                                { width: 32 * s, height: 32 * s },
                                r === 'W' ? styles.formWin : r === 'L' ? styles.formLoss : styles.formEmpty,
                              ]}
                            >
                              <TotlText
                                style={[
                                  styles.formText,
                                  { fontSize: 15 * s },
                                  { color: r === 'W' ? FORM_WIN : r === 'L' ? FORM_LOSS : PLAYERS_COLORS.whiteSoft },
                                ]}
                              >
                                {r ?? '–'}
                              </TotlText>
                            </View>
                          ))}
                        </View>
                        {streak ? <TotlText style={[styles.streak, { fontSize: 15 * s, lineHeight: 20 * s }]}>{streak}</TotlText> : null}
                      </View>
                    </View>
                  </PlayersPatternCard>
                </Animated.View>
              ) : null}
            </Animated.View>
          </Pressable>
          {flippable ? (
            // As the prediction cards: the hint between the card and the button.
            <TotlText style={[styles.hint, { top: cardH + 10 }]}>Tap card to {flipped ? 'flip back' : 'see head to head'}</TotlText>
          ) : null}
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.duration(250).delay(500)} style={{ marginTop: GAP, width: cardW, alignSelf: 'center' }}>
        <PlayersButton
          label={button}
          arrow
          tone={won ? 'gold' : 'green'}
          glow={won}
          busy={busy}
          height={SLOT_H}
          onPress={final && onRematch ? onRematch : startsNext && onPlayNext ? onPlayNext : onDone}
        />
        {final ? (
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <PlayersTextLink label="Back to Shootouts" color={PLAYERS_COLORS.white} onPress={onBackToList ?? onDone} />
          </View>
        ) : null}
      </Animated.View>

      {won && celebrate ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <ConfettiCannon
            count={final ? 220 : 120}
            origin={{ x: screenW / 2, y: -10 }}
            explosionSpeed={380}
            fallSpeed={2800}
            fadeOut
            autoStart
          />
        </View>
      ) : null}
    </Animated.View>
  );
}

/** As the prediction cards' opening flip: a pause, the back held long enough to read, then back. */
const INTRO_PAUSE_MS = 1200;
const INTRO_HOLD_MS = 2000;
/** Form pills, as the mini league table (LeagueFormDisplay). */
const FORM_WIN = '#22C55E';
const FORM_LOSS = '#EF4444';

/** Mid-flip pop, smaller than the prediction cards' (this card is already full size). */
const FLIP_PEAK_SCALE = 1.12;

const styles = StyleSheet.create({
  backdrop: { backgroundColor: PLAYERS_COLORS.navy, zIndex: 30 },
  headerLine: { fontFamily: PLAYERS_FONTS.medium, fontSize: 24, lineHeight: 30, color: PLAYERS_COLORS.white },
  headerLabel: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 30,
    lineHeight: 32,
    paddingTop: 4,
    marginTop: 6,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: PLAYERS_COLORS.whiteSoft,
  },
  headline: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 64,
    lineHeight: 60,
    paddingTop: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
    color: PLAYERS_COLORS.white,
  },
  score: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 88,
    lineHeight: 86,
    paddingTop: 10,
    color: PLAYERS_COLORS.white,
  },
  sub: {
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 16,
    lineHeight: 22,
    color: PLAYERS_COLORS.whiteSoft,
    textAlign: 'center',
    marginTop: 6,
  },
  h2hBody: { flex: 1, alignItems: 'center' },
  h2hScore: { flex: 1, textAlign: 'center' },
  formWin: { backgroundColor: 'rgba(34,197,94,0.18)', borderColor: 'rgba(34,197,94,0.35)' },
  formLoss: { backgroundColor: 'rgba(239,68,68,0.18)', borderColor: 'rgba(239,68,68,0.35)' },
  formEmpty: { backgroundColor: 'rgba(148,163,184,0.22)', borderColor: 'rgba(148,163,184,0.20)' },
  streak: { fontFamily: PLAYERS_FONTS.medium, color: PLAYERS_COLORS.white, textAlign: 'center' },
  h2hKicker: {
    fontFamily: PLAYERS_FONTS.display,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: PLAYERS_COLORS.goldEnd,
    textAlign: 'center',
  },
  h2hRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  h2hSide: { alignItems: 'center', gap: 6 },
  h2hName: { fontFamily: PLAYERS_FONTS.medium, color: PLAYERS_COLORS.white },
  formPill: { alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: 1 },
  // Gramatika, as the mini league table's pills: easier to read than Tourney at this size.
  formText: { fontFamily: PLAYERS_FONTS.medium, color: PLAYERS_COLORS.white },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: PLAYERS_FONTS.medium,
    fontSize: 14,
    color: PLAYERS_COLORS.whiteSoft,
  },
  decider: {
    borderRadius: 12,
    backgroundColor: PLAYERS_COLORS.shade,
    padding: 14,
    gap: 8,
  },
  deciderLabel: {
    fontFamily: PLAYERS_FONTS.display,
    fontSize: 16,
    lineHeight: 18,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: PLAYERS_COLORS.whiteSoft,
  },
});
