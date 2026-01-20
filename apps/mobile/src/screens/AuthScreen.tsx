import React, { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { Button, Card, Screen, TotlText } from '@totl/ui';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

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
      <TotlText variant="muted" style={{ marginBottom: 16 }}>
        {mode === 'signIn' ? 'Sign in to continue' : 'Create your account'}
      </TotlText>

      <Card>
        <TotlText style={{ marginBottom: 8 }}>Email</TotlText>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#64748B"
          style={{
            borderWidth: 1,
            borderColor: 'rgba(148,163,184,0.25)',
            borderRadius: 12,
            padding: 12,
            color: '#F8FAFC',
            marginBottom: 12,
          }}
        />

        <TotlText style={{ marginBottom: 8 }}>Password</TotlText>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#64748B"
          style={{
            borderWidth: 1,
            borderColor: 'rgba(148,163,184,0.25)',
            borderRadius: 12,
            padding: 12,
            color: '#F8FAFC',
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

