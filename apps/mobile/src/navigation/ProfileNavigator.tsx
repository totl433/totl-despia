import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTokens } from '@totl/ui';

import ProfileHomeScreen from '../screens/profile/ProfileHomeScreen';
import ProfileStatsScreen from '../screens/profile/ProfileStatsScreen';
import NotificationCentreScreen from '../screens/profile/NotificationCentreScreen';
import EmailPreferencesScreen from '../screens/profile/EmailPreferencesScreen';
import EditAvatarScreen from '../screens/profile/EditAvatarScreen';
import AdminHomeScreen from '../screens/profile/AdminHomeScreen';
import AdminHomeSimulatorScreen from '../screens/profile/AdminHomeSimulatorScreen';
import HowToPlayScreen from '../screens/profile/HowToPlayScreen';
import ContactUsScreen from '../screens/profile/ContactUsScreen';
import CookiePolicyScreen from '../screens/profile/CookiePolicyScreen';
import PrivacyPolicyScreen from '../screens/profile/PrivacyPolicyScreen';
import TermsConditionsScreen from '../screens/profile/TermsConditionsScreen';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  ProfileStats: undefined;
  NotificationCentre: undefined;
  EmailPreferences: undefined;
  EditAvatar: undefined;
  AdminHome: undefined;
  AdminHomeSimulator: undefined;
  HowToPlay: undefined;
  ContactUs: undefined;
  CookiePolicy: undefined;
  PrivacyPolicy: undefined;
  TermsConditions: undefined;
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
      <Stack.Screen name="AdminHomeSimulator" component={AdminHomeSimulatorScreen} />
      <Stack.Screen name="HowToPlay" component={HowToPlayScreen} />
      <Stack.Screen name="ContactUs" component={ContactUsScreen} />
      <Stack.Screen name="CookiePolicy" component={CookiePolicyScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="TermsConditions" component={TermsConditionsScreen} />
    </Stack.Navigator>
  );
}

