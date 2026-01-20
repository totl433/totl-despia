import React from 'react';
import { Pressable, type PressableProps, View } from 'react-native';
import { TotlText } from './TotlText';
import { useTokens } from '../theme/ThemeProvider';

export type ButtonProps = PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary';
};

export function Button({ title, variant = 'primary', style, ...props }: ButtonProps) {
  const t = useTokens();
  const bg = variant === 'primary' ? t.color.brand : 'transparent';
  const borderColor = variant === 'primary' ? 'transparent' : t.color.muted;

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: 1,
          borderRadius: t.radius.pill,
          paddingVertical: t.space[3],
          paddingHorizontal: t.space[5],
          opacity: pressed ? 0.85 : 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      <View>
        <TotlText variant="body" style={{ color: variant === 'primary' ? '#FFFFFF' : t.color.text, fontWeight: '600' }}>
          {title}
        </TotlText>
      </View>
    </Pressable>
  );
}

