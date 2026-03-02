import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

export type GlobalButtonVariant = 'primary' | 'secondary';
export type GlobalButtonSize = 'sm' | 'md';

/**
 * GlobalButton
 * Unified button styling for the mobile app (Figma-aligned).
 */
export default function GlobalButton({
  title,
  variant = 'primary',
  size = 'md',
  active = true,
  disabled,
  style,
  ...props
}: PressableProps & {
  title: string;
  variant?: GlobalButtonVariant;
  size?: GlobalButtonSize;
  /** For secondary buttons: when active, border becomes primary black. */
  active?: boolean;
}) {
  const t = useTokens();
  const isDisabled = !!disabled;
  const height = size === 'sm' ? 48 : 56;
  const radius = 12;

  const borderColor =
    variant === 'primary'
      ? 'transparent'
      : active
        ? '#1C8376'
        : t.color.border;

  const textColor =
    variant === 'primary'
      ? '#FFFFFF'
      : active
        ? '#000000'
        : t.color.muted;

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          width: '100%',
          height,
          borderRadius: radius,
          paddingHorizontal: 16,
          alignItems: 'center',
          justifyContent: 'center',
          // Secondary buttons should stay white (not a dark fill) even when active.
          backgroundColor:
            variant === 'primary'
              ? t.color.brand
              : pressed && !isDisabled
                ? 'rgba(148,163,184,0.10)'
                : '#FFFFFF',
          borderWidth: 1,
          borderColor,
          opacity: isDisabled ? 0.5 : pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      <TotlText
        style={{
          fontFamily: 'Gramatika-Medium',
          fontSize: 16,
          lineHeight: 22,
          fontWeight: '900',
          color: textColor,
          textAlign: 'center',
        }}
      >
        {title}
      </TotlText>
    </Pressable>
  );
}

