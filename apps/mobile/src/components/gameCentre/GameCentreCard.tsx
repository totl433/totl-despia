import React from 'react';
import { Image, Pressable, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TotlText, useTokens } from '@totl/ui';

import EmojiGlyph, { hasEmojiBitmap } from '../../features/matchCenter/EmojiGlyph';
import type { ReactionSummary } from '../../hooks/useLeagueChatReactions';
import { fitReactionChips } from '../../features/gameCentre/cards';

/** Figma 250:43065 (header), 250:43162 (footer), 278:35272 (author header). */
const INK = {
  primary: '#000000',
  secondary: 'rgba(60,60,67,0.6)',
  chip: '#F2F2F7',
  more: '#F0F0F0',
  count: '#5C5C5C',
  border: '#DFEBE9',
  placeholder: '#ADADB1',
};
const ON_DARK = { primary: '#FFFFFF', secondary: 'rgba(255,255,255,0.65)' };
const SECTION_GAP = 28;
/** On dark cards (The Players): white with brand green text. */
const WHITE_BUTTON = { background: '#FFFFFF' };
const CHIP_HEIGHT = 24;
const CHIP_ROW_GAP = 8;
/** Between the footer's parts: reactions, comment link, text box (Figma 250:43162). */
const FOOTER_GAP = 12;

/**
 * The shared Game Centre card: header, the card's own content, then an optional footer,
 * 28pt apart (`gap` changes it). The content is whatever the card already showed.
 */
export default function GameCentreCard({
  header,
  children,
  footer,
  backgroundColor,
  background,
  gap = SECTION_GAP,
  paddingBottom = 20,
  style,
}: {
  header: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  backgroundColor?: string;
  /** Drawn behind everything, clipped to the card's corners (e.g. The Players pattern). */
  background?: React.ReactNode;
  /** Under the content when there is no footer, or under the footer when there is. */
  paddingBottom?: number;
  /** Space between header, content and footer. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTokens();
  const hasContent = React.Children.toArray(children).length > 0;
  // Only white cards get the border; themed cards (round-up, overall) keep their own colour edge to edge.
  const white = (!backgroundColor || backgroundColor === t.color.surface) && !background;
  return (
    <View
      style={[
        {
          borderRadius: 16,
          backgroundColor: backgroundColor ?? t.color.surface,
          ...(white ? { borderWidth: 1, borderColor: t.color.cardBorder } : null),
          paddingTop: 20,
          paddingBottom: footer && !background ? 0 : paddingBottom,
          gap,
          ...(background ? { overflow: 'hidden' as const } : null),
        },
        style,
      ]}
    >
      {background ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
          {background as any}
        </View>
      ) : null}
      {header as any}
      {hasContent ? <View style={{ paddingHorizontal: 16 }}>{children as any}</View> : null}
      {footer ? <View style={{ gap: FOOTER_GAP }}>{footer as any}</View> : null}
    </View>
  );
}

const titleText = { fontSize: 22, lineHeight: 26, letterSpacing: 0.22 };
const stampText = { fontSize: 14, lineHeight: 17, letterSpacing: 0.14 };

export function GameCentreCardHeader({
  title,
  subtitle,
  stamp,
  kicker,
  kickerFontFamily,
  kickerStyle,
  leading,
  accessory,
  onDark = false,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  stamp?: string | null;
  /** Brand line above the title, e.g. THE PLAYERS. */
  kicker?: string | null;
  kickerFontFamily?: string;
  /** Overrides for the kicker line, e.g. the fixtures card's lime season. */
  kickerStyle?: TextStyle;
  /** Top-left mark, e.g. the TOTL logo on an admin broadcast. */
  leading?: React.ReactNode;
  /** Shown where the time stamp goes, e.g. the pin on a pinned card. */
  accessory?: React.ReactNode;
  onDark?: boolean;
  onPress?: () => void;
}) {
  const ink = onDark ? ON_DARK : INK;
  // The stamp (or accessory) always sits on the card's first line, so it lines up across cards.
  const corner = (
    <>
      {stamp ? <TotlText style={[stampText, { marginTop: 4, color: ink.secondary }]}>{stamp}</TotlText> : null}
      {accessory ? <View style={{ width: 33, alignItems: 'flex-end', marginTop: 4 }}>{accessory as any}</View> : null}
    </>
  );
  const kickerLine = kicker ? (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
      <TotlText
        style={{
          flex: 1,
          fontFamily: kickerFontFamily,
          fontSize: 20,
          lineHeight: 24,
          letterSpacing: 0.2,
          color: ink.primary,
          ...kickerStyle,
        }}
      >
        {kicker}
      </TotlText>
      {corner}
    </View>
  ) : null;
  const titleRow = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
      <TotlText accessibilityRole="header" style={[titleText, { flex: 1, color: ink.primary }]}>
        {title}
      </TotlText>
      {kicker ? null : corner}
    </View>
  );
  const copy = (
    <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
      {kickerLine}
      {titleRow}
      {subtitle ? (
        <TotlText style={{ fontSize: 16, lineHeight: 20, letterSpacing: 0.16, color: ink.primary }}>{subtitle}</TotlText>
      ) : null}
    </View>
  );
  const heading = (
    <View style={{ paddingHorizontal: 16, gap: 8 }}>
      {leading ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {leading as any}
          {copy}
        </View>
      ) : (
        <>
          {kickerLine}
          {titleRow}
          {subtitle ? (
            <TotlText style={{ fontSize: 16, lineHeight: 20, letterSpacing: 0.16, color: ink.primary }}>{subtitle}</TotlText>
          ) : null}
        </>
      )}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={kicker && subtitle ? `${kicker}. ${title}. ${subtitle}` : kicker ? `${kicker}. ${title}` : subtitle ? `${title}. ${subtitle}` : title}
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        {heading}
      </Pressable>
    );
  }
  return heading;
}

