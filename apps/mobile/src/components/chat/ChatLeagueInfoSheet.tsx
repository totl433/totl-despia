import React from 'react';
import { Image, Pressable, Switch, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TotlText, useTokens } from '@totl/ui';

function MemberRow({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  const t = useTokens();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: t.color.border,
          backgroundColor: t.color.surface2,
          marginRight: 10,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: 28, height: 28 }} />
        ) : (
          <TotlText style={{ fontSize: 11, fontWeight: '800' }}>{String(name || '?').slice(0, 1).toUpperCase()}</TotlText>
        )}
      </View>
      <TotlText numberOfLines={1} style={{ flex: 1, fontWeight: '700', color: '#334155' }}>
        {name}
      </TotlText>
    </View>
  );
}

export default function ChatLeagueInfoSheet({
  open,
  onClose,
  leagueName,
  leagueAvatarUri,
  members,
  muted,
  onToggleMuted,
  onPressChooseIcon,
  onPressResetIcon,
  onPressOpenLeague,
}: {
  open: boolean;
  onClose: () => void;
  leagueName: string;
  leagueAvatarUri: string | null;
  members: Array<{ id: string; name: string; avatar_url?: string | null }>;
  muted: boolean;
  onToggleMuted: (next: boolean) => void;
  onPressChooseIcon: () => void;
  onPressResetIcon: () => void;
  onPressOpenLeague: () => void;
}) {
  const t = useTokens();
  const ref = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => [560], []);
  const [mode, setMode] = React.useState<'main' | 'iconOptions'>('main');

  React.useEffect(() => {
    if (open) {
      setMode('main');
      requestAnimationFrame(() => ref.current?.present());
      return;
    }
    ref.current?.dismiss();
  }, [open]);

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
      <BottomSheetView style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 34 }}>
        <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
          <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, padding: 2 })}>
            <Ionicons name="close" size={24} color={t.color.muted} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: t.color.border,
              backgroundColor: t.color.surface2,
              overflow: 'hidden',
              marginRight: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {leagueAvatarUri ? (
              <Image source={{ uri: leagueAvatarUri }} style={{ width: 44, height: 44 }} />
            ) : (
              <Ionicons name="people-outline" size={22} color={t.color.muted} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <TotlText numberOfLines={1} style={{ fontSize: 19, lineHeight: 24, fontWeight: '800', color: '#0F172A' }}>
              {leagueName}
            </TotlText>
            <TotlText style={{ marginTop: 2, color: '#475569' }}>{members.length} members</TotlText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="notifications-off-outline" size={18} color={t.color.muted} style={{ marginRight: 8 }} />
            <TotlText style={{ fontWeight: '700', color: '#334155' }}>Mute chat</TotlText>
          </View>
          <Switch value={muted} onValueChange={onToggleMuted} />
        </View>

        {mode === 'main' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <Pressable
                onPress={onPressOpenLeague}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 42,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: t.color.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <TotlText style={{ fontWeight: '700', color: '#334155' }}>Open Mini League</TotlText>
              </Pressable>
              <Pressable
                onPress={() => setMode('iconOptions')}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 42,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: t.color.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <TotlText style={{ fontWeight: '700', color: '#334155' }}>Change Group Icon</TotlText>
              </Pressable>
            </View>

            <TotlText
              style={{
                color: '#0F766E',
                fontSize: 13,
                lineHeight: 17,
                fontWeight: '800',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              Members
            </TotlText>
            <View style={{ marginTop: 6 }}>
              {members.map((m) => (
                <MemberRow key={m.id} name={m.name} avatarUrl={m.avatar_url ?? null} />
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Pressable
                onPress={() => setMode('main')}
                hitSlop={10}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, marginRight: 10 })}
              >
                <Ionicons name="chevron-back" size={20} color={t.color.muted} />
              </Pressable>
              <TotlText
                style={{
                  color: '#0F766E',
                  fontSize: 13,
                  lineHeight: 17,
                  fontWeight: '800',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                Group Icon Options
              </TotlText>
            </View>

            <Pressable
              onPress={onPressChooseIcon}
              style={({ pressed }) => ({
                minHeight: 46,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: t.color.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.9 : 1,
                marginBottom: 10,
              })}
            >
              <TotlText style={{ fontWeight: '700', color: '#334155' }}>Choose from Photos</TotlText>
            </Pressable>

            <Pressable
              onPress={onPressResetIcon}
              style={({ pressed }) => ({
                minHeight: 46,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.35)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <TotlText style={{ fontWeight: '700', color: '#DC2626' }}>Reset to Default</TotlText>
            </Pressable>
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
