import React from 'react';
import { Switch, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

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

  const preferences = data?.preferences ?? {};
  const setPref = (key: string, value: boolean) => {
    update.mutate({ ...preferences, [key]: value });
  };

  return (
    <Screen fullBleed>
      <TotlText variant="heading" style={{ paddingHorizontal: t.space[4], marginBottom: 8 }}>
        Profile
      </TotlText>

      <View style={{ padding: t.space[4] }}>
        {isLoading && <TotlText variant="muted">Loading…</TotlText>}
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
      </View>
    </Screen>
  );
}

