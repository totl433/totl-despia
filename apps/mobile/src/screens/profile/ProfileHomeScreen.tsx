import React from 'react';
import { Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/PageHeader';
import CenteredSpinner from '../../components/CenteredSpinner';
import { TotlRefreshControl } from '../../lib/refreshControl';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';

export default function ProfileHomeScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();

  const goHome = React.useCallback(() => {
    const parent = (navigation as any).getParent?.();
    // ProfileNavigator sits inside the RootStack; prefer going back if possible.
    if (parent?.canGoBack?.() ?? false) {
      parent.goBack();
      return;
    }
    // Fallback: explicitly navigate to Tabs → Home.
    parent?.navigate?.('Tabs', { screen: 'Home' });
  }, [navigation]);

  const goEditAvatar = React.useCallback(() => {
    navigation.navigate('EditAvatar');
  }, [navigation]);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfileSummary(),
  });

  const name = data?.name ?? 'User';
  const email = data?.email ?? null;
  const avatarUrl = data?.avatar_url ?? null;
  const isAdmin = data?.isAdmin ?? false;

  const initials = React.useMemo(() => {
    const parts = String(name || '?')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
    return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
  }, [name]);

  const openUrl = React.useCallback(async (url: string) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) return;
      await Linking.openURL(url);
    } catch {
      // ignore
    }
  }, []);

  if (isLoading && !data && !error) {
    return (
      <Screen fullBleed>
        <PageHeader
          title="Profile"
          leftAction={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to home"
              onPress={goHome}
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
        <CenteredSpinner loading />
      </Screen>
    );
  }

  const menuItems: Array<{ label: string; onPress: () => void }> = [
    { label: 'Notification Centre', onPress: () => navigation.navigate('NotificationCentre') },
    { label: 'Email Preferences', onPress: () => navigation.navigate('EmailPreferences') },
    { label: 'How To Play', onPress: () => openUrl('https://playtotl.com/how-to-play') },
    { label: 'Contact Us', onPress: () => openUrl('mailto:hello@playtotl.com') },
    { label: 'Cookie Policy', onPress: () => openUrl('https://playtotl.com/cookie-policy') },
    { label: 'Privacy Policy', onPress: () => openUrl('https://playtotl.com/privacy-policy') },
    { label: 'Terms and Conditions', onPress: () => openUrl('https://playtotl.com/terms-and-conditions') },
    ...(isAdmin ? [{ label: 'Admin Data', onPress: () => openUrl('https://playtotl.com/admin-data') }] : []),
  ];

  return (
    <Screen fullBleed>
      <PageHeader
        title="Profile"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            onPress={goHome}
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
              Couldn’t load profile
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 12 }}>
              {(error as any)?.message ?? 'Unknown error'}
            </TotlText>
            <Button title="Retry" onPress={() => refetch()} loading={isRefetching} />
          </Card>
        ) : null}

        <Card style={{ marginBottom: 12, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit avatar"
              onPress={() => navigation.navigate('EditAvatar')}
              style={({ pressed }) => ({
                width: 74,
                height: 74,
                borderRadius: 999,
                backgroundColor: t.color.surface2,
                borderWidth: 1,
                borderColor: t.color.border,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                opacity: pressed ? 0.92 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              })}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: 74, height: 74 }} />
              ) : (
                <TotlText style={{ fontWeight: '900', fontSize: 20 }}>{initials}</TotlText>
              )}
            </Pressable>

            <View style={{ flex: 1, minWidth: 0 }}>
              <TotlText style={{ fontWeight: '900', fontSize: 20, color: t.color.text }} numberOfLines={1}>
                {name}
              </TotlText>
              {email ? (
                <TotlText variant="muted" numberOfLines={1} style={{ marginTop: 2 }}>
                  {email}
                </TotlText>
              ) : null}
            </View>
          </View>

          <View style={{ height: 12 }} />
          <View style={{ height: 1, backgroundColor: 'rgba(148,163,184,0.25)' }} />
          <View style={{ height: 12 }} />

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TotlText variant="muted">OCP</TotlText>
              <TotlText style={{ fontWeight: '900' }}>{String(Math.round(Number(data?.ocp ?? 0)))}</TotlText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TotlText variant="muted">Mini Leagues</TotlText>
              <TotlText style={{ fontWeight: '900' }}>{String(data?.miniLeaguesCount ?? 0)}</TotlText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TotlText variant="muted">Streak</TotlText>
              <TotlText style={{ fontWeight: '900' }}>{String(data?.weeksStreak ?? 0)}</TotlText>
            </View>
          </View>

          <View style={{ height: 14 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View your stats"
            onPress={() => navigation.navigate('ProfileStats')}
            style={({ pressed }) => ({
              width: '100%',
              height: 54,
              borderRadius: 16,
              backgroundColor: '#1C8376',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 16 }}>View Your Stats</TotlText>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </Card>

        <Card style={{ marginBottom: 12, padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 10 }}>
            Your Account
          </TotlText>
          {email ? (
            <View style={{ paddingBottom: 12, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(148,163,184,0.25)' }}>
              <TotlText variant="muted">{email}</TotlText>
            </View>
          ) : null}

          <View>
            {menuItems.map((item, idx) => {
              const isLast = idx === menuItems.length - 1;
              return (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={item.onPress}
                  style={({ pressed }) => ({
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: pressed ? 0.85 : 1,
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: 'rgba(148,163,184,0.18)',
                  })}
                >
                  <TotlText style={{ fontWeight: '700' }}>{item.label}</TotlText>
                  <Ionicons name="chevron-forward" size={18} color="rgba(100,116,139,0.8)" />
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: 8 }} />
          <Button
            title="Log out"
            variant="secondary"
            onPress={() => {
              // Keep behavior consistent with the rest of the app: Supabase sign out.
              void supabase.auth.signOut();
            }}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

