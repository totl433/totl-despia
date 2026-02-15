import React from 'react';
import { Alert, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTokens } from '@totl/ui';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import LeagueChatTabV2 from '../components/chat/LeagueChatTabV2';
import CenteredSpinner from '../components/CenteredSpinner';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { resolveLeagueAvatarUri } from '../lib/leagueAvatars';
import LeagueHeader from '../components/league/LeagueHeader';
import ChatLeagueInfoSheet from '../components/chat/ChatLeagueInfoSheet';

function MiniLeaguesNavIcon({ color }: { color: string }) {
  return (
    <Svg width={32} height={32} viewBox="0 0 36 36" fill="none">
      <Path
        d="M23.668 18.0762C21.0791 18.0762 18.9736 15.7988 18.9736 12.9951C18.9736 10.2344 21.0898 8 23.668 8C26.2676 8 28.373 10.2021 28.373 12.9736C28.373 15.7881 26.2676 18.0762 23.668 18.0762ZM11.2178 18.1943C8.97266 18.1943 7.13574 16.1963 7.13574 13.7256C7.13574 11.3301 8.9834 9.34277 11.2178 9.34277C13.4844 9.34277 15.3105 11.2979 15.3105 13.7041C15.3105 16.1855 13.4844 18.1943 11.2178 18.1943ZM23.668 16.2178C25.1719 16.2178 26.4287 14.7891 26.4287 12.9736C26.4287 11.2012 25.1826 9.8584 23.668 9.8584C22.1641 9.8584 20.918 11.2227 20.918 12.9951C20.918 14.8105 22.1855 16.2178 23.668 16.2178ZM11.2178 16.3574C12.4531 16.3574 13.4951 15.1865 13.4951 13.7041C13.4951 12.2969 12.4746 11.1689 11.2178 11.1689C9.99316 11.1689 8.96191 12.3184 8.96191 13.7256C8.96191 15.1865 10.0039 16.3574 11.2178 16.3574ZM5.30957 28.0664C3.77344 28.0664 3 27.4111 3 26.1328C3 22.5664 6.67383 19.3223 11.2178 19.3223C12.8936 19.3223 14.5908 19.7734 15.9551 20.6221C15.375 20.998 14.9238 21.4492 14.5693 21.9541C13.6348 21.4385 12.4209 21.1377 11.2178 21.1377C7.80176 21.1377 4.90137 23.501 4.90137 25.9717C4.90137 26.1543 4.9873 26.251 5.19141 26.251H12.7539C12.6787 26.96 13.0762 27.7227 13.6562 28.0664H5.30957ZM16.9648 28.0664C15.1172 28.0664 14.2256 27.4756 14.2256 26.2188C14.2256 23.2861 17.8994 19.333 23.668 19.333C29.4365 19.333 33.1104 23.2861 33.1104 26.2188C33.1104 27.4756 32.2188 28.0664 30.3604 28.0664H16.9648ZM16.6104 26.208H30.7256C30.9727 26.208 31.0693 26.1328 31.0693 25.9287C31.0693 24.2852 28.416 21.1914 23.668 21.1914C18.9199 21.1914 16.2559 24.2852 16.2559 25.9287C16.2559 26.1328 16.3525 26.208 16.6104 26.208Z"
        fill={color}
      />
    </Svg>
  );
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function Chat2ThreadScreen() {
  const route = useRoute<any>();
  const params = route.params as RootStackParamList['Chat2Thread'];
  const navigation = useNavigation<any>();
  const t = useTokens();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const leagueId = String(params.leagueId);
  const leagueName = String(params.name ?? '');

  const [infoOpen, setInfoOpen] = React.useState(false);
  const [chatMuted, setChatMuted] = React.useState(false);

  const { optimisticallyClear } = useLeagueUnreadCounts();
  React.useEffect(() => {
    optimisticallyClear(leagueId);
  }, [leagueId, optimisticallyClear]);

  type LeagueMembersResponse = Awaited<ReturnType<typeof api.getLeague>>;
  const { data: leagueDetails, isLoading, error } = useQuery<LeagueMembersResponse>({
    enabled: true,
    queryKey: ['league', leagueId],
    queryFn: () => api.getLeague(leagueId),
  });
  const members = leagueDetails?.members ?? [];
  const membersForChat = React.useMemo(
    () =>
      members.map((m: any) => ({
        id: String(m.id),
        name: String(m.name ?? 'User'),
        avatar_url: typeof m.avatar_url === 'string' ? m.avatar_url : null,
      })),
    [members]
  );
  const leagueMeta = (leagueDetails?.league ?? null) as null | { id?: string; name?: string; code?: string; avatar?: string | null };

  const headerAvatarUri = React.useMemo(() => {
    const a = resolveLeagueAvatarUri(leagueMeta?.avatar);
    return a ?? null;
  }, [leagueMeta?.avatar]);

  const participantNamesLabel = React.useMemo(() => {
    const names = members
      .map((m: any) => String(m?.name ?? '').trim())
      .filter(Boolean);

    const seen = new Set<string>();
    const unique: string[] = [];
    names.forEach((n) => {
      const k = n.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      unique.push(n);
    });
    unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const MAX = 4;
    if (unique.length <= MAX) return unique.join(', ');
    return `${unique.slice(0, MAX).join(', ')} +${unique.length - MAX}`;
  }, [members]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(`chat2:muted:${leagueId}`);
        if (!active) return;
        setChatMuted(raw === '1');
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, [leagueId]);

  const handleToggleMuted = React.useCallback(
    async (next: boolean) => {
      setChatMuted(next);
      try {
        await AsyncStorage.setItem(`chat2:muted:${leagueId}`, next ? '1' : '0');
      } catch {
        // ignore
      }
    },
    [leagueId]
  );

  const handleChooseGroupIcon = React.useCallback(async () => {
    if (!leagueId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to update the group icon.', [{ text: 'OK' }]);
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (picked.canceled) return;
    const asset = picked.assets?.[0];
    const uri = asset?.uri ? String(asset.uri) : null;
    if (!uri) return;

    const manipulated = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 256 } }], {
      compress: 0.75,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    const b64 = await FileSystem.readAsStringAsync(manipulated.uri, { encoding: 'base64' });
    const bytes = base64ToUint8Array(b64);
    if (!bytes.byteLength) {
      Alert.alert('Update failed', 'The edited image produced 0 bytes. Please try again.', [{ text: 'OK' }]);
      return;
    }

    const fileName = `${leagueId}-${Date.now()}.jpg`;
    const uploadRes = await (supabase as any).storage.from('league-avatars').upload(fileName, bytes, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    });
    if (uploadRes.error) throw uploadRes.error;

    const { data: publicUrlData } = (supabase as any).storage.from('league-avatars').getPublicUrl(fileName);
    const publicUrl = publicUrlData?.publicUrl ? String(publicUrlData.publicUrl) : null;
    if (!publicUrl) throw new Error('Unable to get public URL for icon.');

    const updateRes = await (supabase as any).from('leagues').update({ avatar: publicUrl }).eq('id', leagueId);
    if (updateRes.error) throw updateRes.error;

    queryClient.setQueryData(['league', leagueId], (prev: any) => {
      if (!prev) return prev;
      return { ...prev, league: { ...(prev.league ?? {}), avatar: publicUrl } };
    });
    queryClient.setQueryData(['leagues'], (prev: any) => {
      const list = prev?.leagues;
      if (!Array.isArray(list)) return prev;
      return { ...prev, leagues: list.map((l: any) => (String(l?.id) === String(leagueId) ? { ...l, avatar: publicUrl } : l)) };
    });

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['leagues'] }),
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] }),
    ]);
    Alert.alert('Updated', 'Group icon updated.', [{ text: 'OK' }]);
  }, [leagueId, queryClient]);

  const handleResetGroupIcon = React.useCallback(async () => {
    try {
      const updateRes = await (supabase as any).from('leagues').update({ avatar: null }).eq('id', leagueId);
      if (updateRes.error) throw updateRes.error;
      queryClient.setQueryData(['league', leagueId], (prev: any) => {
        if (!prev) return prev;
        return { ...prev, league: { ...(prev.league ?? {}), avatar: null } };
      });
      queryClient.setQueryData(['leagues'], (prev: any) => {
        const list = prev?.leagues;
        if (!Array.isArray(list)) return prev;
        return { ...prev, leagues: list.map((l: any) => (String(l?.id) === String(leagueId) ? { ...l, avatar: null } : l)) };
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leagues'] }),
        queryClient.invalidateQueries({ queryKey: ['league', leagueId] }),
      ]);
      Alert.alert('Reset', 'Group icon reset.', [{ text: 'OK' }]);
    } catch (e: any) {
      Alert.alert('Couldn’t reset icon', e?.message ?? 'Failed to reset group icon. Please try again.', [{ text: 'OK' }]);
    }
  }, [leagueId, queryClient]);

  if (isLoading && !leagueDetails && !error) {
    return (
      <View style={{ flex: 1 }}>
        <CenteredSpinner loading />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: t.color.background }}>
      <View style={{ flex: 1 }}>
        <LeagueHeader
          title={leagueName || 'Chat'}
          subtitle={participantNamesLabel || 'Chat'}
          avatarUri={headerAvatarUri}
          compactSubtitle
          onPressHeaderInfo={() => setInfoOpen(true)}
          onPressBack={() => {
            if (navigation?.canGoBack?.()) {
              navigation.goBack();
              return;
            }
            navigation.navigate('Tabs' as any, { screen: 'Chat' } as any);
          }}
          onPressSecondaryAction={() =>
            navigation.navigate('LeagueDetail' as any, {
              leagueId,
              name: String(leagueMeta?.name ?? params.name ?? ''),
              returnTo: 'chat2',
            })
          }
          secondaryActionIcon={<MiniLeaguesNavIcon color={t.color.muted} />}
        />

        <View style={{ flex: 1 }}>
          <LeagueChatTabV2
            leagueId={leagueId}
            members={membersForChat}
            keyboardHeaderOffset={0}
          />
        </View>

        <ChatLeagueInfoSheet
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          leagueName={leagueName || 'Mini League'}
          leagueAvatarUri={headerAvatarUri}
          members={membersForChat}
          muted={chatMuted}
          onToggleMuted={handleToggleMuted}
          onPressOpenLeague={() => {
            setInfoOpen(false);
            navigation.navigate('LeagueDetail' as any, {
              leagueId,
              name: String(leagueMeta?.name ?? params.name ?? ''),
              returnTo: 'chat2',
            });
          }}
          onPressChooseIcon={handleChooseGroupIcon}
          onPressResetIcon={handleResetGroupIcon}
        />
      </View>
    </View>
  );
}
