import React, { useRef, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';
import HeaderTotlLogo from '../components/HeaderTotlLogo';
import { useThemePreference } from '../context/ThemePreferenceContext';
import { supabase } from '../lib/supabase';
import { hasSqlLikeWildcards, normalizeDisplayName } from '../lib/displayName';
import { checkDisplayNameAvailable, saveUsername } from '../lib/userProfile';
import { AUTH_CALLBACK_URL } from '../lib/authCallbackUrl';
import { env } from '../env';

type AuthMode = 'signIn' | 'signUp' | 'forgot' | 'setNew';

export default function AuthScreen({
  initialMode = 'signUp',
  onPasswordResetComplete,
}: {
  initialMode?: AuthMode;
  onPasswordResetComplete?: () => void;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemePreference();
  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
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

  const heading =
    mode === 'signIn'
      ? 'Sign in to continue'
      : mode === 'signUp'
        ? 'Create your account'
        : mode === 'setNew'
          ? 'Set a new password'
          : 'Reset your password';

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) throw new Error('Please enter your email address.');
        const siteUrl = String(env.EXPO_PUBLIC_SITE_URL).replace(/\/+$/, '');
        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
          // Same landing URL as web so the email works in Safari and opens the app via universal links.
          redirectTo: `${siteUrl}/auth?type=recovery`,
        });
        if (error) throw error;
        setResetEmailSent(true);
        return;
      }

      if (mode === 'setNew') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        Alert.alert('Password updated', 'Your password has been changed.');
        setPassword('');
        setConfirmPassword('');
        if (onPasswordResetComplete) {
          onPasswordResetComplete();
        } else {
          setMode('signIn');
        }
        return;
      }

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

  const cancelPasswordReset = async () => {
    setBusy(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // Still leave the reset screen even if sign-out fails.
    } finally {
      setBusy(false);
      setPassword('');
      setConfirmPassword('');
      setMode('signIn');
      onPasswordResetComplete?.();
    }
  };

  const primaryTitle = busy
    ? 'Please wait…'
    : mode === 'signIn'
      ? 'Sign in'
      : mode === 'signUp'
        ? 'Sign up'
        : mode === 'setNew'
          ? 'Update password'
          : 'Send reset link';

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
          {heading}
        </TotlText>

        {resetEmailSent && mode === 'forgot' ? (
          <Card>
            <TotlText style={{ marginBottom: 8 }}>Check your email</TotlText>
            <TotlText variant="muted">
              We&apos;ve sent a password reset link to {email.trim()}. Tap it on this phone to choose a new password.
            </TotlText>
          </Card>
        ) : (
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

            {mode === 'signIn' || mode === 'signUp' || mode === 'forgot' ? (
              <>
                <TotlText style={{ marginBottom: 8 }}>Email</TotlText>
                <TextInput
                  ref={emailRef}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  autoFocus={mode !== 'signUp'}
                  returnKeyType={mode === 'forgot' ? 'go' : 'next'}
                  blurOnSubmit={mode === 'forgot'}
                  onSubmitEditing={() => {
                    if (mode === 'forgot') {
                      void submit();
                      return;
                    }
                    passwordRef.current?.focus();
                  }}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  selectionColor={t.color.brand}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={t.color.muted}
                  style={{
                    ...inputStyle,
                    marginBottom: mode === 'forgot' ? 0 : 12,
                  }}
                />
              </>
            ) : null}

            {mode === 'signIn' || mode === 'signUp' || mode === 'setNew' ? (
              <>
                <TotlText style={{ marginBottom: 8 }}>{mode === 'setNew' ? 'New password' : 'Password'}</TotlText>
                <TextInput
                  ref={passwordRef}
                  secureTextEntry
                  autoComplete={mode === 'signIn' ? 'password' : 'new-password'}
                  textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                  passwordRules={mode === 'signIn' ? undefined : 'minlength: 6;'}
                  returnKeyType={mode === 'signIn' ? 'go' : 'next'}
                  blurOnSubmit={mode === 'signIn'}
                  onSubmitEditing={() => {
                    if (mode === 'signIn') {
                      void submit();
                      return;
                    }
                    confirmRef.current?.focus();
                  }}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                  selectionColor={t.color.brand}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={t.color.muted}
                  style={{
                    ...inputStyle,
                    marginBottom: mode === 'signIn' ? 8 : 12,
                  }}
                />
              </>
            ) : null}

            {mode === 'signIn' ? (
              <Pressable
                onPress={() => {
                  setResetEmailSent(false);
                  setMode('forgot');
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Forgot password"
              >
                <TotlText style={{ color: t.color.brand, fontSize: 14 }}>Forgot password?</TotlText>
              </Pressable>
            ) : null}

            {mode === 'signUp' || mode === 'setNew' ? (
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
        )}
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: 8 }}>
        <View
          style={{
            paddingTop: 8,
            paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 12),
            backgroundColor: t.color.background,
          }}
        >
          {resetEmailSent && mode === 'forgot' ? (
            <Button
              title="Back to sign in"
              onPress={() => {
                setResetEmailSent(false);
                setMode('signIn');
              }}
              disabled={busy}
            />
          ) : (
            <>
              <Button title={primaryTitle} onPress={submit} disabled={busy} />
              <View style={{ height: 12 }} />
              {mode === 'setNew' ? (
                <Button title="Cancel" variant="secondary" onPress={() => void cancelPasswordReset()} disabled={busy} />
              ) : mode === 'forgot' ? (
                <Button
                  title="Back to sign in"
                  variant="secondary"
                  onPress={() => {
                    setResetEmailSent(false);
                    setMode('signIn');
                  }}
                  disabled={busy}
                />
              ) : (
                <Button
                  title={mode === 'signIn' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
                  variant="secondary"
                  onPress={() => setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'))}
                  disabled={busy}
                />
              )}
            </>
          )}
        </View>
      </KeyboardStickyView>
    </Screen>
  );
}
