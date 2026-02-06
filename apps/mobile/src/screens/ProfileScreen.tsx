import React from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';
import { TotlRefreshControl } from '../lib/refreshControl';
import CenteredSpinner from '../components/CenteredSpinner';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../lib/layout';

export default function ProfileScreen() {
  const t = useTokens();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => api.getNotificationPrefs(),
  });

  const update = useMutation({
    mutationFn: (prefs: Record<string, boolean>) => api.updateNotificationPrefs({ preferences: prefs }),
    onSuccess: () => refetch(),
  });

  if (isLoading && !data && !error) {
    return (
      <Screen fullBleed>
        <PageHeader title="Profile" />
        <CenteredSpinner loading />
      </Screen>
    );
  }

  const preferences = data?.preferences ?? {};
  const setPref = (key: string, value: boolean) => {
    update.mutate({ ...preferences, [key]: value });
  };

  return (
    <Screen fullBleed>
      <PageHeader title="Profile" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: t.space[4],
          paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
        }}
        refreshControl={<TotlRefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        {error && (
          <Card style={{ marginBottom: 12 }}>
            <TotlText variant="heading" style={{ marginBottom: 6 }}>
              Couldn’t load profile
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 12 }}>
              {(error as any)?.message ?? 'Unknown error'}
            </TotlText>
            <Button title="Retry" onPress={() => refetch()} loading={isRefetching} />
          </Card>
        )}

        <Card style={{ marginBottom: 12 }}>
          <TotlText variant="heading" style={{ marginBottom: 8 }}>
            Notifications
          </TotlText>

          {(['score-updates', 'final-whistle', 'gw-results'] as const).map((k) => (
            <View
              key={k}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 10,
              }}
            >
              <TotlText>{k}</TotlText>
              <Switch
                value={preferences[k] !== false}
                onValueChange={(v) => setPref(k, v)}
                disabled={update.isPending}
              />
            </View>
          ))}
        </Card>

        <View style={{ gap: 10 }}>
          <Button title="Sign out" onPress={() => supabase.auth.signOut()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

