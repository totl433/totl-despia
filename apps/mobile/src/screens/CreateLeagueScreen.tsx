import React from 'react';
import { Alert, Image, Pressable, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Screen, TotlText, useTokens } from '@totl/ui';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '../lib/supabase';
import { VOLLEY_USER_ID } from '../lib/volley';
import { getDefaultMlAvatarFilename } from '../lib/leagueAvatars';

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function CreateLeagueScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [leagueName, setLeagueName] = React.useState('');
  const [badgeUri, setBadgeUri] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const handlePickBadge = React.useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to pick a badge.', [{ text: 'OK' }]);
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
    setBadgeUri(uri);
  }, []);

  const uploadBadge = React.useCallback(async (leagueId: string, localUri: string): Promise<string | null> => {
    const manipulated = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 256 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
    );

    const info = await FileSystem.getInfoAsync(manipulated.uri);
    const size = typeof (info as any)?.size === 'number' ? ((info as any).size as number) : null;
    if (!info.exists || !size || size <= 0) {
      return null;
    }

    const b64 = await FileSystem.readAsStringAsync(manipulated.uri, { encoding: 'base64' });
    const bytes = base64ToUint8Array(b64);
    if (!bytes.byteLength) return null;

    const fileName = `${leagueId}-${Date.now()}.jpg`;
    const uploadRes = await (supabase as any).storage.from('league-avatars').upload(fileName, bytes, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    });
    if (uploadRes.error) return null;

    const { data: publicUrlData } = (supabase as any).storage.from('league-avatars').getPublicUrl(fileName);
    const publicUrl = publicUrlData?.publicUrl ? String(publicUrlData.publicUrl) : null;
    return publicUrl && publicUrl.startsWith('http') ? publicUrl : null;
  }, []);

  const handleCreate = React.useCallback(async () => {
    if (creating) return;
    const name = leagueName.trim();
    if (!name) {
      Alert.alert('Missing name', 'Please enter a league name.', [{ text: 'OK' }]);
      return;
    }

    setCreating(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id ? String(userRes.user.id) : null;
      if (!userId) throw new Error('Not logged in.');

      // Duplicate league name check (case-insensitive) using cached leagues list.
      const cached = queryClient.getQueryData<any>(['leagues']);
      const existing = Array.isArray(cached?.leagues) ? cached.leagues : [];
      const dup = existing.find((l: any) => String(l?.name ?? '').trim().toLowerCase() === name.toLowerCase());
      if (dup) {
        Alert.alert('Name already used', "You're already in a mini-league with this name. Please choose a different name.", [{ text: 'OK' }]);
        setCreating(false);
        return;
      }

      const code = Math.random().toString(36).substring(2, 7).toUpperCase();

      const { data: league, error: leagueError } = await (supabase as any)
        .from('leagues')
        .insert({ name, code })
        .select('id, name, code, created_at')
        .single();
      if (leagueError) throw leagueError;
      if (!league?.id) throw new Error('Failed to create league.');

      const leagueId = String(league.id);

      // Avatar: uploaded badge URL or deterministic ML default filename.
      let avatar: string | null = null;
      if (badgeUri) {
        avatar = await uploadBadge(leagueId, badgeUri);
      }
      if (!avatar) {
        avatar = getDefaultMlAvatarFilename(leagueId);
      }

      const updateRes = await (supabase as any).from('leagues').update({ avatar }).eq('id', leagueId);
      if (updateRes.error) throw updateRes.error;

      const memberRes = await (supabase as any).from('league_members').insert({ league_id: leagueId, user_id: userId });
      if (memberRes.error) throw memberRes.error;

      // Non-blocking welcome message.
      try {
        const welcomeMessages = [
          "Hello 👋 I'm Volley. I'll let you know who wins and when new Gameweeks are ready to play.",
          "Hi — I'm Volley 🦄 I'll share results and let you know when new Gameweeks are ready.",
          "I'm Volley. I'll handle the scoring and tell you when new Gameweeks are ready to play.",
          "I'm Volley 🦄 I'll let you know who wins, plus when new Gameweeks are ready.",
          "Hello, I'm Volley. I'll keep track of results and new Gameweeks for you.",
        ];
        const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
        await (supabase as any).from('league_messages').insert({ league_id: leagueId, user_id: VOLLEY_USER_ID, content: randomMessage });
      } catch {
        // ignore
      }

      await queryClient.invalidateQueries({ queryKey: ['leagues'] });
      navigation.navigate('LeagueDetail', { leagueId, name } as const);
    } catch (e: any) {
      Alert.alert("Couldn't create league", e?.message ?? 'Failed to create league. Please try again.', [{ text: 'OK' }]);
    } finally {
      setCreating(false);
    }
  }, [badgeUri, creating, leagueName, navigation, queryClient, uploadBadge]);

  return (
    <Screen fullBleed>
      <View style={{ paddingHorizontal: t.space[4], paddingTop: t.space[3], paddingBottom: t.space[3], flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
            marginRight: 10,
          })}
        >
          <TotlText style={{ color: t.color.muted, fontWeight: '900', fontSize: 22, lineHeight: 22 }}>‹</TotlText>
        </Pressable>

        <TotlText style={{ flex: 1, color: t.color.text, fontFamily: 'Gramatika-Medium', fontSize: 22, lineHeight: 22 }}>
          Create League
        </TotlText>
      </View>

      <View style={{ paddingHorizontal: t.space[4], paddingTop: 8 }}>
        <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 14, lineHeight: 18, color: t.color.muted, fontWeight: '700' }}>
          Choose a name and optionally upload a badge.
        </TotlText>

        <View style={{ height: 16 }} />

        <Pressable
          onPress={handlePickBadge}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: t.color.border,
            backgroundColor: pressed ? 'rgba(148,163,184,0.10)' : t.color.surface,
            padding: 14,
          })}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              backgroundColor: t.color.surface2,
              borderWidth: 1,
              borderColor: t.color.border,
              overflow: 'hidden',
              marginRight: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {badgeUri ? <Image source={{ uri: badgeUri }} style={{ width: 56, height: 56 }} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 16, lineHeight: 20, fontWeight: '600', color: t.color.text }}>
              {badgeUri ? 'Change badge' : 'Add badge (optional)'}
            </TotlText>
            <TotlText style={{ marginTop: 2, fontFamily: 'Gramatika-Medium', fontSize: 12, lineHeight: 14, color: t.color.muted }}>
              Square images work best.
            </TotlText>
          </View>
        </Pressable>

        <View style={{ height: 14 }} />

        <TextInput
          value={leagueName}
          onChangeText={setLeagueName}
          placeholder="League name"
          placeholderTextColor={t.color.muted}
          style={{
            width: '100%',
            height: 54,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: t.color.border,
            backgroundColor: t.color.surface,
            paddingHorizontal: 16,
            fontFamily: 'Gramatika-Medium',
            fontSize: 18,
            lineHeight: 22,
            fontWeight: '600',
            color: t.color.text,
            letterSpacing: 0,
          }}
          returnKeyType="done"
          onSubmitEditing={() => void handleCreate()}
        />

        <View style={{ height: 18 }} />

        <Pressable
          onPress={() => void handleCreate()}
          disabled={creating || !leagueName.trim()}
          style={({ pressed }) => ({
            width: '100%',
            height: 56,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.color.brand,
            opacity: creating || !leagueName.trim() ? 0.45 : pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          })}
        >
          <TotlText style={{ color: '#FFFFFF', fontFamily: 'Gramatika-Medium', fontSize: 16, lineHeight: 16, fontWeight: '600' }}>
            {creating ? 'Creating…' : 'Create League'}
          </TotlText>
        </Pressable>
      </View>
    </Screen>
  );
}

