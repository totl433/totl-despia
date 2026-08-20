import React, { useRef, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';
import HeaderTotlLogo from '../components/HeaderTotlLogo';
import { useThemePreference } from '../context/ThemePreferenceContext';
import { supabase } from '../lib/supabase';
import { hasSqlLikeWildcards, normalizeDisplayName } from '../lib/displayName';
import { checkDisplayNameAvailable, saveUsername } from '../lib/userProfile';
import { AUTH_CALLBACK_URL } from '../lib/authCallbackUrl';

export default function AuthScreen() {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemePreference();
  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signUp');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

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
        return;
      }

      const trimmedName = normalizeDisplayName(displayName);
      if (!trimmedName) throw new Error('Display name is required.');
      if (hasSqlLikeWildcards(trimmedName)) {
        throw new Error('Display name contains invalid characters. Please remove % or _.');
      }
      if (password !== confirmPassword) throw new Error('Passwords do not match.');
      if (password.length < 6) throw new Error('Password must be at least 6 characters.');

      const available = await checkDisplayNameAvailable(trimmedName);
      if (!available) throw new Error('Username already taken. Please choose a different name.');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: trimmedName },
          emailRedirectTo: AUTH_CALLBACK_URL,
        },
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (userId && data.session) {
        await saveUsername(userId, trimmedName);
      }

      Alert.alert('Check your email', 'Confirm your email address to finish sign up.');
    } catch (e: any) {
      Alert.alert('Auth failed', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bottomOffset={24}
        extraKeyboardSpace={132}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: keyboardVisible ? 12 : 32, alignItems: 'center' }}>
          <HeaderTotlLogo
            width={keyboardVisible ? 132 : 207}
            height={keyboardVisible ? 42 : 65}
          />
        </View>
        <TotlText variant="muted" style={{ marginBottom: 16, color: t.color.text }}>
          {mode === 'signIn' ? 'Sign in to continue' : 'Create your account'}
        </TotlText>

        <Card>
          {mode === 'signUp' ? (
            <>
              <TotlText style={{ marginBottom: 8 }}>Username</TotlText>
              <TextInput
                ref={usernameRef}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username-new"
                textContentType="username"
                autoFocus
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => emailRef.current?.focus()}
                keyboardAppearance={isDark ? 'dark' : 'light'}
                selectionColor={t.color.brand}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="e.g. Thomas"
                placeholderTextColor={t.color.muted}
                style={{
                  ...inputStyle,
                  marginBottom: 12,
                }}
              />
            </>
          ) : null}

          <TotlText style={{ marginBottom: 8 }}>Email</TotlText>
          <TextInput
            ref={emailRef}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            autoFocus={mode === 'signIn'}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
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
            ref={passwordRef}
            secureTextEntry
            autoComplete={mode === 'signUp' ? 'new-password' : 'password'}
            textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
            passwordRules={mode === 'signUp' ? 'minlength: 6;' : undefined}
            returnKeyType={mode === 'signUp' ? 'next' : 'go'}
            blurOnSubmit={mode !== 'signUp'}
            onSubmitEditing={() => {
              if (mode === 'signUp') {
                confirmRef.current?.focus();
                return;
              }
              void submit();
            }}
            keyboardAppearance={isDark ? 'dark' : 'light'}
            selectionColor={t.color.brand}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={t.color.muted}
            style={{
              ...inputStyle,
              marginBottom: mode === 'signUp' ? 12 : 0,
            }}
          />

          {mode === 'signUp' ? (
            <>
              <TotlText style={{ marginBottom: 8 }}>Confirm password</TotlText>
              <TextInput
                ref={confirmRef}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                passwordRules="minlength: 6;"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                keyboardAppearance={isDark ? 'dark' : 'light'}
                selectionColor={t.color.brand}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor={t.color.muted}
                style={inputStyle}
              />
            </>
          ) : null}
        </Card>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: 8 }}>
        <View
          style={{
            paddingTop: 8,
            paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 12),
            backgroundColor: t.color.background,
          }}
        >
          <Button title={busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Sign up'} onPress={submit} disabled={busy} />
          <View style={{ height: 12 }} />
          <Button
            title={mode === 'signIn' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            variant="secondary"
            onPress={() => setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'))}
            disabled={busy}
          />
        </View>
      </KeyboardStickyView>
    </Screen>
  );
}
