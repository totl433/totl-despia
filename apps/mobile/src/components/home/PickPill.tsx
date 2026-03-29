import React from 'react'
import { View } from 'react-native'
import { TotlText, useTokens } from '@totl/ui'

export default function PickPill({ label, active }: { label: string; active: boolean }) {
  const t = useTokens()

  return (
    <View
      style={{
        paddingHorizontal: t.space[3],
        paddingVertical: t.space[2],
        borderRadius: t.radius.pill,
        backgroundColor: active ? t.color.brand : 'transparent',
        borderWidth: 1,
        borderColor: active ? 'transparent' : t.color.border,
      }}
    >
      <TotlText
        variant="caption"
        style={{
          color: active ? '#FFFFFF' : t.color.text,
          fontWeight: '800',
        }}
      >
        {label}
      </TotlText>
    </View>
  )
}

