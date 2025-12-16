import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NotificationSection } from '../components/profile/NotificationSection';
import type { NotificationOption } from '../components/profile/NotificationSection';
import { PageHeader } from '../components/PageHeader';
import { getEffectivePushState, type EffectivePushState } from '../lib/pushNotificationsV2';

export default function NotificationCentre() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushState, setPushState] = useState<EffectivePushState | null>(null);
  const [chatNotifications, setChatNotifications] = useState<NotificationOption[]>([
    {
      id: 'chat-messages',
      label: 'Chat Messages',
      description: 'Get notified when someone sends a message in your mini-leagues',
      enabled: true,
    },
  ]);
  const [gameNotifications, setGameNotifications] = useState<NotificationOption[]>([
    {
      id: 'new-gameweek',
      label: 'New Gameweek Published',
      description: 'Get notified when a new gameweek is published and ready for predictions',
      enabled: true,
    },
    {
      id: 'score-updates',
      label: 'Score Updates',
      description: 'Get notified when match scores are updated',
      enabled: true,
    },
    {
      id: 'final-whistle',
      label: 'Final Whistle',
      description: 'Get notified when matches finish',
      enabled: true,
    },
    {
      id: 'gw-results',
      label: 'Gameweek Results',
      description: 'Get notified when a gameweek is finalized',
      enabled: true,
    },
  ]);
  const [systemNotifications] = useState<NotificationOption[]>([
    {
      id: 'system-updates',
      label: 'System Updates',
      description: 'Important updates and announcements',
      enabled: true,
      disabled: true, // System notifications can't be disabled
    },
  ]);

  useEffect(() => {
    if (user) {
      loadNotificationPreferences();
      loadPushState();
    }
  }, [user]);

  async function loadPushState() {
    const state = await getEffectivePushState(user?.id || null);
    setPushState(state);
  }

  async function loadNotificationPreferences() {
    if (!user) return;

    try {
      // Load user notification preferences from database
      // For now, we'll use a simple approach - you can extend this with a proper table later
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine for first-time users
        console.error('Error loading preferences:', error);
      }

      if (data) {
        // Update preferences from database
        const prefs = data.preferences || {};
        
        setChatNotifications([
          {
            id: 'chat-messages',
            label: 'Chat Messages',
            description: 'Get notified when someone sends a message in your mini-leagues',
            enabled: prefs['chat-messages'] !== false,
          },
        ]);

        setGameNotifications([
          {
            id: 'new-gameweek',
            label: 'New Gameweek Published',
            description: 'Get notified when a new gameweek is published and ready for predictions',
            enabled: prefs['new-gameweek'] !== false,
          },
          {
            id: 'score-updates',
            label: 'Score Updates',
            description: 'Get notified when match scores are updated',
            enabled: prefs['score-updates'] !== false,
          },
          {
            id: 'final-whistle',
            label: 'Final Whistle',
            description: 'Get notified when matches finish',
            enabled: prefs['final-whistle'] !== false,
          },
          {
            id: 'gw-results',
            label: 'Gameweek Results',
            description: 'Get notified when a gameweek is finalized',
            enabled: prefs['gw-results'] !== false,
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(section: 'chat' | 'game' | 'system', id: string, enabled: boolean) {
    if (!user) return;

    setSaving(true);

    try {
      // Update local state immediately for better UX
      if (section === 'chat') {
        setChatNotifications((prev) =>
          prev.map((opt) => (opt.id === id ? { ...opt, enabled } : opt))
        );
      } else if (section === 'game') {
        setGameNotifications((prev) =>
          prev.map((opt) => (opt.id === id ? { ...opt, enabled } : opt))
        );
      }

      // Save to database
      const allOptions = [...chatNotifications, ...gameNotifications, ...systemNotifications];
      const preferences: Record<string, boolean> = {};
      allOptions.forEach((opt) => {
        if (opt.id === id) {
          preferences[opt.id] = enabled;
        } else {
          preferences[opt.id] = opt.enabled;
        }
      });

      const { error } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: user.id,
          preferences,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error('Error saving preferences:', error);
        // Revert local state on error
        if (section === 'chat') {
          setChatNotifications((prev) =>
            prev.map((opt) => (opt.id === id ? { ...opt, enabled: !enabled } : opt))
          );
        } else if (section === 'game') {
          setGameNotifications((prev) =>
            prev.map((opt) => (opt.id === id ? { ...opt, enabled: !enabled } : opt))
          );
        }
      }
    } catch (error) {
      console.error('Error toggling notification:', error);
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <p className="text-slate-600">Please sign in to view your notification preferences.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <p className="text-slate-600">Loading notification preferences...</p>
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
        <PageHeader title="Notification Centre" as="h1" className="mb-6" />

        {/* Push Notification Status Banner */}
        {pushState && (
          <div className={`rounded-xl p-4 mb-6 ${
            pushState.effectiveState === 'allowed' 
              ? 'bg-green-50 border border-green-200' 
              : pushState.effectiveState === 'muted_by_os'
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-slate-50 border border-slate-200'
          }`}>
            <div className="flex items-start gap-3">
              {pushState.effectiveState === 'allowed' ? (
                <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : pushState.effectiveState === 'muted_by_os' ? (
                <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-slate-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <div className="flex-1">
                <h3 className={`font-semibold ${
                  pushState.effectiveState === 'allowed' 
                    ? 'text-green-800' 
                    : pushState.effectiveState === 'muted_by_os'
                    ? 'text-amber-800'
                    : 'text-slate-700'
                }`}>
                  {pushState.effectiveState === 'allowed' 
                    ? 'Push Notifications Enabled' 
                    : pushState.effectiveState === 'muted_by_os'
                    ? 'Push Notifications Blocked'
                    : 'Push Notifications Unavailable'}
                </h3>
                <p className={`text-sm mt-1 ${
                  pushState.effectiveState === 'allowed' 
                    ? 'text-green-700' 
                    : pushState.effectiveState === 'muted_by_os'
                    ? 'text-amber-700'
                    : 'text-slate-600'
                }`}>
                  {pushState.effectiveState === 'allowed' 
                    ? 'You will receive push notifications based on your preferences below.' 
                    : pushState.effectiveState === 'muted_by_os'
                    ? 'Notifications are blocked at the iOS level. Please enable them in Settings → Notifications → TotL.'
                    : 'Push notifications require the TotL app. Download it to receive notifications.'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <NotificationSection
            title="Chat Notifications"
            description="Control when you receive notifications for mini-league messages"
            options={chatNotifications}
            onToggle={(id, enabled) => handleToggle('chat', id, enabled)}
          />

          <NotificationSection
            title="Game Notifications"
            description="Stay updated on match results and scores"
            options={gameNotifications}
            onToggle={(id, enabled) => handleToggle('game', id, enabled)}
          />

          <NotificationSection
            title="System Notifications"
            description="Important updates and announcements"
            options={systemNotifications}
            onToggle={(id, enabled) => handleToggle('system', id, enabled)}
          />
        </div>

        {saving && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-sm text-blue-800">Saving preferences...</p>
          </div>
        )}
      </div>
    </div>
  );
}

