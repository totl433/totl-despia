import { type ViewProps } from 'react-native';
export type ScreenProps = ViewProps & {
    fullBleed?: boolean;
    /** Override the default theme background (SafeArea + content). */
    backgroundColor?: string;
};
export declare function Screen({ style, children, fullBleed, backgroundColor, ...props }: ScreenProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Screen.d.ts.map