import { jsx as _jsx } from "react/jsx-runtime";
import { Pressable, View } from 'react-native';
import { TotlText } from './TotlText';
import { useTokens } from '../theme/ThemeProvider';
export function Button({ title, variant = 'primary', size = 'md', loading = false, style, disabled, ...props }) {
    const t = useTokens();
    const bg = variant === 'primary' ? t.color.brand : 'transparent';
    const borderColor = variant === 'primary' ? 'transparent' : t.color.border;
    const isDisabled = disabled || loading;
    const padY = size === 'sm' ? t.space[2] : t.space[3];
    const padX = size === 'sm' ? t.space[4] : t.space[5];
    return (_jsx(Pressable, { ...props, disabled: isDisabled, style: ({ pressed }) => [
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
        ], children: _jsx(View, { children: _jsx(TotlText, { variant: "body", style: {
                    color: variant === 'primary' ? '#FFFFFF' : t.color.text,
                    fontWeight: '700',
                }, children: loading ? 'Loading…' : title }) }) }));
}
