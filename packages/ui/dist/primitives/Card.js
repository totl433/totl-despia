import { jsx as _jsx } from "react/jsx-runtime";
import { View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
export function Card({ style, ...props }) {
    const t = useTokens();
    return (_jsx(View, { ...props, style: [
            {
                backgroundColor: t.color.surface,
                borderRadius: t.radius.lg,
                padding: t.space[4],
                borderWidth: 1,
                borderColor: t.color.border,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.22,
                shadowRadius: 12,
                elevation: 4,
            },
            style,
        ] }));
}
