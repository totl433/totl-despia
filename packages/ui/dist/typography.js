/**
 * Single source of truth for TOTL text variants.
 * Used by `TotlText` in the app AND by Storybook docs (web) so they stay in sync.
 */
export const TOTL_TEXT_VARIANTS = [
    {
        variant: 'heading',
        fontSize: 36,
        lineHeight: 44,
        fontWeight: '700',
        fontRole: 'heading',
        colorRole: 'text',
        note: 'Large page heading (rare in the app).',
    },
    {
        variant: 'sectionTitle',
        fontSize: 20,
        lineHeight: 30,
        fontWeight: '700',
        letterSpacing: 0,
        textTransform: 'uppercase',
        fontRole: 'heading',
        colorRole: 'text',
        note: 'Section header e.g. LEADERBOARDS / MINI LEAGUES.',
    },
    {
        variant: 'sectionSubtitle',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '700',
        fontRole: 'body',
        colorRole: 'muted',
        note: 'Small line under section title e.g. "Gameweek 22 Live Tables".',
    },
    {
        variant: 'section',
        fontSize: 24,
        lineHeight: 30,
        fontWeight: '700',
        fontRole: 'heading',
        colorRole: 'text',
        note: 'Legacy section heading (kept for compatibility).',
    },
    {
        variant: 'body',
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '400',
        fontRole: 'body',
        colorRole: 'text',
    },
    {
        variant: 'muted',
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '400',
        fontRole: 'body',
        colorRole: 'muted',
    },
    {
        variant: 'caption',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '400',
        fontRole: 'body',
        colorRole: 'muted',
    },
    {
        variant: 'micro',
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '600',
        fontRole: 'body',
        colorRole: 'text',
        note: 'Small utility/meta text (e.g. scorers list).',
    },
    {
        variant: 'microMuted',
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '600',
        fontRole: 'body',
        colorRole: 'muted',
        note: 'Small muted utility/meta text (e.g. scorers list).',
    },
];
export function getTotlTextVariantSpec(variant) {
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
