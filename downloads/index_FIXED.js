/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Register background message handler (must be done outside of React components)
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('📨 Background FCM message received in index.js:', remoteMessage);

  // Create notification channel if it doesn't exist
  const channelId = await notifee.createChannel({
    id: 'default',
    name: 'Default Channel',
    importance: AndroidImportance.HIGH,
  });

  // Display notification
  await notifee.displayNotification({
    title: remoteMessage.notification?.title || 'New Message',
    body: remoteMessage.notification?.body || '',
    data: remoteMessage.data,
    android: {
      channelId,
      importance: AndroidImportance.HIGH,
      pressAction: {
        id: 'default',
      },
      smallIcon: 'ic_notification',
    },
  });
});

AppRegistry.registerComponent(appName, () => App);
