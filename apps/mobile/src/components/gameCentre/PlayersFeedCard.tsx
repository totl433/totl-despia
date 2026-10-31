import React from 'react';
import { Image, View, type LayoutChangeEvent } from 'react-native';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import { TotlText } from '@totl/ui';

import type { FeedFace } from '../../features/matchCenter/feed';
import { PLAYERS_FONTS } from '../retroPlayers/playersTheme';

const PATTERN = require('../../../assets/players/players-feed-pattern.png');
const WORD_THE = Asset.fromModule(require('../../../assets/players/players-home-the.svg')).uri;
const WORD_PLAYERS = Asset.fromModule(require('../../../assets/players/players-home-players.svg')).uri;

/** Figma 413:82234: every Players card in the feed shares this dark pattern and header. */
export const PLAYERS_FEED_CARD = {
  /** The pattern's darkest green, shown until the image draws. */
  background: '#00241A',
  text: '#F7F6F6',
  secondary: 'rgba(247,246,246,0.7)',
  lime: '#E6FA81',
  tile: 'rgba(230,250,129,0.2)',
  avatar: '#19191C',
};

/** The pattern image is 365 × 205 and three tiles tall, so it repeats down the card without a seam. */
const PATTERN_SIZE = { width: 365, height: 205 };

/** The pattern, stretched to the card's width on wider phones and repeated down tall cards. */
export function PlayersFeedBackground() {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const onLayout = React.useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);
  const width = Math.max(PATTERN_SIZE.width, size.width);
  const height = (width * PATTERN_SIZE.height) / PATTERN_SIZE.width;
  const copies = size.height ? Math.ceil(size.height / height) : 0;
  return (
    <View onLayout={onLayout} style={{ flex: 1, backgroundColor: PLAYERS_FEED_CARD.background }}>
      {Array.from({ length: copies }, (_, i) => (
        <Image key={i} source={PATTERN} fadeDuration={0} style={{ position: 'absolute', left: 0, top: i * height, width, height }} />
      ))}
    </View>
  );
}

/**
 * THE PLAYERS lettering (the same artwork as the home card), the card's time on the right,
 * and one 16pt line under it.
 */
export function PlayersFeedCardHeader({ line, stamp }: { line: string; stamp?: string | null }) {
  return (
    <View style={{ paddingHorizontal: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <View accessible accessibilityRole="header" accessibilityLabel="The Players" style={{ flexDirection: 'row', gap: 12 }}>
          <SvgUri uri={WORD_THE} width={50.3632} height={30.5087} />
          <SvgUri uri={WORD_PLAYERS} width={128.001} height={30.5087} />
        </View>
        {stamp ? (
          <TotlText style={{ marginTop: 4, fontSize: 14, lineHeight: 17, letterSpacing: 0.14, color: PLAYERS_FEED_CARD.secondary }}>{stamp}</TotlText>
        ) : null}
      </View>
      <TotlText style={{ fontFamily: PLAYERS_FONTS.body, fontSize: 16, lineHeight: 19, letterSpacing: 0.16, color: PLAYERS_FEED_CARD.text }}>
        {line}
      </TotlText>
    </View>
  );
}

/** Up to three across; four sit two by two so no one is left alone on a row. */
export function playersWinnerColumns(count: number): number {
  if (count <= 3) return Math.max(1, count);
  return count === 4 ? 2 : 3;
}

function WinnerAvatar({ face }: { face: FeedFace }) {
  const letter = face.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: PLAYERS_FEED_CARD.avatar,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {face.avatarUrl ? (
        <Image source={{ uri: face.avatarUrl }} style={{ width: 48, height: 48 }} resizeMode="cover" />
      ) : (
        <TotlText style={{ fontFamily: PLAYERS_FONTS.body, fontSize: 24, lineHeight: 30, color: PLAYERS_FEED_CARD.text }}>{letter}</TotlText>
      )}
    </View>
  );
}

/** Everyone who won (Figma 413:82125): a lime tile each, avatar over name, in as many rows as it takes. */
export function PlayersWinnerGrid({ faces }: { faces: FeedFace[] }) {
  const columns = playersWinnerColumns(faces.length);
  const rows: FeedFace[][] = [];
  for (let i = 0; i < faces.length; i += columns) rows.push(faces.slice(i, i + columns));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map((face, i) => (
            <View
              key={`${face.name}-${i}`}
              accessible
              accessibilityLabel={face.name}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 100,
                padding: 8,
                gap: 12,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: PLAYERS_FEED_CARD.tile,
              }}
            >
              <WinnerAvatar face={face} />
              <TotlText
                numberOfLines={2}
                style={{
                  alignSelf: 'stretch',
                  textAlign: 'center',
                  fontFamily: PLAYERS_FONTS.medium,
                  fontSize: 12,
                  lineHeight: 14,
                  color: PLAYERS_FEED_CARD.lime,
                }}
              >
                {face.name}
              </TotlText>
            </View>
          ))}
          {/* Keeps a short last row's tiles the same width as the rows above. */}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`gap-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}
