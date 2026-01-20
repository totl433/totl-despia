export type TotlTextVariant = 'body' | 'muted' | 'caption' | 'micro' | 'microMuted' | 'heading' | 'section' | 'sectionTitle' | 'sectionSubtitle';
export type TotlTypographyFontRole = 'body' | 'heading';
export type TotlTypographyColorRole = 'text' | 'muted';
export type TotlTextVariantSpec = {
    variant: TotlTextVariant;
    fontSize: number;
    lineHeight: number;
    fontWeight: '400' | '600' | '700' | '800' | '900';
    letterSpacing?: number;
    textTransform?: 'none' | 'uppercase';
    fontRole: TotlTypographyFontRole;
    colorRole: TotlTypographyColorRole;
    /** Optional short note for docs. */
    note?: string;
};
/**
 * Single source of truth for TOTL text variants.
 * Used by `TotlText` in the app AND by Storybook docs (web) so they stay in sync.
 */
export declare const TOTL_TEXT_VARIANTS: TotlTextVariantSpec[];
export declare function getTotlTextVariantSpec(variant: TotlTextVariant): TotlTextVariantSpec;
//# sourceMappingURL=typography.d.ts.map