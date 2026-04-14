import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TotlText, useTokens } from '@totl/ui';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useOffering, usePurchases } from '../../hooks/usePurchases';
import { api } from '../../lib/api';
import { retryBrandedLeaderboardActivation } from '../../lib/brandedLeaderboardActivation';
import type { PurchasesPackage } from 'react-native-purchases';

const DEFAULT_TIER_OFFERINGS: Record<number, string> = {
  99: 'totl_season_sub_099',
  199: 'totl_season_sub_199',
};

type Props = {
  leaderboardId: string;
  offeringId: string | null | undefined;
  joinCode?: string;
  displayName: string;
  description: string | null | undefined;
  priceCents: number;
  currency: string;
  hostNames: string[];
  onSuccess: () => void;
  onDismiss: () => void;
};

export default function BrandedLeaderboardPaywall({
  leaderboardId,
  offeringId,
  joinCode,
  displayName,
  description,
  priceCents,
  currency,
  hostNames,
  onSuccess,
  onDismiss,
}: Props) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const { purchasePackage } = usePurchases();
  const effectiveOfferingId = offeringId ?? DEFAULT_TIER_OFFERINGS[priceCents] ?? null;
  const { offering, loading: offeringLoading } = useOffering(effectiveOfferingId);
  const [purchasing, setPurchasing] = useState(false);

  const packages = offering?.availablePackages ?? [];

  const handlePurchase = useCallback(
    async (pkg: PurchasesPackage) => {
      setPurchasing(true);
      try {
        await purchasePackage(pkg);
      } catch (err: any) {
        if (err.userCancelled) return;
        const msg = typeof err?.message === 'string' ? err.message : 'Something went wrong. Please try again.';
        Alert.alert('Purchase failed', msg);
        return;
      } finally {
        setPurchasing(false);
      }

      try {
        await retryBrandedLeaderboardActivation({
          runAttempt: () =>
            api.activateBrandedLeaderboardSubscription(leaderboardId, {
              rc_subscription_id: pkg.identifier,
              rc_product_id: pkg.product.identifier,
            }),
          onRetryableError: (err, meta) => {
            console.warn('[Paywall] Activation attempt failed after successful purchase', {
              leaderboardId,
              productId: pkg.product.identifier,
              attempt: meta.attempt,
              delayMs: meta.delayMs,
              finalAttempt: meta.finalAttempt,
              status: (err as any)?.status ?? null,
              message: (err as any)?.message ?? String(err),
            });
          },
        });
      } catch (activationError) {
        console.warn('[Paywall] Activation failed after successful purchase, will retry on refresh', activationError);
        Alert.alert(
          'Almost there',
          'Your purchase was successful but we couldn\'t activate it right now. Pull to refresh the leaderboard to try again.',
        );
        return;
      }

      if (joinCode) {
        try {
          await api.joinBrandedLeaderboard(leaderboardId, joinCode);
        } catch (err: any) {
          console.warn('[Paywall] Join failed after successful activation', err);
          Alert.alert(
            'Purchase confirmed',
            'Your payment went through, but we could not finish joining this leaderboard. Please try your join code again.',
          );
          return;
        }
      }

      onSuccess();
    },
    [purchasePackage, leaderboardId, joinCode, onSuccess],
  );

  const priceDisplay = `£${(priceCents / 100).toFixed(2)}`;

  const hostsText =
    hostNames.length >= 3
      ? `Take on ${hostNames[0]}, ${hostNames[1]} and ${hostNames[2]}, and the rest of the ${displayName} community.`
      : hostNames.length > 0
        ? `Take on ${hostNames.join(' and ')}, and the rest of the ${displayName} community.`
        : `Join the ${displayName} community.`;

  return (
    <View
      style={{
        backgroundColor: t.color.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 16,
        paddingBottom: Math.max(insets.bottom, 24),
        paddingHorizontal: 24,
      }}
    >
      {/* Close button */}
      <Pressable
        onPress={onDismiss}
        hitSlop={12}
        style={({ pressed }) => ({
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: t.color.surface2,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 12,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="close" size={18} color={t.color.text} />
      </Pressable>

      {/* Handle bar */}
      <View
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: t.color.border,
          alignSelf: 'center',
          marginBottom: 20,
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: [{ translateX: -18 }],
        }}
      />

      <TotlText
        style={{
          fontFamily: 'Gramatika-Regular',
          fontSize: 28,
          lineHeight: 36,
          letterSpacing: -0.43,
          textAlign: 'center',
          color: '#000000',
          marginBottom: 20,
        }}
      >
        Join the {displayName} Leaderboard
      </TotlText>

      <TotlText
        style={{
          fontFamily: 'Gramatika-Regular',
          fontSize: 18,
          lineHeight: 23,
          letterSpacing: -0.43,
          textAlign: 'center',
          color: '#5C5C5C',
          marginBottom: 8,
        }}
      >
        {hostsText}
      </TotlText>

      {description ? (
        <TotlText
          style={{
            fontFamily: 'Gramatika-Regular',
            fontSize: 18,
            lineHeight: 23,
            letterSpacing: -0.43,
            textAlign: 'center',
            color: '#5C5C5C',
            marginBottom: 24,
          }}
        >
          {description}
        </TotlText>
      ) : null}

      {offeringLoading ? (
        <ActivityIndicator style={{ marginVertical: 16 }} />
      ) : packages.length > 0 ? (
        <View style={{ gap: 10 }}>
          {packages.map((pkg) => (
            <Pressable
              key={pkg.identifier}
              onPress={() => handlePurchase(pkg)}
              disabled={purchasing}
              style={({ pressed }) => ({
                backgroundColor: '#000',
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
                opacity: purchasing ? 0.6 : pressed ? 0.85 : 1,
              })}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <TotlText style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                  {pkg.product.priceString} for the season
                </TotlText>
              )}
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable
          onPress={() => {
            Alert.alert('Not Available', 'This subscription is not yet available. Please try again later.');
          }}
          style={({ pressed }) => ({
            backgroundColor: '#000',
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <TotlText style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {priceDisplay} for the season
          </TotlText>
        </Pressable>
      )}

      <TotlText
        variant="muted"
        style={{ textAlign: 'center', fontSize: 12, marginTop: 14, lineHeight: 16 }}
      >
        Leave anytime, all leagues can be managed in Settings.
      </TotlText>
    </View>
  );
}
