import React from 'react'
import { TotlText } from '@totl/ui'

export default function SectionTitle({ children }: { children: string }) {
  return (
    <TotlText variant="section" style={{ marginBottom: 10, letterSpacing: 1.2 }}>
      {children.toUpperCase()}
    </TotlText>
  )
}

