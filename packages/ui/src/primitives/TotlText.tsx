import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { getTotlTextVariantSpec, type TotlTextVariant } from '../typography';

export type TotlTextProps = TextProps & {
  variant?: TotlTextVariant;
};

export function TotlText({ variant = 'body', style, ...props }: TotlTextProps) {
  const t = useTokens();
  const spec = getTotlTextVariantSpec(variant);
  const color = spec.colorRole === 'muted' ? t.color.muted : t.color.text;
  const fontFamily = spec.fontRole === 'heading' ? t.font.heading : t.font.body;
  const textTransform = spec.textTransform === 'uppercase' ? ('uppercase' as const) : undefined;
  const letterSpacing = typeof spec.letterSpacing === 'number' ? spec.letterSpacing : undefined;

  return (
    <Text
      {...props}
      style={[
        {
          color,
          fontSize: spec.fontSize,
          lineHeight: spec.lineHeight,
          fontWeight: spec.fontWeight,
          fontFamily,
          textTransform,
          letterSpacing,
        },
        style,
      ]}
    />
  );
}

