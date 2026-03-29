import { jsx as _jsx } from "react/jsx-runtime";
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTokens } from '../theme/ThemeProvider';
export function Screen({ style, children, fullBleed = false, ...props }) {
    const t = useTokens();
    return (_jsx(SafeAreaView, { edges: ['top', 'left', 'right'], style: { flex: 1, backgroundColor: t.color.background }, children: _jsx(View, { ...props, style: [{ flex: 1, padding: fullBleed ? 0 : t.space[4] }, style], children: children }) }));
}
