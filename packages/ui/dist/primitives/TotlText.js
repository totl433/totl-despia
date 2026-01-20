import { jsx as _jsx } from "react/jsx-runtime";
import { Text } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
export function TotlText({ variant = 'body', style, ...props }) {
    const t = useTokens();
    const color = variant === 'muted' ? t.color.muted : variant === 'heading' ? t.color.text : t.color.text;
    const fontSize = variant === 'heading' ? 20 : 16;
    const fontWeight = variant === 'heading' ? '700' : '400';
    return _jsx(Text, { ...props, style: [{ color, fontSize, fontWeight }, style] });
}
