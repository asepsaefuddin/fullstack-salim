import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import { Audio } from 'expo-av';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import DeductScreen from '../screens/DeductScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';

const Stack = createStackNavigator();

// Configure notification behavior when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function AppNavigator() {
  const navigationRef = useRef(null);
  const soundRef = useRef(null);
  const foregroundSubscription = useRef();
  const responseSubscription = useRef();

  const playRingtone = async () => {
    try {
      console.log('playRingtone called');
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/ringtone.mp3'),
        { shouldPlay: true, isLooping: true }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.error('Error playing ringtone:', error);
    }
  };

  const stopRingtone = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  };

  const handleIncomingCall = async (notification) => {
    let data = notification.request.content.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch {}
    }
    stopRingtone(); // Stop any previous ringtone
    Vibration.vibrate([500, 500], true);

    // Get current route
    const currentRoute = navigationRef.current?.getCurrentRoute();
    const employeeId = data?.employeeId;
    let employeeName = data?.employeeName;

    // Fallback to AsyncStorage if employeeName not in notification
    if (!employeeName) {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          employeeName = user.name;
        }
      } catch (e) {
        console.warn('Failed to load user from storage:', e);
      }
    }

    // Navigate to Dashboard with refresh flag and incomingCall data
    navigationRef.current?.navigate('Dashboard', {
      employeeId,
      employeeName,
      refresh: true,
      incomingCall: data,
    });
  };

  useEffect(() => {
    // Android-specific: register 'calls' channel
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('calls', {
        name: 'Calls',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'ringtone',
        vibrationPattern: [500, 500],
        lightColor: '#FF231F7C',
      });
    }

    const setAudioMode = async () => {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    };
    setAudioMode();
  }, []);

  useEffect(() => {
    // Ask for permissions
    const registerForPushNotifications = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Notification permission not granted!');
        return;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      console.log("Expo Push Token:", tokenData.data);
    };

    registerForPushNotifications();

    foregroundSubscription.current = Notifications.addNotificationReceivedListener(handleIncomingCall);
    responseSubscription.current = Notifications.addNotificationResponseReceivedListener(async response => {
      let data = response.notification.request.content.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch {}
      }

      stopRingtone();
      Vibration.cancel();

      let employeeId = data?.employeeId;
      let employeeName = data?.employeeName;

      if (!employeeId) {
        try {
          const storedUser = await AsyncStorage.getItem('user');
          if (storedUser) {
            const user = JSON.parse(storedUser);
            employeeId = user.id;
            employeeName = user.name;
          }
        } catch (e) {
          console.warn('Failed to load user from storage:', e);
        }
      }

      // Navigate to Dashboard with refresh flag and incomingCall data
      navigationRef.current?.navigate('Dashboard', {
        employeeId,
        employeeName,
        refresh: true,
        incomingCall: data,
      });
    });

    return () => {
      foregroundSubscription.current?.remove();
      responseSubscription.current?.remove();
      stopRingtone();
      Vibration.cancel();
    };
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Deduct" component={DeductScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}