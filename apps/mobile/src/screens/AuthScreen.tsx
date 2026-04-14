import React, { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';
import { useThemePreference } from '../context/ThemePreferenceContext';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const t = useTokens();
  const { isDark } = useThemePreference();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const inputStyle = {
    borderWidth: 1,
    borderColor: t.color.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: t.color.background,
    color: t.color.text,
    letterSpacing: 0,
  } as const;

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('Check your email', 'Confirm your email address to finish sign up.');
      }
    } catch (e: any) {
      Alert.alert('Auth failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TotlText variant="heading" style={{ marginBottom: 12 }}>
        TOTL
      </TotlText>
      <TotlText variant="muted" style={{ marginBottom: 16, color: t.color.text }}>
        {mode === 'signIn' ? 'Sign in to continue' : 'Create your account'}
      </TotlText>

      <Card>
        <TotlText style={{ marginBottom: 8 }}>Email</TotlText>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          keyboardAppearance={isDark ? 'dark' : 'light'}
          selectionColor={t.color.brand}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={t.color.muted}
          style={{
            ...inputStyle,
            marginBottom: 12,
          }}
        />

        <TotlText style={{ marginBottom: 8 }}>Password</TotlText>
        <TextInput
          secureTextEntry
          keyboardAppearance={isDark ? 'dark' : 'light'}
          selectionColor={t.color.brand}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={t.color.muted}
          style={{
            ...inputStyle,
            marginBottom: 16,
          }}
        />

        <Button title={busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Sign up'} onPress={submit} disabled={busy} />

        <View style={{ height: 12 }} />

        <Button
          title={mode === 'signIn' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          variant="secondary"
          onPress={() => setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'))}
          disabled={busy}
        />
      </Card>
    </Screen>
  );
}

