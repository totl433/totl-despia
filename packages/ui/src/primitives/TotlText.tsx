import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';

export type TotlTextProps = TextProps & {
  variant?: 'body' | 'muted' | 'heading';
};

export function TotlText({ variant = 'body', style, ...props }: TotlTextProps) {
  const t = useTokens();
  const color =
    variant === 'muted' ? t.color.muted : variant === 'heading' ? t.color.text : t.color.text;

  const fontSize = variant === 'heading' ? 20 : 16;
  const fontWeight = variant === 'heading' ? ('700' as const) : ('400' as const);

  return <Text {...props} style={[{ color, fontSize, fontWeight }, style]} />;
}

