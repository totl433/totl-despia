import React from 'react';
import { Image, View } from 'react-native';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import { TotlText, useTokens } from '@totl/ui';

const BACKGROUND = require('../../../assets/insights/insights-card-bg.png');
const SPARKLE = Asset.fromModule(require('../../../assets/insights/insights-sparkle.svg')).uri;

/** Figma 415:92300: every Insights card shares this blue background, eyebrow and sparkle. */
export const INSIGHTS_FEED_CARD = {
  /** The background's darkest blue, shown until the image draws. */
  background: '#13325C',
  text: '#F7F6F6',
  eyebrow: '#75B6FF',
  badge: 'rgba(0,182,241,0.2)',
};

/** The Figma background, cropped to fill the card whatever its height. */
export function InsightsFeedBackground() {
  return (
    <View style={{ flex: 1, backgroundColor: INSIGHTS_FEED_CARD.background }}>
      <Image source={BACKGROUND} fadeDuration={0} resizeMode="cover" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' }} />
    </View>
  );
}

/**
 * INSIGHTS eyebrow, title and line, with the sparkle badge top right. No time: a season stat
 * isn't news. Figma trims its gaps to the cap height, so its 20pt under the eyebrow is 12pt here
 * and its 16pt between title and line is 8pt.
 */
export function InsightsFeedCardHeader({ title, body }: { title: string; body?: string | null }) {
  const t = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={body ? `Insights. ${title}. ${body}` : `Insights. ${title}`}
      style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
        <TotlText style={{ fontFamily: t.font.bold, fontSize: 12, lineHeight: 14, color: INSIGHTS_FEED_CARD.eyebrow }}>INSIGHTS</TotlText>
        <View style={{ gap: 8 }}>
          <TotlText accessibilityRole="header" style={{ fontFamily: t.font.regular, fontSize: 22, lineHeight: 26, letterSpacing: 0.22, color: INSIGHTS_FEED_CARD.text }}>
            {title}
          </TotlText>
          {body ? (
            <TotlText style={{ fontFamily: t.font.regular, fontSize: 16, lineHeight: 20, letterSpacing: 0.16, color: INSIGHTS_FEED_CARD.text }}>
              {body}
            </TotlText>
          ) : null}
        </View>
      </View>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: INSIGHTS_FEED_CARD.badge,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SvgUri uri={SPARKLE} width={13.5498} height={16.7065} />
      </View>
    </View>
  );
}