/**
 * A footer call to action (Figma 293:34460): brand fill, white label, 8pt corners. An optional
 * quiet second button (Figma 300:32561, e.g. Dismiss) sits 16pt to its right.
 */
/** The pinned card's small buttons: 8pt top and bottom, 12pt either side (Figma 293:34460). */
export function GameCentreCardButton({
  label,
  onPress,
  disabled = false,
  secondary,
  tone = 'brand',
}: {
  /** Leave out for a footer with only the quiet button. */
  label?: string | null;
  /** `white` for dark cards (The Players), where the brand fill would disappear. */
  tone?: 'brand' | 'white';
  onPress?: () => void;
  disabled?: boolean;
  secondary?: { label: string; onPress: () => void } | null;
}) {
  const t = useTokens();
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
      {label ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          hitSlop={6}
          style={({ pressed }) => ({
            backgroundColor: disabled ? '#94A3B8' : tone === 'white' ? WHITE_BUTTON.background : t.color.brand,
            borderRadius: t.radius.sm,
            paddingVertical: t.space[2],
            paddingHorizontal: t.space[3],
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <TotlText
            style={{ fontFamily: 'Gramatika-Medium', fontSize: 16, lineHeight: 16, color: tone === 'white' ? t.color.brand : '#FFFFFF' }}
          >
            {label}
          </TotlText>
        </Pressable>
      ) : null}
      {secondary ? (
        <Pressable
          accessibilityRole="button"
          onPress={secondary.onPress}
          hitSlop={6}
          style={({ pressed }) => ({
            backgroundColor: INK.chip,
            borderRadius: t.radius.sm,
            paddingVertical: t.space[2],
            paddingHorizontal: t.space[3],
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 16, lineHeight: 16, color: INK.secondary }}>{secondary.label}</TotlText>
        </Pressable>
      ) : null}
    </View>
  );
}

function Avatar({ uri, label, size, ring }: { uri?: string | null; label: string; size: number; ring: string }) {
  const letter = label.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: '#E2E8F0',
        borderWidth: 1.5,
        borderColor: ring,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <TotlText style={{ fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.5), color: '#334155' }}>{letter}</TotlText>
      )}
    </View>
  );
}

