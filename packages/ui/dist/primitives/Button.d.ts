import { type PressableProps } from 'react-native';
export type ButtonProps = PressableProps & {
    title: string;
    variant?: 'primary' | 'secondary';
    size?: 'sm' | 'md';
    loading?: boolean;
};
export declare function Button({ title, variant, size, loading, style, disabled, ...props }: ButtonProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=Button.d.ts.map