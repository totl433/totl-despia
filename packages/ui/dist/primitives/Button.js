import { jsx as _jsx } from "react/jsx-runtime";
import { Pressable, View } from 'react-native';
import { TotlText } from './TotlText';
import { useTokens } from '../theme/ThemeProvider';
export function Button({ title, variant = 'primary', style, ...props }) {
    const t = useTokens();
    const bg = variant === 'primary' ? t.color.brand : 'transparent';
    const borderColor = variant === 'primary' ? 'transparent' : t.color.muted;
    return (_jsx(Pressable, { ...props, style: ({ pressed }) => [
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
        ], children: _jsx(View, { children: _jsx(TotlText, { variant: "body", style: { color: variant === 'primary' ? '#FFFFFF' : t.color.text, fontWeight: '600' }, children: title }) }) }));
}
