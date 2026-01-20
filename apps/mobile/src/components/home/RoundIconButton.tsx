import React from 'react'
import { Image, Pressable } from 'react-native'
import { useTokens } from '@totl/ui'

export default function RoundIconButton({ onPress, icon }: { onPress: () => void; icon: any }) {
  const t = useTokens()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 999,
        backgroundColor: t.color.brand,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Image source={icon} style={{ width: 22, height: 22, resizeMode: 'contain' }} />
    </Pressable>
  )
}

