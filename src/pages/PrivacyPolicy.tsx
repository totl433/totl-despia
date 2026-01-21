/**
 * Privacy Policy (Despia build)
 * Route: /privacy-policy
 *
 * IMPORTANT: This page intentionally contains no third-party embeds/scripts
 * (no Termly / GA / cookie banners) to avoid any tracking/cookie collection
 * inside the iOS WebView during App Review.
 */
export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#f5f7f6] dark:bg-slate-900 p-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <h1 className="text-2xl font-bold text-[#1C8376] dark:text-emerald-400">Privacy Policy</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Last updated: 21 Jan 2026</p>

        <p className="text-slate-700 dark:text-slate-200">
          TOTL is a football predictions game. We use your data to run the service (accounts, predictions, leaderboards,
          mini-leagues, and notifications).
        </p>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Data we collect</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-200">
            <li>Account details you provide (e.g. email and display name).</li>
            <li>Game activity (predictions, league membership, scores/points).</li>
            <li>Notification identifiers (only if you enable push notifications).</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">How we use data</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-200">
            <li>Provide core gameplay features and show leaderboards.</li>
            <li>Operate mini-leagues and in-app messaging.</li>
            <li>Send service notifications you opt into.</li>
            <li>Maintain security and prevent abuse.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tracking / cookies</h2>
          <p className="text-slate-700 dark:text-slate-200">
            The Despia app build does not load analytics or cookie-consent tools, and does not use tracking cookies in
            the iOS WebView.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Contact</h2>
          <p className="text-slate-700 dark:text-slate-200">
            Questions or requests? Email{' '}
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

