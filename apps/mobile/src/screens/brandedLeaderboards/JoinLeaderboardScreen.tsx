import React, { useState, useCallback } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, TotlText, useTokens } from '@totl/ui';
import { api } from '../../lib/api';
import { shouldShowPaywallBeforeJoin } from '../../lib/brandedLeaderboardAccess';

export default function JoinLeaderboardScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const t = useTokens();

  const leaderboardId: string | undefined = route.params?.leaderboardId;
  const leaderboardName: string | undefined = route.params?.leaderboardName;
  const prefillCode: string | undefined = route.params?.code;

  const [code, setCode] = useState(prefillCode ?? '');
  const [loading, setLoading] = useState(false);
  const [resolvedName, setResolvedName] = useState(leaderboardName ?? '');

  const handleJoin = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    let targetId = leaderboardId;
    try {
      if (!targetId) {
        const resolved = await api.resolveJoinCode(trimmed);
        targetId = resolved.leaderboard.id;
        setResolvedName(resolved.leaderboard.display_name);
      }

      const detail = await api.getBrandedLeaderboard(targetId!);
      console.info('[BrandedLeaderboardJoin]', {
        leaderboardId: targetId,
        code: trimmed,
        priceType: detail.leaderboard.price_type,
        hasAccess: detail.hasAccess,
        hasActivePurchase: detail.hasActivePurchase,
        requiresPurchase: detail.requiresPurchase,
        accessReason: detail.accessReason,
      });

      if (shouldShowPaywallBeforeJoin(detail)) {
        (navigation as any).replace('BrandedLeaderboard', { idOrSlug: targetId, joinCode: trimmed });
        return;
      }

      await api.joinBrandedLeaderboard(targetId!, trimmed);
      (navigation as any).replace('BrandedLeaderboard', { idOrSlug: targetId });
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : null;
      if (status === 402 && targetId) {
        (navigation as any).replace('BrandedLeaderboard', { idOrSlug: targetId, joinCode: trimmed });
        return;
      }
      Alert.alert('Could not join', err?.message ?? 'Invalid code or leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [code, leaderboardId, navigation]);

  return (
    <Screen>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
        <TotlText variant="heading" style={{ fontSize: 24, textAlign: 'center', marginBottom: 8 }}>
          {resolvedName ? `Join ${resolvedName}` : 'Join a Leaderboard'}
        </TotlText>
        <TotlText variant="muted" style={{ textAlign: 'center', marginBottom: 24 }}>
          Enter your join code below
        </TotlText>

        <TextInput
          value={code}
          onChangeText={(val) => setCode(val.toUpperCase())}
          placeholder="Enter code"
          placeholderTextColor={t.color.muted}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          maxLength={30}
          style={{
            backgroundColor: t.color.surface2,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 18,
            fontWeight: '700',
            textAlign: 'center',
            letterSpacing: 2,
            color: t.color.text,
            marginBottom: 20,
          }}
        />

        <Pressable
          onPress={handleJoin}
          disabled={loading || !code.trim()}
          style={{
            backgroundColor: '#1C8376',
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            opacity: loading || !code.trim() ? 0.5 : 1,
          }}
        >
          <TotlText style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {loading ? 'Joining...' : 'Join Leaderboard'}
          </TotlText>
        </Pressable>

        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 16, alignItems: 'center' }}>
          <TotlText variant="muted">Cancel</TotlText>
        </Pressable>
      </View>
    </Screen>
  );
}
