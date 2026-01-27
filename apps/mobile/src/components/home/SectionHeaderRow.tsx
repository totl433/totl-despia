import React from 'react'
import { View } from 'react-native'
import { TotlText, useTokens } from '@totl/ui'

export default function SectionHeaderRow({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: React.JSX.Element | null
}) {
  const t = useTokens()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        {/* Section header style (sentence case): Gramatika-Bold 20/20, white. */}
        <TotlText
          style={{
            color: t.color.text,
            fontFamily: 'Gramatika-Bold',
            fontSize: 20,
            lineHeight: 20,
          }}
        >
          {title}
        </TotlText>
        {subtitle ? (
          <TotlText variant="sectionSubtitle" style={{ marginTop: 2 }}>
            {subtitle}
          </TotlText>
        ) : null}
      </View>
      {right ? <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>{right}</View> : null}
    </View>
  )
}

