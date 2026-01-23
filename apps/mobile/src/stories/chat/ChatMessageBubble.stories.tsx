import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import ChatMessageBubble from '../../components/chat/ChatMessageBubble';

export default {
  title: 'Chat/ChatMessageBubble',
};

export function OtherWithReactions() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <ChatMessageBubble
          isMe={false}
          authorName="ThomasJamesBird"
          message={{
            id: '1',
            league_id: 'l1',
            user_id: 'u1',
            content: 'This is a message with reactions.',
            created_at: new Date().toISOString(),
          }}
          reactions={[
            { emoji: '👍', count: 3, hasUserReacted: true },
            { emoji: '😂', count: 1, hasUserReacted: false },
          ]}
          onPressReaction={() => {}}
        />
      </View>
    </Screen>
  );
}

export function MeSending() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <ChatMessageBubble
          isMe
          authorName="You"
          message={{
            id: 'optimistic-1',
            league_id: 'l1',
            user_id: 'me',
            content: 'Sending message…',
            created_at: new Date().toISOString(),
            status: 'sending',
          }}
        />
      </View>
    </Screen>
  );
}

