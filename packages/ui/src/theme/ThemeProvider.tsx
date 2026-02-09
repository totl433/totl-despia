import React, { createContext, useContext, useMemo } from 'react';
import { tokens as baseTokens } from '../tokens';

type WidenTokenGroup<T extends Record<string | number, unknown>> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends number ? number : T[K];
};

/**
 * Tokens are keyed like `baseTokens`, but values are widened to `string`/`number`
 * so callers can override them without fighting `as const` literal types.
 */
export type Tokens = {
  color: WidenTokenGroup<typeof baseTokens.color>;
  space: WidenTokenGroup<typeof baseTokens.space>;
  radius: WidenTokenGroup<typeof baseTokens.radius>;
  font: WidenTokenGroup<typeof baseTokens.font>;
};

const ThemeContext = createContext<Tokens>(baseTokens as unknown as Tokens);

type TokensOverride = {
  // Widen values for overrides (base tokens are typed as string/number literals).
  color?: Partial<Record<keyof Tokens['color'], string>>;
  space?: Partial<Record<keyof Tokens['space'], number>>;
  radius?: Partial<Record<keyof Tokens['radius'], number>>;
  font?: Partial<Record<keyof Tokens['font'], string>>;
};

export function ThemeProvider({
  tokens,
  children,
}: {
  /**
   * Partial override of the base tokens. Nested token groups (`color`, `space`, etc)
   * are merged shallowly so callers can override only what they need.
   */
  tokens?: TokensOverride;
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

