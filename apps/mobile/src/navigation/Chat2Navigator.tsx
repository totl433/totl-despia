import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTokens } from '@totl/ui';

import Chat2InboxScreen from '../screens/Chat2InboxScreen';

export type Chat2StackParamList = {
  Chat2Inbox: undefined;
};

const Stack = createNativeStackNavigator<Chat2StackParamList>();

export default function Chat2Navigator() {
  const t = useTokens();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.color.background },
      }}
    >
      <Stack.Screen name="Chat2Inbox" component={Chat2InboxScreen} />
    </Stack.Navigator>
  );
}
