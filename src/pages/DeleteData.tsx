/**
 * Account Deletion / Delete Data (Google Play requirement)
 * Route: /delete-data
 *
 * IMPORTANT: Keep this page free of third-party embeds/scripts.
 */
export default function DeleteData() {
  return (
    <div className="min-h-screen bg-[#f5f7f6] dark:bg-slate-900 p-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-[#1C8376] dark:text-emerald-400">
            Delete your TOTL account
          </h1>
          <p className="text-slate-700 dark:text-slate-200">
            This page explains how to request deletion of your <span className="font-semibold">TOTL (Top of the League)</span>{' '}
            account and associated data.
          </p>
        </header>

        <hr className="border-slate-200 dark:border-slate-700" />

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            How to request deletion
          </h2>
          <ol className="list-decimal pl-5 space-y-2 text-slate-700 dark:text-slate-200">
            <li>
              Email{' '}
              <a
                className="text-[#1C8376] dark:text-emerald-400 underline"
                href="mailto:hello+support@playtotl.com?subject=Delete%20my%20TOTL%20account"
              >
                hello+support@playtotl.com
              </a>{' '}
              with the subject <span className="font-semibold">Delete my TOTL account</span>.
            </li>
            <li>
              Send the request from the same email address you use to sign in to TOTL (so we can verify ownership).
            </li>
            <li>
              If you can’t access that email address, include your TOTL display name and any helpful details so we can
              locate your account.
            </li>
          </ol>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            We may ask for additional verification to prevent unauthorized deletion requests.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">What data is deleted</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-200">
            <li>Your account profile (e.g. email, display name, avatar).</li>
            <li>Your gameplay data (predictions/picks, submissions, and related activity).</li>
            <li>Your mini-league membership and in-app messaging data associated with your account.</li>
            <li>Push notification identifiers associated with your devices (so you stop receiving notifications).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">What we may keep</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-200">
            <li>
              Limited records required for security, fraud prevention, or compliance (for example, logs needed to
              prevent abuse).
            </li>
            <li>
              Purchase records that must be retained for financial/accounting obligations (if applicable to your
              account).
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Timeframe</h2>
          <p className="text-slate-700 dark:text-slate-200">
            We aim to complete deletion requests within <span className="font-semibold">30 days</span>.
          </p>
        </section>

        <footer className="pt-2 text-sm text-slate-500 dark:text-slate-400">© TOTL. All rights reserved.</footer>
      </div>
    </div>
  );
}

