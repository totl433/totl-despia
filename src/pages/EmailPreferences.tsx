import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NotificationSection } from '../components/profile/NotificationSection';
import type { NotificationOption } from '../components/profile/NotificationSection';
import { PageHeader } from '../components/PageHeader';
import { supabase } from '../lib/supabase';

export default function EmailPreferences() {
  const { user } = useAuth();
  const [emailPreferences, setEmailPreferences] = useState<NotificationOption[]>([
    {
      id: 'new-gameweek',
      label: 'New Gameweek Published',
      description: 'Email me when new fixtures are ready.',
      enabled: false,
    },
    {
      id: 'results-published',
      label: 'Results Published',
      description: 'Email me when results and league tables are updated.',
      enabled: false,
    },
    {
      id: 'news-updates',
      label: 'TOTL News & Updates',
      description: 'Occasional emails about new features and announcements.',
      enabled: false,
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Map preference IDs to database column names
  const preferenceIdToColumn: Record<string, 'new_gameweek' | 'results_published' | 'news_updates'> = {
    'new-gameweek': 'new_gameweek',
    'results-published': 'results_published',
    'news-updates': 'news_updates',
  };

  // Fetch preferences from database on mount
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchPreferences();
  }, [user]);

  // Helper function to sync preferences to MailerLite
  async function syncToMailerLite(_preferences: Record<string, boolean>) {
    if (!user) return;

    try {
      // Get Supabase session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('[EmailPreferences] No session token, skipping MailerLite sync');
        return;
      }

      // Determine function URL - use production URL in dev, or relative path in production
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const functionUrl = isDevelopment 
        ? 'https://playtotl.com/.netlify/functions/syncEmailPreferences'
        : '/.netlify/functions/syncEmailPreferences';

      // Call Netlify function to sync preferences
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MailerLite sync failed: ${response.status} ${errorText}`);
      }

      console.log('[EmailPreferences] Successfully synced preferences to MailerLite');
    } catch (error) {
      // Log error but don't throw - MailerLite sync failure shouldn't break the UI
      console.error('[EmailPreferences] Error syncing to MailerLite:', error);
    }
  }

  async function fetchPreferences() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('email_preferences')
        .select('new_gameweek, results_published, news_updates')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error fetching email preferences:', error);
        // Continue with defaults if error
      }

      // Update state with fetched preferences or defaults
      if (data) {
        setEmailPreferences([
          {
            id: 'new-gameweek',
            label: 'New Gameweek Published',
            description: 'Email me when new fixtures are ready.',
            enabled: data.new_gameweek ?? false,
          },
          {
            id: 'results-published',
            label: 'Results Published',
            description: 'Email me when results and league tables are updated.',
            enabled: data.results_published ?? false,
          },
          {
            id: 'news-updates',
            label: 'TOTL News & Updates',
            description: 'Occasional emails about new features and announcements.',
            enabled: data.news_updates ?? false,
          },
        ]);
      }
      // If no data, keep defaults (all false - opted out by default)
    } catch (error) {
      console.error('Error fetching email preferences:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    if (!user) return;

    // Optimistically update UI
    setEmailPreferences((prev) =>
      prev.map((opt) => (opt.id === id ? { ...opt, enabled } : opt))
    );

    // Get the database column name
    const columnName = preferenceIdToColumn[id];
    if (!columnName) {
      console.error('Unknown preference ID:', id);
      return;
    }

    // Save to database
    setSaving(true);
    try {
      // Build update data with all current preferences to preserve others
      const currentPrefs = emailPreferences.reduce((acc, pref) => {
        const colName = preferenceIdToColumn[pref.id];
        if (colName) {
          acc[colName] = pref.id === id ? enabled : pref.enabled;
        }
        return acc;
      }, {} as Record<string, boolean>);

      const updateData = {
        user_id: user.id,
        ...currentPrefs,
      };

      // Use upsert to create row if it doesn't exist, or update if it does
      const { error } = await supabase
        .from('email_preferences')
        .upsert(updateData, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error('Error saving email preference:', error);
        // Revert optimistic update on error
        setEmailPreferences((prev) =>
          prev.map((opt) => (opt.id === id ? { ...opt, enabled: !enabled } : opt))
        );
        return;
      }

      // Sync preferences to MailerLite (fire and forget - don't block UI)
      syncToMailerLite(currentPrefs).catch((err) => {
        console.error('Error syncing to MailerLite:', err);
        // Don't revert UI change - preference is saved in DB even if MailerLite sync fails
      });
    } catch (error) {
      console.error('Error saving email preference:', error);
      // Revert optimistic update on error
      setEmailPreferences((prev) =>
        prev.map((opt) => (opt.id === id ? { ...opt, enabled: !enabled } : opt))
      );
    } finally {
      setSaving(false);
    }
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
          {loading ? (
            <div className="bg-white rounded-xl shadow-md p-6 text-center">
              <p className="text-slate-600">Loading preferences...</p>
            </div>
          ) : (
            <NotificationSection
              title="Email Preferences"
              description="Choose which emails you'd like to receive from TOTL"
              options={emailPreferences}
              onToggle={handleToggle}
            />
          )}
          {saving && (
            <div className="text-sm text-slate-500 text-center">
              Saving preferences...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
