import React from 'react'
import { View } from 'react-native'
import { TotlText, useTokens } from '@totl/ui'

export default function SectionHeaderRow({
  title,
  subtitle,
  right,
  titleRight,
}: {
  title: string
  subtitle?: string
  right?: React.JSX.Element | null
  /**
   * Optional element shown inline to the right of the title (e.g. "0/10").
   */
  titleRight?: React.JSX.Element | string | number | null
}) {
  const t = useTokens()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        {/* Section header style (sentence case): Gramatika-Medium 22/22 (spec). */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <TotlText
            style={{
              color: t.color.text,
              fontFamily: 'Gramatika-Medium',
              fontSize: 22,
              lineHeight: 22,
            }}
          >
            {title}
          </TotlText>
          {titleRight != null ? (
            typeof titleRight === 'string' || typeof titleRight === 'number' ? (
              <TotlText
                style={{
                  marginLeft: 8,
                  color: '#ADADB1',
                  fontFamily: 'Gramatika-Regular',
                  fontSize: 22,
                  lineHeight: 22,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {String(titleRight)}
              </TotlText>
            ) : (
              <View style={{ marginLeft: 8 }}>{titleRight}</View>
            )
          ) : null}
        </View>
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

