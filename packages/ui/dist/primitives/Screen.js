import { jsx as _jsx } from "react/jsx-runtime";
import { SafeAreaView, View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
export function Screen({ style, children, ...props }) {
    const t = useTokens();
    return (_jsx(SafeAreaView, { style: { flex: 1, backgroundColor: t.color.background }, children: _jsx(View, { ...props, style: [{ flex: 1, padding: t.space[4] }, style], children: children }) }));
}
