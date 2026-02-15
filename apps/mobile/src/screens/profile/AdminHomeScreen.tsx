import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, Screen, TotlText, useTokens } from '@totl/ui';

import PageHeader from '../../components/PageHeader';

export default function AdminHomeScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();

  const goBack = React.useCallback(() => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('ProfileHome');
  }, [navigation]);

  const openUrl = React.useCallback(async (url: string) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) return;
      await Linking.openURL(url);
    } catch {
      // ignore
    }
  }, []);

  const openPredictionsTest = React.useCallback(() => {
    const parent = navigation.getParent?.();
    parent?.navigate?.('PredictionsTestFlow');
  }, [navigation]);

  return (
    <Screen fullBleed>
      <PageHeader
        title="Admin"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={goBack}
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
            Tools
          </TotlText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Make your predictions test"
            onPress={openPredictionsTest}
            style={({ pressed }) => ({
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(148,163,184,0.18)',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <TotlText style={{ fontWeight: '700' }}>Make Your Predictions Test</TotlText>
            <Ionicons name="chevron-forward" size={18} color="rgba(100,116,139,0.8)" />
          </Pressable>

          <View
            style={{
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(148,163,184,0.18)',
              opacity: 0.55,
            }}
          >
            <TotlText style={{ fontWeight: '700' }}>API Admin</TotlText>
            <TotlText variant="muted">Coming soon</TotlText>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open admin data on web"
            onPress={() => openUrl('https://playtotl.com/admin-data')}
            style={({ pressed }) => ({
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <TotlText style={{ fontWeight: '700' }}>Admin Data (Web)</TotlText>
            <Ionicons name="open-outline" size={18} color="rgba(100,116,139,0.8)" />
          </Pressable>
        </Card>
      </View>
    </Screen>
  );
}

