import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import PageHeader from '../../components/PageHeader';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

export default function DeleteAccountScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const [deleting, setDeleting] = React.useState(false);
  const { data } = useQuery({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
    staleTime: 60_000,
  });

  const email = data?.email ?? null;

  const deleteAccount = React.useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.deleteAccount();
      await supabase.auth.signOut().catch(() => {});
      const root = navigation.getParent?.();
      root?.reset?.({ index: 0, routes: [{ name: 'Tabs' }] });
    } catch (error) {
      Alert.alert('Could not delete account', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setDeleting(false);
    }
  }, [deleting, navigation]);

  const confirmDelete = React.useCallback(() => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your TOTL account and personal data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'You will lose access to this account immediately.',
              [
                { text: 'Keep account', style: 'cancel' },
                { text: 'Yes, delete it', style: 'destructive', onPress: () => void deleteAccount() },
              ]
            );
          },
        },
      ]
    );
  }, [deleteAccount]);

  return (
    <Screen fullBleed>
      <PageHeader
        title="Delete Account"
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

      <View style={{ flex: 1, paddingHorizontal: t.space[4], paddingTop: t.space[4] }}>
        <Card style={{ padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 10 }}>
            Delete your TOTL account
          </TotlText>
          <TotlText style={{ color: t.color.muted, fontSize: 14, lineHeight: 20 }}>
            This permanently deletes your account access and personal data from TOTL.
          </TotlText>
          <TotlText style={{ color: t.color.muted, fontSize: 14, lineHeight: 20, marginTop: 10 }}>
            You will lose your profile, predictions, leaderboard history, mini-league memberships and notification settings. This cannot be undone.
          </TotlText>
          {email ? (
            <TotlText style={{ color: t.color.muted, fontSize: 12, lineHeight: 16, marginTop: 12 }}>
              Account: {email}
            </TotlText>
          ) : null}
          <Button title="Delete account" onPress={confirmDelete} loading={deleting} style={{ marginTop: 18 }} />
        </Card>
      </View>
    </Screen>
  );
}
