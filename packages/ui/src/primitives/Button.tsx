import React from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import { TotlText } from './TotlText';
import { useTokens } from '../theme/ThemeProvider';

export type ButtonProps = PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md';
  loading?: boolean;
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const t = useTokens();
  const bg = variant === 'primary' ? t.color.brand : 'transparent';
  const borderColor = variant === 'primary' ? 'transparent' : t.color.border;
  const isDisabled = disabled || loading;

  const padY = size === 'sm' ? t.space[2] : t.space[3];
  const padX = size === 'sm' ? t.space[4] : t.space[5];

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: 1,
          borderRadius: t.radius.pill,
          paddingVertical: padY,
          paddingHorizontal: padX,
          minHeight: 44,
          opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      <View>
        <TotlText
          variant="body"
          style={{
            color: variant === 'primary' ? '#FFFFFF' : t.color.text,
            fontWeight: '700',
          }}
        >
          {loading ? 'Loading…' : title}
        </TotlText>
      </View>
    </Pressable>
  );
}

