import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
// Expo SDK 54: use legacy async APIs (same as league badge upload).
import * as FileSystem from 'expo-file-system/legacy';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/PageHeader';
import CenteredSpinner from '../../components/CenteredSpinner';
import { TotlRefreshControl } from '../../lib/refreshControl';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function EditAvatarScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  /** Local preview while upload runs / until cache catches up */
  const [localPreviewUri, setLocalPreviewUri] = React.useState<string | null>(null);

  const { data: user, isLoading: userLoading, error: userError, refetch: refetchUser, isRefetching } = useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user ?? null;
    },
  });

  const userId = user?.id ?? null;

  const { data: avatarRow } = useQuery<{ avatar_url: string | null } | null>({
    enabled: !!userId,
    queryKey: ['profile-avatar-url', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('avatar_url').eq('id', userId).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;
      return { avatar_url: typeof (data as any).avatar_url === 'string' ? (data as any).avatar_url : null };
    },
  });

  const currentAvatarUrl = localPreviewUri ?? avatarRow?.avatar_url ?? null;

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in');

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) throw new Error('Permission required to access photos');

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (picked.canceled) return { cancelled: true as const };
      const asset = picked.assets?.[0];
      if (!asset?.uri) throw new Error('No image selected');

      // Preview immediately while we upload.
      setLocalPreviewUri(asset.uri);

      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // NOTE: On iOS / Expo, `fetch(file://...)` often yields a 0-byte Blob, which
      // uploads as a grey/broken JPEG to storage. League badge upload already
      // works around this via FileSystem base64 → bytes.
      const info = await FileSystem.getInfoAsync(manipulated.uri);
      const size = typeof (info as any)?.size === 'number' ? ((info as any).size as number) : null;
      if (!info.exists || !size || size <= 0) {
        throw new Error('Could not read the edited image. Please try again.');
      }

      const b64 = await FileSystem.readAsStringAsync(manipulated.uri, { encoding: 'base64' });
      const bytes = base64ToUint8Array(b64);
      if (!bytes.byteLength) {
        throw new Error('The edited image produced 0 bytes. Please try again.');
      }

      const filePath = `${userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage.from('user-avatars').upload(filePath, bytes, {
        upsert: true,
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from('user-avatars').getPublicUrl(filePath);
      const avatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;

      const { error: dbError } = await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', userId);
      if (dbError) throw dbError;

      return { cancelled: false as const, avatarUrl };
    },
    onSuccess: (res) => {
      if (res.cancelled) return;
      setLocalPreviewUri(res.avatarUrl);
      queryClient.setQueryData(['profile-avatar-url', userId], { avatar_url: res.avatarUrl });
      queryClient.invalidateQueries({ queryKey: ['profile-summary'] });
      queryClient.invalidateQueries({ queryKey: ['profile-avatar-url', userId] });
    },
    onError: () => {
      // Keep any remote avatar; drop failed local pick.
      setLocalPreviewUri(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in');
      const { error: dbError } = await supabase.from('users').update({ avatar_url: null }).eq('id', userId);
      if (dbError) throw dbError;
      // Best-effort: leave storage object; web also mainly nulls DB URL.
      return true;
    },
    onSuccess: () => {
      setLocalPreviewUri(null);
      queryClient.setQueryData(['profile-avatar-url', userId], { avatar_url: null });
      queryClient.invalidateQueries({ queryKey: ['profile-summary'] });
      queryClient.invalidateQueries({ queryKey: ['profile-avatar-url', userId] });
    },
  });

  if (userLoading && !user && !userError) {
    return (
      <Screen fullBleed>
        <PageHeader
          title="Edit Avatar"
          leftAction={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => navigation.goBack()}
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

  return (
    <Screen fullBleed>
      <PageHeader
        title="Edit Avatar"
        leftAction={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
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
        refreshControl={<TotlRefreshControl refreshing={isRefetching} onRefresh={() => refetchUser()} />}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to profile"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            marginBottom: 12,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: t.color.border,
            backgroundColor: t.color.surface,
            opacity: pressed ? 0.8 : 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          })}
        >
          <Ionicons name="chevron-back" size={18} color={t.color.text} />
          <TotlText style={{ color: t.color.text, fontWeight: '800' }}>Back to Profile</TotlText>
        </Pressable>

        {userError ? (
          <Card style={{ marginBottom: 12 }}>
            <TotlText variant="heading" style={{ marginBottom: 6 }}>
              Couldn’t load your account
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 12 }}>
              {String((userError as any)?.message ?? 'Unknown error')}
            </TotlText>
            <Button title="Retry" onPress={() => refetchUser()} loading={isRefetching} />
          </Card>
        ) : null}

        <Card style={{ marginBottom: 12, padding: 16 }}>
          <TotlText variant="heading" style={{ marginBottom: 10 }}>
            Avatar
          </TotlText>

          <View style={{ alignItems: 'center', marginBottom: 14 }}>
            <View
              style={{
                width: 120,
                height: 120,
                borderRadius: 999,
                backgroundColor: t.color.surface2,
                borderWidth: 1,
                borderColor: t.color.border,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {currentAvatarUrl ? (
                <Image source={{ uri: currentAvatarUrl }} style={{ width: 120, height: 120 }} />
              ) : (
                <TotlText variant="muted">No avatar</TotlText>
              )}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Button
              title={uploadMutation.isPending ? 'Uploading…' : 'Choose photo'}
              onPress={() => uploadMutation.mutate()}
              loading={uploadMutation.isPending}
              disabled={!userId || uploadMutation.isPending || removeMutation.isPending}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove avatar"
              onPress={() => removeMutation.mutate()}
              disabled={!currentAvatarUrl || removeMutation.isPending || uploadMutation.isPending}
              style={({ pressed }) => ({
                width: '100%',
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 14,
                backgroundColor: 'rgba(239,68,68,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.22)',
                opacity: !currentAvatarUrl ? 0.5 : removeMutation.isPending ? 0.6 : pressed ? 0.9 : 1,
                alignItems: 'center',
              })}
            >
              <TotlText style={{ color: '#DC2626', fontWeight: '900' }}>
                {removeMutation.isPending ? 'Removing…' : 'Remove avatar'}
              </TotlText>
            </Pressable>
          </View>

          {uploadMutation.error ? (
            <TotlText variant="muted" style={{ marginTop: 12, color: '#DC2626' }}>
              {String((uploadMutation.error as any)?.message ?? 'Upload failed')}
            </TotlText>
          ) : null}
          {removeMutation.error ? (
            <TotlText variant="muted" style={{ marginTop: 12, color: '#DC2626' }}>
              {String((removeMutation.error as any)?.message ?? 'Remove failed')}
            </TotlText>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}
