import React from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTokens } from '@totl/ui';

import LeagueChatTabV2, { type ChatThreadSource } from '../components/chat/LeagueChatTabV2';
import ChatStackHeaderTitle from '../components/chat/ChatStackHeaderTitle';
import { GameCentreCardHeader } from '../components/gameCentre/GameCentreCard';
import GameCentreMatchChatHeader, { type MatchChatSide } from '../components/gameCentre/GameCentreMatchChatHeader';
import { matchDateVenueLine } from '../features/gameCentre/venues';
import { commentsAsMessages, useCardComments } from '../hooks/useCardComments';
import { useLiveScores } from '../hooks/useLiveScores';
import { fixtureKickoffTimeLabel } from '../lib/homeFixtureUi';
import { supabase } from '../lib/supabase';

/** The match behind a fixture thread, for the header at the top. */
export type CardCommentsMatch = {
  gw: number;
  fixtureIndex: number;
  apiMatchId: number | null;
  kickoffTime: string | null;
  home: MatchChatSide;
  away: MatchChatSide;
};

export type CardCommentsParams = {
  /** The thread's id: mc:gw7:fixture:9 for a match, else the card's own id. */
  cardId: string;
  title: string;
  subtitle?: string | null;
  /** Set for a match thread: the header shows the match instead of the card. */
  match?: CardCommentsMatch | null;
};

/**
 * A public Game Centre thread: one per match, shared by all that match's cards, or one per
 * card outside a match. Built on the Mini League chat view, with every comment left-aligned.
 * Each card's footer posts into the same thread.
 */
export default function CardCommentsScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const { cardId, title, subtitle, match } = useRoute<any>().params as CardCommentsParams;
  const { comments, authors, isLoading, error, send, report, block } = useCardComments(cardId);

  // The score keeps up while the thread is open.
  const { liveByFixtureIndex, liveByApiMatchId } = useLiveScores(match?.gw ?? null);
  const live = match
    ? (match.apiMatchId != null ? liveByApiMatchId.get(match.apiMatchId) : undefined) ?? liveByFixtureIndex.get(match.fixtureIndex)
    : undefined;
  const started = !!live && (live.status === 'IN_PLAY' || live.status === 'PAUSED' || live.status === 'FINISHED');
  const centre = match
    ? started && typeof live?.home_score === 'number' && typeof live?.away_score === 'number'
      ? `${live.home_score} - ${live.away_score}`
      : fixtureKickoffTimeLabel(match.kickoffTime)
    : '';

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
          {match ? (
            <GameCentreMatchChatHeader
              home={match.home}
              away={match.away}
              centre={centre}
              competition={`Premier League · Matchweek ${match.gw}`}
              dateVenue={matchDateVenueLine(match.kickoffTime, match.home.code)}
            />
          ) : (
            <View style={{ borderRadius: 16, backgroundColor: t.color.surface, paddingVertical: 20 }}>
              <GameCentreCardHeader title={title} subtitle={subtitle ?? null} />
            </View>
          )}
        </View>
      ),
    }),
    [block, centre, comments, error, isLoading, match, meId, report, send, subtitle, t.color.surface, t.space, title]
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.color.background }}>
      <LeagueChatTabV2 leagueId="" members={authors} source={source} />
    </View>
  );
}
