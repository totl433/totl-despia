import React from 'react';
import { Pressable, Share, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { TotlText, useTokens } from '@totl/ui';
import * as Clipboard from 'expo-clipboard';

import { env } from '../../env';

export default function LeagueInviteSheet({
  open,
  onClose,
  leagueName,
  leagueCode,
  title = 'Invite players',
  shareTextOverride,
  urlOverride,
}: {
  open: boolean;
  onClose: () => void;
  leagueName: string;
  leagueCode: string;
  title?: string;
  shareTextOverride?: string;
  urlOverride?: string;
}) {
  const t = useTokens();
  const ref = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => [252], []);

  const [toast, setToast] = React.useState<string>('');

  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => ref.current?.present());
      return;
    }
    ref.current?.dismiss();
  }, [open]);

  const shareText = String(shareTextOverride ?? `Join my mini league "${leagueName}" on TotL!`);
  const base = String(env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  const url = urlOverride ? String(urlOverride) : base ? `${base}/league/${encodeURIComponent(leagueCode)}` : '';

  const handleShare = async () => {
    try {
      await Share.share({ message: url ? `${shareText}\n${url}` : `${shareText}\nCode: ${leagueCode}` });
    } catch {
      // ignore
    }
  };

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(leagueCode);
      setToast('Code copied');
    } catch {
      setToast("Couldn't copy");
    } finally {
      setTimeout(() => setToast(''), 1200);
    }
  };

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: t.color.surface }}
      handleIndicatorStyle={{ backgroundColor: t.color.border }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
      )}
    >
      <BottomSheetView style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24 }}>
        <TotlText style={{ fontFamily: 'System', fontSize: 16, lineHeight: 20, fontWeight: '700' }}>{title}</TotlText>
        <TotlText style={{ marginTop: 6, fontFamily: 'System', fontSize: 13, lineHeight: 16, color: t.color.muted }}>
          Share this code with friends:
        </TotlText>

        <View
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderColor: t.color.border,
            backgroundColor: t.color.surface2,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 14,
          }}
        >
          <TotlText style={{ fontFamily: 'System', fontSize: 18, lineHeight: 22, fontWeight: '800', letterSpacing: 1.2 }}>
            {leagueCode}
          </TotlText>
        </View>

        {toast ? (
          <TotlText style={{ marginTop: 8, fontFamily: 'System', fontSize: 12, lineHeight: 14, color: t.color.muted }}>
            {toast}
          </TotlText>
        ) : null}

        <View style={{ height: 12 }} />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={handleCopy}
            style={({ pressed }) => ({
              flex: 1,
              height: 44,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: t.color.border,
              backgroundColor: pressed ? 'rgba(148,163,184,0.12)' : t.color.surface,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
            })}
          >
            <Ionicons name="copy-outline" size={18} color={t.color.muted} />
            <TotlText style={{ fontFamily: 'System', fontSize: 14, lineHeight: 18, fontWeight: '700' }}>Copy code</TotlText>
          </Pressable>

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => ({
              flex: 1,
              height: 44,
              borderRadius: 14,
              backgroundColor: t.color.brand,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 8,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <Ionicons name="share-outline" size={18} color="#FFFFFF" />
            <TotlText style={{ color: '#FFFFFF', fontFamily: 'System', fontSize: 14, lineHeight: 18, fontWeight: '800' }}>Share</TotlText>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

