import React from 'react';
import { View } from 'react-native';
import { Screen } from '@totl/ui';

import ChatComposer from '../../components/chat/ChatComposer';

export default {
  title: 'Chat/ChatComposer',
};

export function Empty() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <ChatComposer value="" onChange={() => {}} onSend={() => {}} sending={false} replyPreview={null} onCancelReply={() => {}} />
      </View>
    </Screen>
  );
}

export function Replying() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <ChatComposer
          value="Yep"
          onChange={() => {}}
          onSend={() => {}}
          sending={false}
          replyPreview={{ content: 'Original message text', authorName: 'Carl' }}
          onCancelReply={() => {}}
        />
      </View>
    </Screen>
  );
}

