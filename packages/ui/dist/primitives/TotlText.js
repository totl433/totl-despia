import { jsx as _jsx } from "react/jsx-runtime";
import { Text } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { getTotlTextVariantSpec } from '../typography';
export function TotlText({ variant = 'body', style, ...props }) {
    const t = useTokens();
    const spec = getTotlTextVariantSpec(variant);
    const color = spec.colorRole === 'muted' ? t.color.muted : t.color.text;
    const fontFamily = spec.fontRole === 'heading' ? t.font.heading : t.font.body;
    const textTransform = spec.textTransform === 'uppercase' ? 'uppercase' : undefined;
    const letterSpacing = typeof spec.letterSpacing === 'number' ? spec.letterSpacing : undefined;
    return (_jsx(Text, { ...props, style: [
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
        ] }));
}
