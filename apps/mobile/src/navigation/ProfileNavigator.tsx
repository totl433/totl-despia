import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTokens } from '@totl/ui';

import ProfileHomeScreen from '../screens/profile/ProfileHomeScreen';
import ProfileStatsScreen from '../screens/profile/ProfileStatsScreen';
import NotificationCentreScreen from '../screens/profile/NotificationCentreScreen';
import EmailPreferencesScreen from '../screens/profile/EmailPreferencesScreen';
import EditAvatarScreen from '../screens/profile/EditAvatarScreen';
import AdminHomeScreen from '../screens/profile/AdminHomeScreen';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  ProfileStats: undefined;
  NotificationCentre: undefined;
  EmailPreferences: undefined;
  EditAvatar: undefined;
  AdminHome: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  const t = useTokens();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.color.background },
      }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileHomeScreen} />
      <Stack.Screen name="ProfileStats" component={ProfileStatsScreen} />
      <Stack.Screen name="NotificationCentre" component={NotificationCentreScreen} />
      <Stack.Screen name="EmailPreferences" component={EmailPreferencesScreen} />
      <Stack.Screen name="EditAvatar" component={EditAvatarScreen} />
      <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
    </Stack.Navigator>
  );
}

