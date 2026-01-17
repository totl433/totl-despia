import { useTheme } from '../hooks/useTheme';

/**
 * ThemeToggle - Component for switching between themes (System / Light / Dark)
 * 
 * Usage:
 * ```tsx
 * <ThemeToggle />
 * ```
 * 
 * Can be added to settings/profile page or header for manual theme switching.
 */
export default function ThemeToggle() {
  const { theme, setTheme, resetToSystem, isManualOverride } = useTheme();
  const activeMode: 'system' | 'light' | 'dark' = isManualOverride ? theme : 'system';

  return (
    <div className="flex flex-col gap-2">
      <div
        className="inline-flex w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1"
        role="group"
        aria-label="Theme preference"
      >
        <button
          type="button"
          onClick={resetToSystem}
          aria-pressed={activeMode === 'system'}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeMode === 'system'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          System
        </button>
        <button
          type="button"
          onClick={() => setTheme('light')}
          aria-pressed={activeMode === 'light'}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeMode === 'light'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Light
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          aria-pressed={activeMode === 'dark'}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeMode === 'dark'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Dark
        </button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {activeMode === 'system'
          ? `Following system settings (currently ${theme}).`
          : `Currently set to ${theme} mode. Choose “System” to match your device settings.`}
      </p>
    </div>
  );
}

