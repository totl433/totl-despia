import React from 'react';
import { Animated, Image, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';
import HeaderGoalMatrix from './HeaderGoalMatrix';
import type { HeaderTickerEvent } from '../lib/headerLiveScore';

type Phase = 'score' | 'goal' | 'ticker';

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

export default function HeaderLiveScore({
  scoreLabel,
  fill = false,
  tickerEvent,
  tickerEventKey,
  tickerIntervalMs = 10_000,
  live = true,
  previewTickerLoop = false,
}: {
  scoreLabel: string;
  fill?: boolean;
  tickerEvent?: HeaderTickerEvent;
  tickerEventKey?: string | null;
  tickerIntervalMs?: number;
  live?: boolean;
  previewTickerLoop?: boolean;
}) {
  const t = useTokens();
  const liveDotOpacity = React.useRef(new Animated.Value(1)).current;
  const tickerTranslateX = React.useRef(new Animated.Value(0)).current;
  const flashOpacity = React.useRef(new Animated.Value(0)).current;
  const scoreScale = React.useRef(new Animated.Value(1)).current;
  const pillScale = React.useRef(new Animated.Value(1)).current;
  const goalOpacity = React.useRef(new Animated.Value(0)).current;
  const goalOverlayScale = React.useRef(new Animated.Value(0.96)).current;
  const contentOpacity = React.useRef(new Animated.Value(1)).current;
  const [phase, setPhase] = React.useState<Phase>('score');
  const [pillWidth, setPillWidth] = React.useState(0);
  const [tickerWidth, setTickerWidth] = React.useState(0);
  const isLightMode = React.useMemo(() => isLightSurface(t.color.background), [t.color.background]);
  const pillBackground = isLightMode ? 'rgba(15,23,42,0.045)' : 'rgba(255,255,255,0.05)';
  const pillBorder = isLightMode ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.08)';
  const primaryText = isLightMode ? '#0F172A' : '#FFFFFF';
  const secondaryText = isLightMode ? '#475569' : '#A5B4CF';
  const flashFill = isLightMode ? '#0F172A' : '#FFFFFF';
  const lastPlayedEventKeyRef = React.useRef<string | null>(null);
  const initialTickerEventKeyRef = React.useRef<string | null | undefined>(tickerEventKey);
  const parsedScore = React.useMemo(() => {
    const match = scoreLabel.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!match) return null;
    return { current: Number(match[1]), total: Number(match[2]) };
  }, [scoreLabel]);
  const [displayCurrent, setDisplayCurrent] = React.useState<number | null>(parsedScore?.current ?? null);

  React.useEffect(() => {
    setDisplayCurrent(parsedScore?.current ?? null);
  }, [parsedScore?.current]);

  React.useEffect(() => {
    if (!live) {
      liveDotOpacity.stopAnimation();
      liveDotOpacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(liveDotOpacity, { toValue: 0.22, duration: 420, useNativeDriver: true }),
        Animated.timing(liveDotOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [live, liveDotOpacity]);

  React.useEffect(() => {
    if (phase !== 'goal') {
      pillScale.stopAnimation();
      pillScale.setValue(1);
      return;
    }
    const grow = Animated.sequence([
      Animated.spring(pillScale, {
        toValue: 1.08,
        useNativeDriver: true,
        damping: 9,
        stiffness: 180,
        mass: 0.7,
      }),
      Animated.spring(pillScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 10,
        stiffness: 170,
        mass: 0.8,
      }),
    ]);
    grow.start();
    return () => grow.stop();
  }, [phase, pillScale]);

  React.useEffect(() => {
    if (phase === 'goal') {
      Animated.parallel([
        Animated.timing(goalOpacity, { toValue: 1, duration: 170, useNativeDriver: true }),
        Animated.timing(contentOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.spring(goalOverlayScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 10,
          stiffness: 180,
          mass: 0.8,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(goalOpacity, { toValue: 0, duration: 240, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(goalOverlayScale, { toValue: 0.98, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [contentOpacity, goalOpacity, goalOverlayScale, phase]);

  React.useEffect(() => {
    if (!live) {
      setPhase('score');
      return;
    }
    if (!tickerEvent || !previewTickerLoop) return;
    if (!pillWidth) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const effectiveTickerWidth = tickerWidth || Math.max(pillWidth * 1.1, 220);
    const GOAL_HOLD_MS = 1100;
    const TICKER_SCROLL_MS = 7600;

    const flashScore = () => {
      flashOpacity.setValue(0);
      scoreScale.setValue(0.96);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flashOpacity, { toValue: 0.32, duration: 160, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 0, duration: 340, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scoreScale, { toValue: 1.05, duration: 160, useNativeDriver: true }),
          Animated.spring(scoreScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 180 }),
        ]),
      ]).start();
    };

    const runCycle = () => {
      if (cancelled) return;

      timer = setTimeout(() => {
        if (cancelled) return;
        setPhase('goal');

        timer = setTimeout(() => {
          if (cancelled) return;
          setPhase('ticker');
          tickerTranslateX.setValue(pillWidth);
          Animated.timing(tickerTranslateX, {
            toValue: -effectiveTickerWidth - 20,
            duration: TICKER_SCROLL_MS,
            useNativeDriver: true,
          }).start(() => {
            if (cancelled) return;
            setPhase('score');
            setDisplayCurrent((current) => {
              if (typeof current !== 'number') return current;
              if (!parsedScore?.total) return current;
              return current >= parsedScore.total ? parsedScore.current ?? current : current + 1;
            });
            flashScore();
            runCycle();
          });
        }, GOAL_HOLD_MS);
      }, tickerIntervalMs);
    };

    runCycle();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      tickerTranslateX.stopAnimation();
      flashOpacity.stopAnimation();
      scoreScale.stopAnimation();
    };
  }, [
    flashOpacity,
    parsedScore?.current,
    parsedScore?.total,
    pillWidth,
    scoreScale,
    tickerEvent,
    tickerIntervalMs,
    tickerTranslateX,
    tickerWidth,
    live,
    previewTickerLoop,
  ]);

  React.useEffect(() => {
    if (!live || previewTickerLoop) return;
    if (!tickerEvent || !tickerEventKey) return;
    if (!pillWidth) return;
    if (initialTickerEventKeyRef.current === tickerEventKey && lastPlayedEventKeyRef.current === null) {
      lastPlayedEventKeyRef.current = tickerEventKey;
      initialTickerEventKeyRef.current = undefined;
      return;
    }
    if (lastPlayedEventKeyRef.current === tickerEventKey) return;

    lastPlayedEventKeyRef.current = tickerEventKey;

    let cancelled = false;
    const GOAL_HOLD_MS = 1100;
    const TICKER_SCROLL_MS = 7600;
    const effectiveTickerWidth = tickerWidth || Math.max(pillWidth * 1.1, 220);
    let handoffTimer: ReturnType<typeof setTimeout> | null = null;

    flashOpacity.setValue(0);
    scoreScale.setValue(1);
    setPhase('goal');

    handoffTimer = setTimeout(() => {
      if (cancelled) return;
      setPhase('ticker');
      tickerTranslateX.setValue(pillWidth);
      Animated.timing(tickerTranslateX, {
        toValue: -effectiveTickerWidth - 20,
        duration: TICKER_SCROLL_MS,
        useNativeDriver: true,
      }).start(() => {
        if (cancelled) return;
        setPhase('score');
        flashOpacity.setValue(0);
        scoreScale.setValue(0.96);
        Animated.parallel([
          Animated.sequence([
            Animated.timing(flashOpacity, { toValue: 0.32, duration: 160, useNativeDriver: true }),
            Animated.timing(flashOpacity, { toValue: 0, duration: 340, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(scoreScale, { toValue: 1.05, duration: 160, useNativeDriver: true }),
            Animated.spring(scoreScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 180 }),
          ]),
        ]).start();
      });
    }, GOAL_HOLD_MS);

    return () => {
      cancelled = true;
      if (handoffTimer) clearTimeout(handoffTimer);
      tickerTranslateX.stopAnimation();
      flashOpacity.stopAnimation();
      scoreScale.stopAnimation();
    };
  }, [
    flashOpacity,
    live,
    pillWidth,
    previewTickerLoop,
    scoreScale,
    tickerEvent,
    tickerEventKey,
    tickerTranslateX,
    tickerWidth,
  ]);

  const scoreText = parsedScore ? `${displayCurrent ?? parsedScore.current}/${parsedScore.total}` : scoreLabel;

  return (
    <View
      onLayout={(event) => setPillWidth(event.nativeEvent.layout.width)}
      style={{
        minHeight: 38,
        width: fill ? '100%' : undefined,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: pillBackground,
        borderWidth: 1,
        borderColor: pillBorder,
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: flashFill,
          opacity: flashOpacity,
        }}
      />

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          opacity: goalOpacity,
          transform: [{ scaleX: pillScale }, { scaleY: pillScale }, { scale: goalOverlayScale }],
        }}
      >
        <HeaderGoalMatrix />
      </Animated.View>

      <Animated.View style={{ opacity: contentOpacity }}>
        {phase === 'ticker' && tickerEvent ? (
          <View style={{ height: 22, justifyContent: 'center' }}>
            <Animated.View
              onLayout={(event) => setTickerWidth(event.nativeEvent.layout.width)}
              style={{
                position: 'absolute',
                left: 0,
                flexDirection: 'row',
                alignItems: 'center',
                transform: [{ translateX: tickerTranslateX }],
              }}
            >
              <Animated.View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginRight: 4,
                }}
              >
                <Image source={tickerEvent.homeBadge} style={{ width: 22, height: 22, marginRight: 5 }} />
                <TotlText
                  style={{
                    color: primaryText,
                    fontFamily: tickerEvent.scoringSide === 'home' ? 'Gramatika-Bold' : 'Gramatika-Medium',
                    fontWeight: tickerEvent.scoringSide === 'home' ? '900' : '700',
                    fontSize: 12,
                    lineHeight: 13,
                    letterSpacing: 0.7,
                    marginRight: 5,
                  }}
                >
                  {tickerEvent.homeCode}
                </TotlText>
                <TotlText
                  style={{
                    color: primaryText,
                    fontFamily: tickerEvent.scoringSide === 'home' ? 'Gramatika-Bold' : 'Gramatika-Medium',
                    fontWeight: tickerEvent.scoringSide === 'home' ? '900' : '700',
                    fontSize: tickerEvent.scoringSide === 'home' ? 14 : 13,
                    lineHeight: tickerEvent.scoringSide === 'home' ? 15 : 14,
                  }}
                >
                  {tickerEvent.homeScore}
                </TotlText>
              </Animated.View>
              <TotlText
                style={{
                  color: primaryText,
                  fontFamily: 'Gramatika-Medium',
                  fontWeight: '700',
                  fontSize: 13,
                  lineHeight: 14,
                  marginRight: 4,
                }}
              >
                -
              </TotlText>
              <Animated.View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginRight: 10,
                }}
              >
                <TotlText
                  style={{
                    color: primaryText,
                    fontFamily: tickerEvent.scoringSide === 'away' ? 'Gramatika-Bold' : 'Gramatika-Medium',
                    fontWeight: tickerEvent.scoringSide === 'away' ? '900' : '700',
                    fontSize: tickerEvent.scoringSide === 'away' ? 14 : 13,
                    lineHeight: tickerEvent.scoringSide === 'away' ? 15 : 14,
                    marginRight: 5,
                  }}
                >
                  {tickerEvent.awayScore}
                </TotlText>
                <Image source={tickerEvent.awayBadge} style={{ width: 22, height: 22, marginRight: 5 }} />
                <TotlText
                  style={{
                    color: primaryText,
                    fontFamily: tickerEvent.scoringSide === 'away' ? 'Gramatika-Bold' : 'Gramatika-Medium',
                    fontWeight: tickerEvent.scoringSide === 'away' ? '900' : '700',
                    fontSize: 12,
                    lineHeight: 13,
                    letterSpacing: 0.7,
                  }}
                >
                  {tickerEvent.awayCode}
                </TotlText>
              </Animated.View>
              <TotlText
                style={{
                  color: primaryText,
                  fontWeight: '800',
                  fontSize: 13,
                  lineHeight: 14,
                  marginRight: 4,
                }}
              >
                {tickerEvent.scorerName}
              </TotlText>
              <TotlText
                style={{
                  color: secondaryText,
                  fontWeight: '700',
                  fontSize: 13,
                  lineHeight: 14,
                }}
              >
                {tickerEvent.minuteLabel}
              </TotlText>
            </Animated.View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: '#EF4444',
                marginRight: 8,
                opacity: liveDotOpacity,
              display: live ? 'flex' : 'none',
              }}
            />
            <TotlText
              style={{
                color: live ? '#EF4444' : primaryText,
                fontWeight: '900',
                fontSize: 13,
                lineHeight: 14,
                letterSpacing: 0.5,
                marginRight: live ? 8 : 6,
              }}
            >
              {live ? 'LIVE' : 'SCORE'}
            </TotlText>
            <Animated.View style={{ transform: [{ scale: scoreScale }] }}>
              <TotlText
                style={{
                  color: primaryText,
                  fontWeight: '900',
                  fontSize: 14,
                  lineHeight: 16,
                  letterSpacing: 0.2,
                }}
              >
                {scoreText}
              </TotlText>
            </Animated.View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}
