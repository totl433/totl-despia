import React from 'react';
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
type TokensOverride = {
    color?: Partial<Record<keyof Tokens['color'], string>>;
    space?: Partial<Record<keyof Tokens['space'], number>>;
    radius?: Partial<Record<keyof Tokens['radius'], number>>;
    font?: Partial<Record<keyof Tokens['font'], string>>;
};
export declare function ThemeProvider({ tokens, children, }: {
    /**
     * Partial override of the base tokens. Nested token groups (`color`, `space`, etc)
     * are merged shallowly so callers can override only what they need.
     */
    tokens?: TokensOverride;
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function useTokens(): Tokens;
export {};
//# sourceMappingURL=ThemeProvider.d.ts.map