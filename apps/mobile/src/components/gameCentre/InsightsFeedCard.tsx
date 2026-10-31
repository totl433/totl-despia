import React from 'react';
import { Image, View } from 'react-native';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';

import { FeedFeatureBadge, FeedFeatureHeader } from './FeedFeatureHeader';

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

/** INSIGHTS eyebrow, title and line, with the sparkle badge (Figma 415:92300). No time: a season stat isn't news. */
export function InsightsFeedCardHeader({ title, body }: { title: string; body?: string | null }) {
  return (
    <FeedFeatureHeader
      eyebrow="Insights"
      eyebrowColor={INSIGHTS_FEED_CARD.eyebrow}
      title={title}
      line={body}
      textColor={INSIGHTS_FEED_CARD.text}
      badge={
        <FeedFeatureBadge color={INSIGHTS_FEED_CARD.badge}>
          <SvgUri uri={SPARKLE} width={13.5498} height={16.7065} />
        </FeedFeatureBadge>
      }
    />
  );
}
