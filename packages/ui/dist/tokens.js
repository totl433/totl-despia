export const tokens = {
    color: {
        brand: '#1C8376',
        // Web dark mode base: slate-900
        background: '#0F172A',
        // Web card surface: slate-800
        surface: '#1E293B',
        // Web elevated / border-y surface: slate-700
        surface2: '#334155',
        text: '#F8FAFC',
        muted: '#94A3B8',
        border: 'rgba(148,163,184,0.25)',
        danger: '#DC2626',
        warning: '#F59E0B',
        success: '#10B981',
    },
    space: {
        0: 0,
        1: 4,
        2: 8,
        3: 12,
        4: 16,
        5: 20,
        6: 24,
        8: 32,
        10: 40,
        12: 48,
    },
    radius: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 20,
        pill: 999,
    },
    font: {
        // Match web: Gramatika for UI, PressStart2P for "old school" bits.
        // On mobile, these are loaded via `expo-font` in the Expo app.
        body: 'Gramatika-Regular',
        heading: 'Gramatika-Bold',
        mono: 'PressStart2P-Regular',
    },
};
