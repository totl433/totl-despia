import React from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/PageHeader';
import CenteredSpinner from '../../components/CenteredSpinner';
import { TotlRefreshControl } from '../../lib/refreshControl';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';

export default function EditAvatarScreen() {
  const t = useTokens();
  const queryClient = useQueryClient();

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

  const currentAvatarUrl = avatarRow?.avatar_url ?? null;

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in');

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) throw new Error('Permission required to access photos');

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (picked.canceled) return { cancelled: true as const };
      const asset = picked.assets?.[0];
      if (!asset?.uri) throw new Error('No image selected');

      const width = Number(asset.width ?? 0);
      const height = Number(asset.height ?? 0);
      const size = Math.max(1, Math.min(width || 1, height || 1));
      const cropX = width > size ? Math.floor((width - size) / 2) : 0;
      const cropY = height > size ? Math.floor((height - size) / 2) : 0;

      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [
          ...(width > 0 && height > 0
            ? [
                {
                  crop: {
                    originX: cropX,
                    originY: cropY,
                    width: size,
                    height: size,
                  },
                } as const,
              ]
            : []),
          { resize: { width: 400, height: 400 } },
        ],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      const resp = await fetch(manipulated.uri);
      const blob = await resp.blob();

      const filePath = `${userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage.from('user-avatars').upload(filePath, blob as any, {
        upsert: true,
        contentType: 'image/jpeg',
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
      // Refresh profile screens that show the avatar.
      queryClient.invalidateQueries({ queryKey: ['profile-summary'] });
      queryClient.invalidateQueries({ queryKey: ['profile-avatar-url', userId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in');
      const { error: dbError } = await supabase.from('users').update({ avatar_url: null }).eq('id', userId);
      if (dbError) throw dbError;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-summary'] });
      queryClient.invalidateQueries({ queryKey: ['profile-avatar-url', userId] });
    },
  });

  if (userLoading && !user && !userError) {
    return (
      <Screen fullBleed>
        <PageHeader title="Edit Avatar" />
        <CenteredSpinner loading />
      </Screen>
    );
  }

  return (
    <Screen fullBleed>
      <PageHeader title="Edit Avatar" />

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

