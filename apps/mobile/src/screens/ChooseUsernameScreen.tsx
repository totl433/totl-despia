import React, { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import HeaderTotlLogo from '../components/HeaderTotlLogo';
import { useThemePreference } from '../context/ThemePreferenceContext';
import { supabase } from '../lib/supabase';
import { saveUsername } from '../lib/userProfile';

export default function ChooseUsernameScreen({ onComplete }: { onComplete: () => void }) {
  const t = useTokens();
  const { isDark } = useThemePreference();
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) throw new Error('Please sign in again.');
      await saveUsername(userId, displayName);
      onComplete();
    } catch (e: unknown) {
      Alert.alert('Could not save username', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ marginBottom: 32, alignItems: 'center' }}>
        <HeaderTotlLogo width={207} height={65} />
      </View>
      <TotlText variant="heading" style={{ marginBottom: 12 }}>
        Choose your username
      </TotlText>
      <TotlText variant="muted" style={{ marginBottom: 16, color: t.color.text }}>
        This is how you appear on leaderboards and in mini leagues. You need one before you can play.
      </TotlText>

      <Card>
        <TotlText style={{ marginBottom: 8 }}>Username</TotlText>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          keyboardAppearance={isDark ? 'dark' : 'light'}
          selectionColor={t.color.brand}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="e.g. Thomas"
          placeholderTextColor={t.color.muted}
          style={{
            borderWidth: 1,
            borderColor: t.color.border,
            borderRadius: 12,
            padding: 12,
            backgroundColor: t.color.background,
            color: t.color.text,
            letterSpacing: 0,
            marginBottom: 16,
          }}
        />
        <Button title={busy ? 'Please wait…' : 'Continue'} onPress={submit} disabled={busy} />
      </Card>
    </Screen>
  );
}
