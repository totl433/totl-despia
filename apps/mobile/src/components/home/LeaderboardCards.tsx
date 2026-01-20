import React from 'react'
import { Image, Pressable, View } from 'react-native'
import { Card, TotlText, useTokens } from '@totl/ui'

export function LeaderboardCardShell({ onPress, children }: { onPress?: () => void; children: React.JSX.Element }) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.99 : 1 }],
        opacity: pressed ? 0.96 : 1,
      })}
    >
      <Card style={{ width: 148, height: 148, padding: 12, borderRadius: 14 }}>{children}</Card>
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
          <TotlText variant="caption" style={{ color: t.color.muted, fontWeight: '900', marginTop: 2, fontSize: 18, lineHeight: 18 }}>
            ›
          </TotlText>
        </View>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TotlText variant="caption" style={{ color: t.color.muted, marginBottom: 8, fontSize: 14, lineHeight: 18 }}>
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
          <TotlText variant="caption" style={{ color: t.color.muted, fontWeight: '900', marginTop: 2, fontSize: 18, lineHeight: 18 }}>
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

