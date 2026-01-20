import React, { createContext, useContext, useMemo } from 'react';
import { tokens as baseTokens } from '../tokens';

export type Tokens = typeof baseTokens;

const ThemeContext = createContext<Tokens>(baseTokens);

export function ThemeProvider({
  tokens,
  children,
}: {
  tokens?: Partial<Tokens>;
  children: React.ReactNode;
}) {
  const value = useMemo(() => {
    if (!tokens) return baseTokens;
    return {
      ...baseTokens,
      ...tokens,
      color: { ...baseTokens.color, ...(tokens.color ?? {}) },
      space: { ...baseTokens.space, ...(tokens.space ?? {}) },
      radius: { ...baseTokens.radius, ...(tokens.radius ?? {}) },
      font: { ...baseTokens.font, ...(tokens.font ?? {}) },
    } satisfies Tokens;
  }, [tokens]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTokens() {
  return useContext(ThemeContext);
}

