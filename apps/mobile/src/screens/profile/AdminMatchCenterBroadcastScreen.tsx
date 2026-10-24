import React from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import PageHeader from '../../components/PageHeader';
import HeaderTotlLogo from '../../components/HeaderTotlLogo';
import GameCentreCard, { GameCentreCardHeader, GameCentreReactionBar } from '../../components/gameCentre/GameCentreCard';
import { gameCentreReactionChips } from '../../features/gameCentre/cards';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../../lib/layout';
import { broadcastErrorMessage, matchCenterBroadcastApi } from '../../lib/matchCenterBroadcastApi';

function CompactSwitch({
  label,
  note,
  value,
  onValueChange,
}: {
  label: string;
  note?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const t = useTokens();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <TotlText style={{ fontSize: 13, lineHeight: 16, fontWeight: '800' }}>{label}</TotlText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E2E8F0', true: t.color.brand }}
        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
        accessibilityLabel={label}
      />
      {note ? (
        <TotlText variant="muted" style={{ fontSize: 10, lineHeight: 12, textAlign: 'center' }}>
          {note}
        </TotlText>
      ) : null}
    </View>
  );
}

/**
 * Admin composer for a Match Center announcement.
 */
export default function AdminMatchCenterBroadcastScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [comments, setComments] = React.useState(true);
  const [shareable, setShareable] = React.useState(false);
  const [reacts, setReacts] = React.useState(true);
  const [posting, setPosting] = React.useState(false);

  const previewTitle = title.trim() || 'Title';
  const previewBody = body.trim() || 'Body copy';
  const canPost = title.trim().length > 0 && body.trim().length > 0 && !posting;

  const postBroadcast = React.useCallback(async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      await matchCenterBroadcastApi.post({
        title: title.trim(),
        body: body.trim(),
        comments,
        shareable,
        reacts,
      });
      void queryClient.invalidateQueries({ queryKey: ['match-center-derived-extras'] });
      Alert.alert('Posted', 'It’s on Match Center for anyone on this app build.');
    } catch (error) {
      Alert.alert('Not posted', broadcastErrorMessage(error));
    } finally {
      setPosting(false);
    }
  }, [body, canPost, comments, queryClient, reacts, shareable, title]);

  const confirmPost = React.useCallback(() => {
    if (!canPost) return;
    Alert.alert('Post to Match Center?', 'Anyone on this app build will see it in Match Center.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Post', onPress: () => void postBroadcast() },
    ]);
  }, [canPost, postBroadcast]);
  const inputStyle = {
    width: '100%' as const,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'Gramatika-Medium',
    fontSize: 15,
    lineHeight: 18,
    color: t.color.text,
  };

  const footer =
    reacts || comments ? (
      <>
        {reacts ? <GameCentreReactionBar chips={gameCentreReactionChips([])} onReact={() => undefined} /> : null}
        {comments ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: reacts ? 12 : 16 }}>
            <TotlText style={{ fontSize: 13, lineHeight: 16, color: 'rgba(60,60,67,0.6)' }}>Add a comment</TotlText>
          </View>
        ) : (
          <View style={{ paddingBottom: 12 }} />
        )}
      </>
    ) : null;

  return (
    <Screen fullBleed>
      <PageHeader
        title="Admin Broadcast"
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
            gap: 10,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card style={{ padding: 12 }}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={t.color.muted}
              accessibilityLabel="Title"
              returnKeyType="next"
              style={inputStyle}
            />
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Body copy"
              placeholderTextColor={t.color.muted}
              accessibilityLabel="Body copy"
              multiline
              textAlignVertical="top"
              style={[inputStyle, { marginTop: 8, minHeight: 64, paddingTop: 8 }]}
            />
            <View
              style={{
                marginTop: 10,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: 'rgba(148,163,184,0.25)',
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              <CompactSwitch label="Comments" value={comments} onValueChange={setComments} />
              <CompactSwitch label="Shareable" note="Not wired yet" value={shareable} onValueChange={setShareable} />
              <CompactSwitch label="Reacts" value={reacts} onValueChange={setReacts} />
            </View>
            <Button
              title={posting ? 'Posting…' : 'Post'}
              size="sm"
              disabled={!canPost}
              loading={posting}
              onPress={confirmPost}
              style={{ marginTop: 12 }}
            />
          </Card>

          <GameCentreCard
            gap={12}
            style={{ paddingTop: 12 }}
            header={
              <GameCentreCardHeader
                title={previewTitle}
                subtitle={previewBody}
                stamp="Now"
                leading={<HeaderTotlLogo width={26} height={23} />}
              />
            }
            footer={footer}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
