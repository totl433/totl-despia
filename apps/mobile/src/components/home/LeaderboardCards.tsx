import React from 'react'
import { Image, Pressable, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import { Card, TotlText, useTokens } from '@totl/ui'
import AnimatedPerimeterGlow from '../AnimatedPerimeterGlow'

export function LeaderboardCardShell({ onPress, children }: { onPress?: () => void; children: React.JSX.Element }) {
  const t = useTokens()
  const isLightMode = t.color.background.toLowerCase() === '#f8fafc'
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.99 : 1 }],
        opacity: pressed ? 0.96 : 1,
      })}
    >
      <Card
        style={[
          { width: 148, height: 148, padding: 12, borderRadius: 14 },
          // In light mode, remove drop shadow for a cleaner, flatter look.
          isLightMode
            ? {
                shadowOpacity: 0,
                shadowRadius: 0,
                shadowOffset: { width: 0, height: 0 },
                elevation: 0,
              }
            : null,
        ]}
      >
        {children}
      </Card>
    </Pressable>
  )
}

export function LeaderboardCardLastGw({
  gw,
  score,
  totalFixtures,
  displayText,
  onPress,
}: {
  gw: number | null
  score: string
  totalFixtures: string
  displayText: string
  onPress?: () => void
}) {
  const t = useTokens()

  return (
    <LeaderboardCardShell onPress={onPress}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <TotlText style={{ fontSize: 32, fontWeight: '300', color: t.color.brand, lineHeight: 38 }}>{score}</TotlText>
            <TotlText variant="caption" style={{ color: t.color.muted, fontSize: 16, lineHeight: 20, fontWeight: '700' }}>
              {' '}
              /{totalFixtures}
            </TotlText>
          </View>
          <TotlText
            variant="caption"
            style={{ color: t.color.muted, fontWeight: '900', marginTop: 2, fontSize: 18, lineHeight: 18 }}
          >
            ›
          </TotlText>
        </View>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TotlText
            variant="caption"
            style={{
              color: t.color.muted,
              marginBottom: 8,
              fontSize: 14,
              lineHeight: 18,
              textTransform: 'uppercase',
            }}
          >
            {gw ? `Gameweek ${gw}` : 'Gameweek'}
          </TotlText>
          <TotlText style={{ fontSize: 16, lineHeight: 20, fontWeight: '900' }}>{displayText}</TotlText>
        </View>
      </View>
    </LeaderboardCardShell>
  )
}

export function LeaderboardCardSimple({
  title,
  badge,
  displayText,
  onPress,
}: {
  title: string
  badge: any | null
  displayText: string
  onPress?: () => void
}) {
  const t = useTokens()

  return (
    <LeaderboardCardShell onPress={onPress}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          {badge ? <Image source={badge} style={{ width: 28, height: 28 }} /> : <View style={{ width: 28, height: 28 }} />}
          <TotlText
            variant="caption"
            style={{ color: t.color.muted, fontWeight: '900', marginTop: 2, fontSize: 18, lineHeight: 18 }}
          >
            ›
          </TotlText>
        </View>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TotlText
            variant="caption"
            style={{
              color: t.color.muted,
              marginBottom: 8,
              fontWeight: '700',
              letterSpacing: 0.8,
              fontSize: 14,
              lineHeight: 18,
            }}
          >
            {title}
          </TotlText>
          <TotlText style={{ fontSize: 16, lineHeight: 20, fontWeight: '900' }}>{displayText}</TotlText>
        </View>
      </View>
    </LeaderboardCardShell>
  )
}

export function LeaderboardCardResultsCta({
  gw,
  badge,
  onPress,
}: {
  gw: number
  badge: any | null
  onPress?: () => void
}) {
  const shimmer = useSharedValue(0)

  React.useEffect(() => {
    // One sweep, then pause so the full cycle is ~5s.
    const SWEEP_MS = 1100
    const PAUSE_MS = 3900
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
        withDelay(PAUSE_MS, withTiming(0, { duration: 1 }))
      ),
      -1,
      false
    )
  }, [shimmer])

  const shimmerStyle = useAnimatedStyle(() => {
    // Translate a narrow highlight band across the card.
    // Start off-left, end off-right.
    const x = -120 + shimmer.value * 280
    return {
      opacity: 0.5,
      transform: [{ translateX: x }, { rotate: '-18deg' }],
    }
  })

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.99 : 1 }],
        opacity: pressed ? 0.96 : 1,
      })}
    >
      <View style={{ width: 148, height: 148, borderRadius: 14, overflow: 'hidden' }}>
        <AnimatedPerimeterGlow active radius={14} />
        <LinearGradient
          colors={['#10B981', '#0D9488']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, padding: 12 }}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              {badge ? <Image source={badge} style={{ width: 28, height: 28 }} /> : <View style={{ width: 28, height: 28 }} />}
              <TotlText
                variant="caption"
                style={{ color: 'rgba(255,255,255,0.95)', fontWeight: '900', marginTop: 2, fontSize: 18, lineHeight: 18 }}
              >
                ›
              </TotlText>
            </View>
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <TotlText
                variant="caption"
                style={{
                  color: 'rgba(255,255,255,0.8)',
                  marginBottom: 8,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                  fontSize: 14,
                  lineHeight: 18,
                  textTransform: 'uppercase',
                }}
              >
                {`Gameweek ${gw}`}
              </TotlText>
              <TotlText style={{ fontSize: 18, lineHeight: 22, fontWeight: '900', color: '#FFFFFF' }}>Your results</TotlText>
            </View>
          </View>
        </LinearGradient>
        {/* Shimmer sweep (premium "shine") - must render ABOVE the background gradient */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -40,
              left: 0,
              width: 110,
              height: 220,
            },
            shimmerStyle,
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.92)', 'rgba(255,255,255,0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      </View>
    </Pressable>
  )
}

