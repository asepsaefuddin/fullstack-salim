import React, { useEffect } from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';

export default function App() {
  useEffect(() => {
    // No need for useRef if you're just cleaning up in the effect
    let notificationListener: Notifications.Subscription;
    let responseListener: Notifications.Subscription;

    // Configure notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,  // iOS only (Android will ignore)
        shouldShowList: true     // iOS only (Android will ignore)
      }),
    });

    // Set up listeners
    notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      // Handle navigation or other actions here
    });

    // Register for push notifications
    const registerForPushNotifications = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied for notifications!');
        return;
      }

      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'com.jethroelijah.mobile', // Replace with your actual project ID
      })).data;

      console.log('Expo Push Token:', token);
      // Here you would typically send the token to your backend server
      // await saveTokenToBackend(token);
    };

    registerForPushNotifications();

    return () => {
      // Cleanup - no null checks needed since we declare in scope
      notificationListener?.remove();
      responseListener?.remove();
    };
  }, []);

  return <AppNavigator />;
}