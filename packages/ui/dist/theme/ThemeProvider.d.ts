import React from 'react';
import { tokens as baseTokens } from '../tokens';
export type Tokens = typeof baseTokens;
type TokensOverride = {
    /**
     * Widen values for overrides (base tokens are typed as string/number literals).
     */
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
export declare function useTokens(): {
    readonly color: {
        readonly brand: "#1C8376";
        readonly background: "#0F172A";
        readonly surface: "#1E293B";
        readonly surface2: "#334155";
        readonly text: "#F8FAFC";
        readonly muted: "#94A3B8";
        readonly border: "rgba(148,163,184,0.25)";
        readonly danger: "#DC2626";
        readonly warning: "#F59E0B";
        readonly success: "#10B981";
    };
    readonly space: {
        readonly 0: 0;
        readonly 1: 4;
        readonly 2: 8;
        readonly 3: 12;
        readonly 4: 16;
        readonly 5: 20;
        readonly 6: 24;
        readonly 8: 32;
        readonly 10: 40;
        readonly 12: 48;
    };
    readonly radius: {
        readonly sm: 8;
        readonly md: 12;
        readonly lg: 16;
        readonly xl: 20;
        readonly pill: 999;
    };
    readonly font: {
        readonly body: "Gramatika-Regular";
        readonly heading: "Gramatika-Bold";
        readonly mono: "PressStart2P-Regular";
    };
};
//# sourceMappingURL=ThemeProvider.d.ts.map