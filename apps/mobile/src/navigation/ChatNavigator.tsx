import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTokens } from '@totl/ui';

import ChatInboxScreen from '../screens/ChatInboxScreen';

export type ChatStackParamList = {
  ChatInbox: undefined;
};

const Stack = createNativeStackNavigator<ChatStackParamList>();

export default function ChatNavigator() {
  const t = useTokens();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.color.background },
      }}
    >
      <Stack.Screen name="ChatInbox" component={ChatInboxScreen} />
    </Stack.Navigator>
  );
}

