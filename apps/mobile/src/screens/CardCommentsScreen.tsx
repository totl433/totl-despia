import React from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTokens } from '@totl/ui';

import LeagueChatTabV2, { type ChatThreadSource } from '../components/chat/LeagueChatTabV2';
import ChatStackHeaderTitle from '../components/chat/ChatStackHeaderTitle';
import { GameCentreCardHeader } from '../components/gameCentre/GameCentreCard';
import { commentsAsMessages, useCardComments } from '../hooks/useCardComments';
import { supabase } from '../lib/supabase';

export type CardCommentsParams = {
  /** The card's permanent id, e.g. mc:gw7:goal:9:H1. */
  cardId: string;
  title: string;
  subtitle?: string | null;
};

/**
 * The public comments on one Game Centre card. Built on the Mini League chat view, with
 * every comment left-aligned. The card's footer posts into the same thread.
 */
export default function CardCommentsScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const { cardId, title, subtitle } = useRoute<any>().params as CardCommentsParams;
  const { comments, authors, isLoading, error, send, report, block } = useCardComments(cardId);

  const { data: meId } = useQuery({
    queryKey: ['me-id'],
    queryFn: async () => (await supabase.auth.getSession()).data.session?.user?.id ?? null,
  });

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: () => <ChatStackHeaderTitle title={title} subtitle="Comments" avatarUri={null} /> });
  }, [navigation, title]);

  const source = React.useMemo<ChatThreadSource>(
    () => ({
      messages: commentsAsMessages(comments),
      isLoading,
      error,
      placeholder: 'Add your comment',
      sendMessage: ({ userId, content, replyToMessageId }) => send({ userId, content, replyToId: replyToMessageId }),
      reportMessage: report,
      blockUser: meId ? (blockedId) => block(meId, blockedId) : undefined,
      header: (
        <View style={{ paddingHorizontal: t.space[4], paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ borderRadius: 16, backgroundColor: t.color.surface, paddingVertical: 20 }}>
            <GameCentreCardHeader title={title} subtitle={subtitle ?? null} />
          </View>
        </View>
      ),
    }),
    [block, comments, error, isLoading, meId, report, send, subtitle, t.color.surface, t.space, title]
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <LeagueChatTabV2 leagueId="" members={authors} source={source} />
    </View>
  );
}
