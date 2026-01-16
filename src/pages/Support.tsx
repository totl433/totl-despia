/**
 * Support page with FAQs and contact info.
 * Route: /support
 * Usage: <SupportPage />
 */
export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#f5f7f6] dark:bg-slate-900 p-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm space-y-6">
        <header className="space-y-3">
          <h1 className="text-2xl font-bold text-[#1C8376] dark:text-emerald-400">TOTL Support</h1>
          <p className="text-slate-700 dark:text-slate-200">
            Need help with <span className="font-semibold">TOTL</span>? You will find answers to common questions below.
            If you need more help, contact us and we will get back to you as soon as possible.
          </p>
        </header>

        <hr className="border-slate-200 dark:border-slate-700" />

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Frequently Asked Questions</h2>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">How do predictions work?</h3>
            <p className="text-slate-700 dark:text-slate-200">
              Predict the outcome of each Premier League match before kick-off. You score points based on how accurate
              (or confidently wrong) your predictions are.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Can I join a mini league late?</h3>
            <p className="text-slate-700 dark:text-slate-200">
              Yes. Your form is based on recent gameweeks, so you can still compete even if you join after the season
              starts.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">How are points calculated?</h3>
            <p className="text-slate-700 dark:text-slate-200">
              Each gameweek includes 10 fixtures. You score points based on correct outcomes, with totals contributing
              to league and global leaderboards.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              I am not receiving notifications — what should I do?
            </h3>
            <p className="text-slate-700 dark:text-slate-200">Check that notifications are enabled:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-200">
              <li>In your device settings</li>
              <li>Inside the TOTL app</li>
            </ul>
            <p className="text-slate-700 dark:text-slate-200">
              If the issue persists, contact support.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              I have lost access to my account — what should I do?
            </h3>
            <p className="text-slate-700 dark:text-slate-200">
              Use <span className="font-semibold">"Forgot password"</span> on the sign-in screen. If you are still
              stuck, email us from your registered email address.
            </p>
          </div>
        </section>

        <hr className="border-slate-200 dark:border-slate-700" />

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Contact Support</h2>
          <p className="text-slate-700 dark:text-slate-200">
            <span aria-hidden="true">📩</span> <span className="font-semibold">Email:</span>{' '}
            <a className="text-[#1C8376] dark:text-emerald-400 underline" href="mailto:hello@playtotl.com">
              hello@playtotl.com
            </a>
          </p>
          <p className="text-slate-700 dark:text-slate-200">
            We aim to respond within <span className="font-semibold">48 hours</span> (Monday–Friday, GMT).
          </p>
        </section>

        <hr className="border-slate-200 dark:border-slate-700" />

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Account &amp; Data Requests</h2>
          <p className="text-slate-700 dark:text-slate-200">If you would like to:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-200">
            <li>Delete your account</li>
            <li>Request access to your data</li>
          </ul>
          <p className="text-slate-700 dark:text-slate-200">
            Please email{' '}
            <a className="text-[#1C8376] dark:text-emerald-400 underline" href="mailto:hello@playtotl.com">
              hello@playtotl.com
            </a>{' '}
            from the email address linked to your account.
          </p>
        </section>

        <hr className="border-slate-200 dark:border-slate-700" />

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Legal</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-200">
            <li>
              <a className="text-[#1C8376] dark:text-emerald-400 underline" href="https://playtotl.com/privacy-policy">
                Privacy Policy
              </a>
            </li>
            <li>
              <a
                className="text-[#1C8376] dark:text-emerald-400 underline"
                href="https://playtotl.com/terms-and-conditions"
              >
                Terms of Service
              </a>
            </li>
          </ul>
        </section>

        <footer className="pt-2 text-sm text-slate-500 dark:text-slate-400">© TOTL. All rights reserved.</footer>
      </div>
    </div>
  );
}
