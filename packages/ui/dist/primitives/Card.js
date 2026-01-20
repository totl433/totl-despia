import { jsx as _jsx } from "react/jsx-runtime";
import { View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
export function Card({ style, ...props }) {
    const t = useTokens();
    return (_jsx(View, { ...props, style: [
            {
                backgroundColor: '#0F1B2E',
                borderRadius: t.radius.lg,
                padding: t.space[4],
                borderWidth: 1,
                borderColor: 'rgba(148,163,184,0.2)',
            },
            style,
        ] }));
}