/** A Mini League line: who said it, in which league, and when. */
export function GameCentreAuthorHeader({
  name,
  league,
  authorAvatar,
  leagueAvatar,
  stamp,
  onPress,
}: {
  name: string;
  league: string;
  authorAvatar?: string | null;
  leagueAvatar?: string | null;
  stamp?: string | null;
  onPress?: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} in ${league}. Open chat`}
      onPress={onPress}
      disabled={!onPress}
      style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}
    >
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ zIndex: 2, marginRight: -12 }}>
            <Avatar uri={authorAvatar} label={name} size={32} ring={t.color.surface} />
          </View>
          <Avatar uri={leagueAvatar} label={league} size={32} ring={t.color.surface} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <TotlText numberOfLines={1} style={{ fontSize: 18, lineHeight: 22, letterSpacing: 0.18, color: INK.primary }}>
            {name}
          </TotlText>
          <TotlText numberOfLines={1} style={[stampText, { color: INK.secondary }]}>
            {league}
          </TotlText>
        </View>
      </View>
      {stamp ? <TotlText style={[stampText, { marginTop: 3, color: INK.secondary }]}>{stamp}</TotlText> : null}
    </Pressable>
  );
}

function Emoji({ emoji, size }: { emoji: string; size: number }) {
  const codePoint = emoji.codePointAt(0);
  if (codePoint != null && hasEmojiBitmap(codePoint)) return <EmojiGlyph codePoint={codePoint} size={size} />;
  return <TotlText style={{ fontSize: size - 2, lineHeight: size + 2 }}>{emoji}</TotlText>;
}

/**
 * Reaction chips (Figma 250:41941). Your own reaction is marked in brand green.
 * Two rows at most for the first release; `onMore` adds the + chip.
 */
export function GameCentreReactionBar({
  chips,
  onReact,
  onMore,
  moreOpen = false,
}: {
  chips: ReactionSummary[];
  onReact: (emoji: string) => void;
  onMore?: () => void;
  moreOpen?: boolean;
}) {
  const t = useTokens();
  const [width, setWidth] = React.useState(0);
  // Fill two rows, then the + (so it never wraps out of sight).
  const shown = onMore ? chips.slice(0, fitReactionChips(chips, width)) : chips;
  return (
    <View
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width - 32);
        if (next !== width) setWidth(next);
      }}
      style={{
        paddingHorizontal: 16,
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 12,
        rowGap: CHIP_ROW_GAP,
        maxHeight: CHIP_HEIGHT * 2 + CHIP_ROW_GAP,
        overflow: 'hidden',
      }}
    >
      {shown.map((chip) => {
        const mine = chip.hasUserReacted;
        return (
          <Pressable
            key={chip.emoji}
            accessibilityRole="button"
            accessibilityState={{ selected: mine }}
            accessibilityLabel={
              mine ? `Remove ${chip.emoji} reaction` : chip.count > 0 ? `React ${chip.emoji}, ${chip.count}` : `React ${chip.emoji}`
            }
            onPress={() => onReact(chip.emoji)}
            hitSlop={4}
            style={({ pressed }) => ({
              height: CHIP_HEIGHT,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 6,
              borderRadius: 6,
              backgroundColor: mine ? 'rgba(28,131,118,0.14)' : INK.chip,
              borderWidth: mine ? 1 : 0,
              borderColor: t.color.brand,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Emoji emoji={chip.emoji} size={16} />
            {chip.count > 0 ? (
              <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 12, lineHeight: 16, color: mine ? t.color.brand : INK.count }}>
                {chip.count}
              </TotlText>
            ) : null}
          </Pressable>
        );
      })}
      {onMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={moreOpen ? 'Close reactions' : 'More reactions'}
          onPress={onMore}
          hitSlop={4}
          style={({ pressed }) => ({
            height: CHIP_HEIGHT,
            minWidth: 28,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 6,
            borderRadius: 6,
            backgroundColor: INK.more,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name={moreOpen ? 'close' : 'add'} size={18} color="#000000" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The footer's text box (Figma 250:43144). Sends on return or the arrow. */
export function GameCentreReplyInput({
  placeholder,
  value,
  onChangeText,
  onFocus,
  onSend,
  sending = false,
}: {
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  onSend: () => void;
  sending?: boolean;
}) {
  const t = useTokens();
  const ready = value.trim().length > 0 && !sending;
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
      <View
        style={{
          minHeight: 40,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: INK.border,
          borderRadius: 28,
          backgroundColor: '#FFFFFF',
          paddingLeft: 16,
          paddingRight: 6,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor={INK.placeholder}
          accessibilityLabel={placeholder}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={() => {
            if (ready) onSend();
          }}
          style={{ flex: 1, fontFamily: t.font.body, fontSize: 16, color: INK.primary, paddingVertical: 8 }}
        />
        {ready ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send reply"
            onPress={onSend}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: t.color.brand,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
