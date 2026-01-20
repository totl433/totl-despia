import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo } from 'react';
import { tokens as baseTokens } from '../tokens';
const ThemeContext = createContext(baseTokens);
export function ThemeProvider({ tokens, children, }) {
    const value = useMemo(() => {
        if (!tokens)
            return baseTokens;
        return {
            ...baseTokens,
            ...tokens,
            color: { ...baseTokens.color, ...(tokens.color ?? {}) },
            space: { ...baseTokens.space, ...(tokens.space ?? {}) },
            radius: { ...baseTokens.radius, ...(tokens.radius ?? {}) },
            font: { ...baseTokens.font, ...(tokens.font ?? {}) },
        };
    }, [tokens]);
    return _jsx(ThemeContext.Provider, { value: value, children: children });
}
export function useTokens() {
    return useContext(ThemeContext);
}
