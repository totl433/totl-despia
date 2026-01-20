import React from 'react';
import { Switch, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Screen, TotlText } from '@totl/ui';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const { data, refetch } = useQuery({
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
    <Screen>
      <TotlText variant="heading" style={{ marginBottom: 12 }}>
        Profile
      </TotlText>

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
              paddingVertical: 8,
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
    </Screen>
  );
}

