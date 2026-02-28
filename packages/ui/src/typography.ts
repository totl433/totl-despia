export type TotlTextVariant =
  | 'body'
  | 'muted'
  | 'caption'
  | 'micro'
  | 'microMuted'
  | 'heading'
  | 'section'
  | 'sectionTitle'
  | 'sectionSubtitle';

export type TotlTypographyFontRole = 'body' | 'heading' | 'regular' | 'medium' | 'bold';
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
export const TOTL_TEXT_VARIANTS: TotlTextVariantSpec[] = [
  {
    variant: 'heading',
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '400',
    fontRole: 'bold',
    colorRole: 'text',
    note: 'Large page heading — uses Gramatika-Bold.',
  },
  {
    variant: 'sectionTitle',
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '400',
    letterSpacing: 0,
    textTransform: 'uppercase',
    fontRole: 'bold',
    colorRole: 'text',
    note: 'Section header e.g. LEADERBOARDS / MINI LEAGUES. Uses Gramatika-Bold.',
  },
  {
    variant: 'sectionSubtitle',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontRole: 'medium',
    colorRole: 'muted',
    note: 'Small line under section title e.g. "Gameweek 22 Live Tables". Uses Gramatika-Medium.',
  },
  {
    variant: 'section',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '400',
    fontRole: 'bold',
    colorRole: 'text',
    note: 'Legacy section heading. Uses Gramatika-Bold.',
  },
  {
    variant: 'body',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    fontRole: 'regular',
    colorRole: 'text',
  },
  {
    variant: 'muted',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    fontRole: 'regular',
    colorRole: 'muted',
  },
  {
    variant: 'caption',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontRole: 'regular',
    colorRole: 'muted',
  },
  {
    variant: 'micro',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontRole: 'medium',
    colorRole: 'text',
    note: 'Small utility/meta text (e.g. scorers list). Uses Gramatika-Medium.',
  },
  {
    variant: 'microMuted',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontRole: 'medium',
    colorRole: 'muted',
    note: 'Small muted utility/meta text. Uses Gramatika-Medium.',
  },
];

export function getTotlTextVariantSpec(variant: TotlTextVariant): TotlTextVariantSpec {
  const spec = TOTL_TEXT_VARIANTS.find((v) => v.variant === variant);
  if (!spec) {
    // Should never happen (variant is a union), but keep runtime safe.
    return {
      variant,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '400',
      fontRole: 'body',
      colorRole: 'text',
    };
  }
  return spec;
}

