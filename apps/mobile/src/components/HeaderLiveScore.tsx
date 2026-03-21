import React from 'react';
import { Animated, Easing, Image, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TotlText, useTokens } from '@totl/ui';
import HeaderGoalMatrix from './HeaderGoalMatrix';
import type { HeaderExpandedStat, HeaderTickerEvent } from '../lib/headerLiveScore';

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
  expandedStats,
}: {
  scoreLabel: string;
  fill?: boolean;
  tickerEvent?: HeaderTickerEvent;
  tickerEventKey?: string | null;
  tickerIntervalMs?: number;
  live?: boolean;
  previewTickerLoop?: boolean;
  expandedStats?: HeaderExpandedStat[];
}) {
  const t = useTokens();
  const liveDotOpacity = React.useRef(new Animated.Value(1)).current;
  const tickerTranslateX = React.useRef(new Animated.Value(0)).current;
  const flashOpacity = React.useRef(new Animated.Value(0)).current;
  const scoreScale = React.useRef(new Animated.Value(1)).current;
  const pillScale = React.useRef(new Animated.Value(1)).current;
  const goalOpacity = React.useRef(new Animated.Value(0)).current;
  const goalOverlayScale = React.useRef(new Animated.Value(0.985)).current;
  const contentOpacity = React.useRef(new Animated.Value(1)).current;
  const expandProgress = React.useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = React.useState<Phase>('score');
  const [expanded, setExpanded] = React.useState(false);
  const [pillWidth, setPillWidth] = React.useState(0);
  const [tickerWidth, setTickerWidth] = React.useState(0);
  const [activeTickerEvent, setActiveTickerEvent] = React.useState<HeaderTickerEvent | null>(tickerEvent ?? null);
  const isLightMode = React.useMemo(() => isLightSurface(t.color.background), [t.color.background]);
  const pillBackground = isLightMode ? 'rgba(15,23,42,0.045)' : 'rgba(255,255,255,0.05)';
  const pillBorder = isLightMode ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.08)';
  const primaryText = isLightMode ? '#0F172A' : '#FFFFFF';
  const secondaryText = isLightMode ? '#475569' : '#A5B4CF';
  const flashFill = isLightMode ? '#0F172A' : '#FFFFFF';
  const lastPlayedEventKeyRef = React.useRef<string | null>(null);
  const initialTickerEventKeyRef = React.useRef<string | null | undefined>(tickerEventKey);
  const renderedTickerEvent = activeTickerEvent ?? tickerEvent ?? null;
  const tickerReady = !!renderedTickerEvent && tickerWidth > 0;
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
      Animated.timing(pillScale, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    const grow = Animated.timing(pillScale, {
      toValue: 1.035,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    grow.start();
    return () => grow.stop();
  }, [phase, pillScale]);

  React.useEffect(() => {
    if (phase === 'goal') {
      Animated.parallel([
        Animated.timing(goalOpacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(goalOverlayScale, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(goalOpacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(goalOverlayScale, {
        toValue: 0.985,
        duration: 240,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, goalOpacity, goalOverlayScale, phase]);

  React.useEffect(() => {
    if (!live) {
      setPhase('score');
      return;
    }
    if (!renderedTickerEvent || !previewTickerLoop) return;
    if (!pillWidth || !tickerReady) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const effectiveTickerWidth = tickerWidth;
    const tickerEntryOffset = Math.max(10, Math.min(28, pillWidth * 0.12));
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
        setActiveTickerEvent(renderedTickerEvent);
        setPhase('goal');

        timer = setTimeout(() => {
          if (cancelled) return;
          setPhase('ticker');
          tickerTranslateX.setValue(tickerEntryOffset);
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
    tickerReady,
    live,
    previewTickerLoop,
    renderedTickerEvent,
  ]);

  React.useEffect(() => {
    if (!live || previewTickerLoop) return;
    if (!tickerEvent || !tickerEventKey) return;
    if (!pillWidth || !tickerReady) return;
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
    const effectiveTickerWidth = tickerWidth;
    const tickerEntryOffset = Math.max(10, Math.min(28, pillWidth * 0.12));
    let handoffTimer: ReturnType<typeof setTimeout> | null = null;

    flashOpacity.setValue(0);
    scoreScale.setValue(1);
    setActiveTickerEvent(tickerEvent);
    setPhase('goal');

    handoffTimer = setTimeout(() => {
      if (cancelled) return;
      setPhase('ticker');
      tickerTranslateX.setValue(tickerEntryOffset);
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
      setPhase('score');
    };
  }, [
    flashOpacity,
    live,
    pillWidth,
    previewTickerLoop,
    scoreScale,
    tickerEventKey,
    tickerTranslateX,
    tickerWidth,
    tickerReady,
  ]);

  const scoreText = parsedScore ? `${displayCurrent ?? parsedScore.current}/${parsedScore.total}` : scoreLabel;
  const interactiveStats = expandedStats?.filter((stat) => !!stat.value) ?? [];
  const hasExpandedStats = interactiveStats.length > 0;
  const expandedHeight = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [38, 68],
  });
  const expandedRowOpacity = expandProgress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 1],
  });
  const expandedRowHeight = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 24],
  });
  const expandedRowTranslateY = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-2, 0],
  });
  const scoreRowMarginBottom = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 6],
  });

  React.useEffect(() => {
    if (!hasExpandedStats && expanded) {
      setExpanded(false);
    }
  }, [expanded, hasExpandedStats]);

  React.useEffect(() => {
    Animated.timing(expandProgress, {
      toValue: expanded && hasExpandedStats ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [expandProgress, expanded, hasExpandedStats]);

  const handlePress = React.useCallback(() => {
    if (!hasExpandedStats) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setExpanded((prev) => !prev);
  }, [hasExpandedStats]);

  const tickerRow = renderedTickerEvent ? (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {renderedTickerEvent.homeBadge ? <Image source={renderedTickerEvent.homeBadge} style={{ width: 22, height: 22, marginRight: 5 }} /> : null}
      <TotlText
        style={{
          color: primaryText,
          fontFamily: renderedTickerEvent.scoringSide === 'home' ? 'Gramatika-Bold' : 'Gramatika-Medium',
          fontWeight: renderedTickerEvent.scoringSide === 'home' ? '900' : '700',
          fontSize: 12,
          lineHeight: 13,
          letterSpacing: 0.7,
          marginRight: 5,
        }}
      >
        {renderedTickerEvent.homeCode}
      </TotlText>
      <TotlText
        style={{
          color: primaryText,
          fontFamily: renderedTickerEvent.scoringSide === 'home' ? 'Gramatika-Bold' : 'Gramatika-Medium',
          fontWeight: renderedTickerEvent.scoringSide === 'home' ? '900' : '700',
          fontSize: renderedTickerEvent.scoringSide === 'home' ? 14 : 13,
          lineHeight: renderedTickerEvent.scoringSide === 'home' ? 15 : 14,
        }}
      >
        {renderedTickerEvent.homeScore}
      </TotlText>
      <TotlText
        style={{
          color: primaryText,
          fontFamily: 'Gramatika-Medium',
          fontWeight: '700',
          fontSize: 13,
          lineHeight: 14,
          marginHorizontal: 4,
        }}
      >
        -
      </TotlText>
      <TotlText
        style={{
          color: primaryText,
          fontFamily: renderedTickerEvent.scoringSide === 'away' ? 'Gramatika-Bold' : 'Gramatika-Medium',
          fontWeight: renderedTickerEvent.scoringSide === 'away' ? '900' : '700',
          fontSize: renderedTickerEvent.scoringSide === 'away' ? 14 : 13,
          lineHeight: renderedTickerEvent.scoringSide === 'away' ? 15 : 14,
          marginRight: 5,
        }}
      >
        {renderedTickerEvent.awayScore}
      </TotlText>
      {renderedTickerEvent.awayBadge ? <Image source={renderedTickerEvent.awayBadge} style={{ width: 22, height: 22, marginRight: 5 }} /> : null}
      <TotlText
        style={{
          color: primaryText,
          fontFamily: renderedTickerEvent.scoringSide === 'away' ? 'Gramatika-Bold' : 'Gramatika-Medium',
          fontWeight: renderedTickerEvent.scoringSide === 'away' ? '900' : '700',
          fontSize: 12,
          lineHeight: 13,
          letterSpacing: 0.7,
          marginRight: 10,
        }}
      >
        {renderedTickerEvent.awayCode}
      </TotlText>
      <TotlText
        style={{
          color: primaryText,
          fontWeight: '800',
          fontSize: 13,
          lineHeight: 14,
          marginRight: 4,
        }}
      >
        {renderedTickerEvent.scorerName}
      </TotlText>
      <TotlText
        style={{
          color: secondaryText,
          fontWeight: '700',
          fontSize: 13,
          lineHeight: 14,
        }}
      >
        {renderedTickerEvent.minuteLabel}
      </TotlText>
    </View>
  ) : null;

  return (
    <Pressable
      accessibilityRole={hasExpandedStats ? 'button' : undefined}
      accessibilityLabel={hasExpandedStats ? 'Toggle score summary details' : undefined}
      accessibilityState={hasExpandedStats ? { expanded } : undefined}
      disabled={!hasExpandedStats}
      onPressIn={handlePress}
      style={{ width: fill ? '100%' : undefined }}
    >
      <Animated.View
        onLayout={(event) => setPillWidth(event.nativeEvent.layout.width)}
        style={{
          height: expandedHeight,
          width: fill ? '100%' : undefined,
          paddingHorizontal: 14,
          paddingTop: 8,
          paddingBottom: 8,
          borderRadius: 999,
          backgroundColor: pillBackground,
          borderWidth: 1,
          borderColor: pillBorder,
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Animated.View
          pointerEvents="none"
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

        <Animated.View pointerEvents="none" style={{ opacity: contentOpacity }}>
          {renderedTickerEvent ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                opacity: 0,
                left: -10_000,
                top: -10_000,
              }}
              onLayout={(event) => {
                const nextWidth = event.nativeEvent.layout.width;
                if (!nextWidth || nextWidth === tickerWidth) return;
                setTickerWidth(nextWidth);
              }}
            >
              {tickerRow}
            </View>
          ) : null}
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            {phase === 'ticker' && renderedTickerEvent ? (
              <Animated.View pointerEvents="none" style={{ height: 22, justifyContent: 'center', marginBottom: scoreRowMarginBottom }}>
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    flexDirection: 'row',
                    alignItems: 'center',
                    transform: [{ translateX: tickerTranslateX }],
                  }}
                >
                  {tickerRow}
                </Animated.View>
              </Animated.View>
            ) : (
              <Animated.View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: scoreRowMarginBottom }}>
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
                    fontSize: 14,
                    lineHeight: 15,
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
                      fontSize: 15,
                      lineHeight: 17,
                      letterSpacing: 0.2,
                    }}
                  >
                    {scoreText}
                  </TotlText>
                </Animated.View>
              </Animated.View>
            )}
            {hasExpandedStats ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  height: expandedRowHeight,
                  opacity: expandedRowOpacity,
                  overflow: 'hidden',
                  justifyContent: 'center',
                  transform: [{ translateY: expandedRowTranslateY }],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  {interactiveStats.map((stat, index) => (
                    <React.Fragment key={`${stat.value}-${stat.trailingValue ?? ''}`}>
                      {index > 0 ? (
                        <View
                          style={{
                            width: 1,
                            height: 12,
                            backgroundColor: pillBorder,
                            marginHorizontal: 10,
                          }}
                        />
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TotlText
                          style={{
                            color: primaryText,
                            fontWeight: '700',
                            fontSize: 12,
                            lineHeight: 14,
                          }}
                        >
                          {stat.value}
                        </TotlText>
                        {stat.icon ? (
                          <Ionicons
                            name={stat.icon}
                            size={14}
                            color={secondaryText}
                            style={{ marginLeft: 5, marginRight: stat.trailingValue ? 5 : 0 }}
                          />
                        ) : null}
                        {stat.trailingValue ? (
                          <TotlText
                            style={{
                              color: primaryText,
                              fontWeight: '700',
                              fontSize: 12,
                              lineHeight: 14,
                            }}
                          >
                            {stat.trailingValue}
                          </TotlText>
                        ) : null}
                      </View>
                    </React.Fragment>
                  ))}
                </View>
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
