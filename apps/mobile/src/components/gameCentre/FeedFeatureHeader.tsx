import React from 'react';
import { View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

/** A 32pt round badge for the header's top right: a tinted circle with the icon centred. */
export function FeedFeatureBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      {children as any}
    </View>
  );
}

/**
 * The header on the feed's designed cards, Insights and Gameweek fixtures (Figma "Building blocks/Header",
 * 415:92257 and 418:120014): an upper-case eyebrow, the title and a line, with a 32pt badge top right.
 * No time. Figma trims its gaps to the cap height, so its 20pt under the eyebrow is 12pt here, and
 * its gap between title and line is 8pt less (`lineGap`).
 */
export function FeedFeatureHeader({
  eyebrow,
  eyebrowColor,
  title,
  line,
  lineGap = 8,
  textColor,
  badge,
}: {
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  line?: string | null;
  lineGap?: number;
  textColor: string;
  badge?: React.ReactNode;
}) {
  const t = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={line ? `${eyebrow}. ${title}. ${line}` : `${eyebrow}. ${title}`}
      style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
        <TotlText style={{ fontFamily: t.font.bold, fontSize: 12, lineHeight: 14, textTransform: 'uppercase', color: eyebrowColor }}>
          {eyebrow}
        </TotlText>
        <View style={{ gap: lineGap }}>
          <TotlText accessibilityRole="header" style={{ fontFamily: t.font.regular, fontSize: 22, lineHeight: 26, letterSpacing: 0.22, color: textColor }}>
            {title}
          </TotlText>
          {line ? (
            <TotlText style={{ fontFamily: t.font.regular, fontSize: 16, lineHeight: 20, letterSpacing: 0.16, color: textColor }}>{line}</TotlText>
          ) : null}
        </View>
      </View>
      {badge as any}
    </View>
  );
}
