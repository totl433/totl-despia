import React from 'react';
import { AppState, Image, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { runOnJS } from 'react-native-reanimated';
import { Card, TotlText, useTokens } from '@totl/ui';
import { Audio } from 'expo-av';

import { TEAM_BADGES } from '../../lib/teamBadges';

const WHISTLE_SOUND = require('../../../assets/sounds/whistle.mp3');

function pad2(n: number): string {
  const x = Math.max(0, Math.floor(n));
  return x < 10 ? `0${x}` : String(x);
}

function countdownParts(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

/**
 * A pre-kickoff countdown tile for the Home "Performance" carousel.
 *
 * Visibility is controlled by the parent. This component is responsible for:
 * - live countdown every second
 * - entry/exit animations
 * - calling `onKickedOff()` after kickoff (post-exit)
 */
export default function GameweekCountdownItem({
  gw,
  kickoffTimeMs,
  homeCode,
  awayCode,
  onKickedOff,
}: {
  gw: number;
  kickoffTimeMs: number;
  homeCode?: string | null;
  awayCode?: string | null;
  onKickedOff: () => void;
}) {
  useTokens(); // keep theme provider wiring consistent (even though styles are mostly fixed)

  // Keep time drift-free: always compare against Date.now() and kickoffTimeMs.
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const remainingMs = kickoffTimeMs - nowMs;

  const playedRef = React.useRef(false);
  const removedRef = React.useRef(false);
  const mountedAfterKickoffRef = React.useRef(false);
  const appStateRef = React.useRef(AppState.currentState);
  const lastActiveAtMsRef = React.useRef<number | null>(appStateRef.current === 'active' ? Date.now() : null);

  React.useEffect(() => {
    const mountedAt = Date.now();
    mountedAfterKickoffRef.current = mountedAt >= kickoffTimeMs;

    const sub = AppState.addEventListener('change', (s) => {
      appStateRef.current = s;
      if (s === 'active') lastActiveAtMsRef.current = Date.now();
    });
    return () => sub.remove();
  }, [kickoffTimeMs]);

  // Tick every second until kickoff.
  React.useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNowMs(n);
      if (n >= kickoffTimeMs) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [kickoffTimeMs]);

  // Entry animation.
  const opacitySV = useSharedValue(0);
  const scaleSV = useSharedValue(0.9);
  React.useEffect(() => {
    opacitySV.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    scaleSV.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacitySV.value,
    transform: [{ scale: scaleSV.value }],
  }));

  // If mounted after kickoff, remove immediately (no sound, no animation).
  React.useEffect(() => {
    if (removedRef.current) return;
    if (!mountedAfterKickoffRef.current) return;
    removedRef.current = true;
    playedRef.current = true;
    onKickedOff();
  }, [onKickedOff]);

  // Exit on kickoff; parent will remove tile from carousel data.
  React.useEffect(() => {
    if (removedRef.current) return;
    if (mountedAfterKickoffRef.current) return;

    const kickedOff = Date.now() >= kickoffTimeMs;
    if (!kickedOff) return;

    const isActive = appStateRef.current === 'active';
    const lastActiveAt = lastActiveAtMsRef.current;
    const resumedAfterKickoff = typeof lastActiveAt === 'number' ? lastActiveAt > kickoffTimeMs : false;

    removedRef.current = true;

    // Trigger on first tick past kickoff.
    opacitySV.value = withTiming(
      0,
      { duration: 250, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onKickedOff)();
      }
    );
    scaleSV.value = withTiming(0.97, { duration: 250, easing: Easing.out(Easing.cubic) });

    // Play sound once only; never play if kickoff occurred while backgrounded (resume after kickoff).
    if (isActive && !resumedAfterKickoff && !playedRef.current) {
      playedRef.current = true;
      void (async () => {
        let sound: Audio.Sound | null = null;
        try {
          const created = await Audio.Sound.createAsync(WHISTLE_SOUND, { shouldPlay: true });
          sound = created.sound;
          sound.setOnPlaybackStatusUpdate((status) => {
            if (!status.isLoaded) return;
            if (status.didJustFinish) {
              void sound?.unloadAsync();
            }
          });
          // Safety: unload even if status callback doesn't fire.
          setTimeout(() => {
            void sound?.unloadAsync();
          }, 6000);
        } catch {
          // ignore
          try {
            await sound?.unloadAsync();
          } catch {
            // ignore
          }
        }
      })();
    }
  }, [kickoffTimeMs, onKickedOff, opacitySV, scaleSV]);

  const { days, hours, minutes } = React.useMemo(() => countdownParts(remainingMs), [remainingMs]);
  const homeBadge = homeCode ? TEAM_BADGES[String(homeCode).toUpperCase()] ?? null : null;
  const awayBadge = awayCode ? TEAM_BADGES[String(awayCode).toUpperCase()] ?? null : null;

  return (
    <Animated.View style={animStyle}>
      <Card
        style={{
          width: 148,
          height: 148,
          padding: 0,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#DFEBE9',
          shadowOpacity: 0,
          shadowRadius: 0,
          shadowOffset: { width: 0, height: 0 },
          elevation: 0,
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
        }}
      >
        <View style={{ flex: 1, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 14 }}>
          <TotlText
            style={{
              textAlign: 'center',
              fontFamily: 'Gramatika-Regular',
              fontWeight: '400',
              fontSize: 12,
              color: '#59687C',
            }}
            numberOfLines={1}
          >
            {`GW ${gw} KICKS-OFF IN`}
          </TotlText>

          <View style={{ height: 8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ width: 44, alignItems: 'center' }}>
              <TotlText style={{ fontFamily: 'BarlowCondensed-Light', fontSize: 40, lineHeight: 40, color: '#202020' }}>
                {pad2(days)}
              </TotlText>
              <TotlText style={{ fontFamily: 'Gramatika-Regular', fontSize: 8, color: '#ADADB1', marginTop: -6 }}>
                DAYS
              </TotlText>
            </View>
            <View style={{ width: 44, alignItems: 'center' }}>
              <TotlText style={{ fontFamily: 'BarlowCondensed-Light', fontSize: 40, lineHeight: 40, color: '#202020' }}>
                {pad2(hours)}
              </TotlText>
              <TotlText style={{ fontFamily: 'Gramatika-Regular', fontSize: 8, color: '#ADADB1', marginTop: -6 }}>
                HRS
              </TotlText>
            </View>
            <View style={{ width: 44, alignItems: 'center' }}>
              <TotlText style={{ fontFamily: 'BarlowCondensed-Light', fontSize: 40, lineHeight: 40, color: '#202020' }}>
                {pad2(minutes)}
              </TotlText>
              <TotlText style={{ fontFamily: 'Gramatika-Regular', fontSize: 8, color: '#ADADB1', marginTop: -6 }}>
                MINS
              </TotlText>
            </View>
          </View>

          <View style={{ flex: 1 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, opacity: 0.85 }}>
            {homeBadge ? <Image source={homeBadge} style={{ width: 30, height: 30 }} /> : <View style={{ width: 30, height: 30 }} />}
            {awayBadge ? <Image source={awayBadge} style={{ width: 30, height: 30 }} /> : <View style={{ width: 30, height: 30 }} />}
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

