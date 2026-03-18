import React from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import CenteredSpinner from '../../components/CenteredSpinner';
import { TotlRefreshControl } from '../../lib/refreshControl';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';

export default function NotificationCentreScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => api.getNotificationPrefs(),
  });

  const [localPrefs, setLocalPrefs] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    if (!data) return;
    setLocalPrefs(data.preferences ?? {});
  }, [data]);

  const localPrefsRef = React.useRef(localPrefs);
  const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  const pendingSaveCountRef = React.useRef(0);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    localPrefsRef.current = localPrefs;
  }, [localPrefs]);

  const setPref = (key: string, value: boolean) => {
    const next = { ...(localPrefsRef.current ?? {}), [key]: value };
    localPrefsRef.current = next;
    setLocalPrefs(next);

    pendingSaveCountRef.current += 1;
    setIsSaving(true);
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        await api.updateNotificationPrefs({ preferences: next });
        await refetch();
      } catch {
        await refetch();
      } finally {
        pendingSaveCountRef.current -= 1;
        if (pendingSaveCountRef.current <= 0) {
          pendingSaveCountRef.current = 0;
          setIsSaving(false);
        }
      }
    });
  };

  if (isLoading && !data && !error) {
    return (
      <Screen fullBleed>
        <PageHeader
          title="Notification Centre"
          leftAction={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons name="chevron-back" size={24} color={t.color.text} />
            </Pressable>
          }
        />
        <CenteredSpinner loading />
      </Screen>
    );
  }

  const Section = ({
    title,
    description,
    options,
  }: {
    title: string;
    description?: string;
    options: Array<{ id: string; label: string; description: string; disabled?: boolean }>;
  }) => (
    <Card style={{ marginBottom: 12, padding: 16 }}>
      <TotlText variant="heading" style={{ marginBottom: 6 }}>
        {title}
      </TotlText>
      {description ? (
        <TotlText variant="muted" style={{ marginBottom: 10 }}>
          {description}
        </TotlText>
      ) : null}

      <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(148,163,184,0.25)' }}>
        {options.map((opt, idx) => {
          const isLast = idx === options.length - 1;
          const enabled = opt.disabled ? true : localPrefs[opt.id] !== false;
          return (
            <View
              key={opt.id}
              style={{
                paddingVertical: 12,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: 'rgba(148,163,184,0.18)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <TotlText style={{ fontWeight: '800' }}>{opt.label}</TotlText>
                  <TotlText variant="muted" style={{ marginTop: 4 }}>
                    {opt.description}
                  </TotlText>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={(v) => setPref(opt.id, v)}
                  disabled={!!opt.disabled || isSaving}
                />
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );

  return (
    <Screen fullBleed>
      <PageHeader
        title="Notification Centre"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={24} color={t.color.text} />
          </Pressable>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: t.space[4],
          paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
        }}
        refreshControl={<TotlRefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Card style={{ marginBottom: 12 }}>
            <TotlText variant="heading" style={{ marginBottom: 6 }}>
              Couldn’t load notification preferences
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 12 }}>
              {String((error as any)?.message ?? 'Unknown error')}
            </TotlText>
            <Button title="Retry" onPress={() => refetch()} loading={isRefetching} />
          </Card>
        ) : null}

        <Section
          title="Mini Leagues"
          description="Chat and league events."
          options={[
            {
              id: 'chat-messages',
              label: 'Chat Messages',
              description: 'Get notified when someone sends a message in your mini-leagues',
            },
            {
              id: 'mini-league-updates',
              label: 'Mini League Updates',
              description: 'Get notified about new members and when everyone has submitted',
            },
          ]}
        />

        <Section
          title="Games"
          description="Match and gameweek updates."
          options={[
            {
              id: 'new-gameweek',
              label: 'New Gameweek Published',
              description: 'Get notified when a new gameweek is published and ready for predictions',
            },
            {
              id: 'prediction-reminder',
              label: 'Prediction Reminders',
              description: 'Get a reminder 5 hours before the deadline to make your predictions',
            },
            {
              id: 'score-updates',
              label: 'Match Updates',
              description: 'Get notified about match updates including kickoffs, goals, and scorers',
            },
            {
              id: 'final-whistle',
              label: 'Final Whistle',
              description: 'Get notified when matches finish',
            },
            {
              id: 'gw-results',
              label: 'Gameweek Results',
              description: 'Get notified when a gameweek is finalized',
            },
          ]}
        />

        <Section
          title="System"
          description="Important updates and announcements."
          options={[
            {
              id: 'system-updates',
              label: 'System Updates',
              description: "System notifications can't be disabled",
              disabled: true,
            },
          ]}
        />
      </ScrollView>
    </Screen>
  );
}

