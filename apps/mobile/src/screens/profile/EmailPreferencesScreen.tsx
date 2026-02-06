import React from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import CenteredSpinner from '../../components/CenteredSpinner';
import { TotlRefreshControl } from '../../lib/refreshControl';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';

export default function EmailPreferencesScreen() {
  const t = useTokens();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['email-preferences'],
    queryFn: () => api.getEmailPreferences(),
  });

  const [localPrefs, setLocalPrefs] = React.useState({ new_gameweek: false, results_published: false, news_updates: false });
  React.useEffect(() => {
    if (!data?.preferences) return;
    setLocalPrefs(data.preferences);
  }, [data?.preferences]);

  const update = useMutation({
    mutationFn: async (next: Partial<typeof localPrefs>) => {
      const merged = { ...localPrefs, ...next };
      setLocalPrefs(merged);
      const res = await api.updateEmailPreferences(next);
      return res.preferences;
    },
    onSuccess: () => refetch(),
  });

  if (isLoading && !data && !error) {
    return (
      <Screen fullBleed>
        <PageHeader title="Email Preferences" />
        <CenteredSpinner loading />
      </Screen>
    );
  }

  const options: Array<{ id: keyof typeof localPrefs; label: string; description: string }> = [
    { id: 'new_gameweek', label: 'New Gameweek Published', description: 'Email me when new fixtures are ready.' },
    { id: 'results_published', label: 'Results Published', description: 'Email me when results and league tables are updated.' },
    { id: 'news_updates', label: 'TOTL News & Updates', description: 'Occasional emails about new features and announcements.' },
  ];

  return (
    <Screen fullBleed>
      <PageHeader title="Email Preferences" />

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
              Couldn’t load email preferences
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 12 }}>
              {String((error as any)?.message ?? 'Unknown error')}
            </TotlText>
            <Button title="Retry" onPress={() => refetch()} loading={isRefetching} />
          </Card>
        ) : null}

        <Card style={{ marginBottom: 12, padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 6 }}>
            Email Preferences
          </TotlText>
          <TotlText variant="muted" style={{ marginBottom: 10 }}>
            Choose which emails you'd like to receive from TOTL
          </TotlText>

          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(148,163,184,0.25)' }}>
            {options.map((opt, idx) => {
              const isLast = idx === options.length - 1;
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
                      value={!!localPrefs[opt.id]}
                      onValueChange={(v) => update.mutate({ [opt.id]: v } as any)}
                      disabled={update.isPending}
                    />
                  </View>
                </View>
              );
            })}
          </View>

          {update.isPending ? (
            <TotlText variant="muted" style={{ marginTop: 10, textAlign: 'center' }}>
              Saving preferences…
            </TotlText>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

