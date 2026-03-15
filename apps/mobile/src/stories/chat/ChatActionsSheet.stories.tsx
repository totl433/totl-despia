import React from 'react';
import { View } from 'react-native';
import { Screen, TotlText } from '@totl/ui';

import ChatActionsSheet from '../../components/chat/ChatActionsSheet';

export default {
  title: 'Chat/ChatActionsSheet',
};

export function Open() {
  return (
    <Screen fullBleed>
      <View style={{ padding: 16 }}>
        <TotlText variant="muted">Sheet is open.</TotlText>
      </View>
      <ChatActionsSheet open onClose={() => {}} onReply={() => {}} onReact={() => {}} />
    </Screen>
  );
}

