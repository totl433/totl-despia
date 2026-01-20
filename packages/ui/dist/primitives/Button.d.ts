import { type PressableProps } from 'react-native';
export type ButtonProps = PressableProps & {
    title: string;
    variant?: 'primary' | 'secondary';
};
export declare function Button({ title, variant, style, ...props }: ButtonProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Button.d.ts.map