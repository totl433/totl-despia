import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    // Push tokens require a physical device.
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const token = await Notifications.getExpoPushTokenAsync();
  const expoPushToken = token.data;
  if (!expoPushToken) return;

  await api.registerExpoPushToken({
    expoPushToken,
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : undefined,
  });
}

