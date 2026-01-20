import React from 'react'
import { View } from 'react-native'
import { TotlText } from '@totl/ui'

export default function SectionHeaderRow({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: React.JSX.Element | null
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <TotlText variant="sectionTitle">{title}</TotlText>
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

