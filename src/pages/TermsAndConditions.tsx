/**
 * Terms and Conditions (Despia build)
 * Route: /terms-and-conditions
 *
 * IMPORTANT: This page intentionally contains no third-party embeds/scripts
 * (no Termly / GA / cookie banners) to avoid any tracking/cookie collection
 * inside the iOS WebView during App Review.
 */
export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-[#f5f7f6] dark:bg-slate-900 p-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <h1 className="text-2xl font-bold text-[#1C8376] dark:text-emerald-400">Terms and Conditions</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Last updated: 21 Jan 2026</p>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Overview</h2>
          <p className="text-slate-700 dark:text-slate-200">
            TOTL provides a predictions game and mini-league features. By using the app you agree to use it lawfully and
            respectfully.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Your account</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-200">
            <li>You are responsible for activity under your account.</li>
            <li>Do not abuse the service (spam, harassment, exploitation, or attempts to break security).</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Service availability</h2>
          <p className="text-slate-700 dark:text-slate-200">
            We may update, change, or discontinue parts of the service to improve reliability or comply with platform
            requirements.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Contact</h2>
          <p className="text-slate-700 dark:text-slate-200">
            Questions? Email{' '}
            <a className="text-[#1C8376] dark:text-emerald-400 underline" href="mailto:hello@playtotl.com">
              hello@playtotl.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

