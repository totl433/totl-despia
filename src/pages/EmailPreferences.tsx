import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { NotificationSection } from '../components/profile/NotificationSection';
import type { NotificationOption } from '../components/profile/NotificationSection';
import { PageHeader } from '../components/PageHeader';

export default function EmailPreferences() {
  const { user } = useAuth();
  const [emailPreferences, setEmailPreferences] = useState<NotificationOption[]>([
    {
      id: 'new-gameweek',
      label: 'New Gameweek Published',
      description: 'Email me when new fixtures are ready.',
      enabled: true,
    },
    {
      id: 'results-published',
      label: 'Results Published',
      description: 'Email me when results and league tables are updated.',
      enabled: true,
    },
    {
      id: 'news-updates',
      label: 'TOTL News & Updates',
      description: 'Occasional emails about new features and announcements.',
      enabled: true,
    },
  ]);

  function handleToggle(id: string, enabled: boolean) {
    // TODO: Wire up to backend when ready
    setEmailPreferences((prev) =>
      prev.map((opt) => (opt.id === id ? { ...opt, enabled } : opt))
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <p className="text-slate-600">Please sign in to view your email preferences.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto p-6">
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span>Back to Profile</span>
        </Link>
        <PageHeader title="Email Preferences" as="h1" className="mb-6" />

        <div className="space-y-6">
          <NotificationSection
            title="Email Preferences"
            description="Choose which emails you'd like to receive from TOTL"
            options={emailPreferences}
            onToggle={handleToggle}
          />
        </div>
      </div>
    </div>
  );
}
