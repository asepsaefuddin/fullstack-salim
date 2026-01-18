import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Alert, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { login, registerPushToken } from '../api';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const checkLogin = async () => {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        navigation.replace('Dashboard', {
          employeeId: user.id,
          employeeName: user.name
        });
      } else {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.spring(cardAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          })
        ]).start();
      }
    };
    checkLogin();

    const subscription = Notifications.addNotificationReceivedListener(handleNotification);
    return () => subscription.remove();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const user = await login(name, pin);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      try {
        await registerForPushNotifications(user.id);
      } catch (pushErr) {
        console.warn('Push registration failed:', pushErr);
      }

      navigation.replace('Dashboard', {
        employeeId: user.id,
        employeeName: user.name
      });
    } catch (loginErr) {
      console.error("Login error:", loginErr);
      Alert.alert("Login Failed", loginErr.message || "Unknown error");
    }
    setLoading(false);
  };

  const handleNotification = (notification) => {
    console.log('Notification received:', notification);
  };

  const registerForPushNotifications = async (employeeId) => {
    if (!Device.isDevice) {
      Alert.alert('Warning', 'Push notifications only work on physical devices');
      return;
    }

    let { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert('Warning', 'Permission to receive notifications was denied');
      return;
    }

    try {
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'e964b13b-18df-4a8d-82dc-df2808c5238c'
      })).data;

      console.log('Successfully obtained Expo push token:', token);
      
      await registerPushToken(employeeId, token);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          showBadge: true,
          enableLights: true,
          enableVibrate: true,
        });
      }

      if (Platform.OS === 'ios') {
        const { status: iosStatus } = await Notifications.getPermissionsAsync();
        if (iosStatus !== 'granted') {
          Alert.alert('Warning', 'iOS notification permissions not granted');
        }
      }

      return token;
    } catch (error) {
      console.error('Error during push notification registration:', error);
      Alert.alert('Error', 'Failed to get push token. Please try again.');
      return null;
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <Animated.View style={{ opacity: fadeAnim, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View style={[styles.card, isDarkMode && styles.cardDark, { transform: [{ scale: cardAnim }] }]}>
          <View style={styles.header}>
            <Text style={[styles.title, isDarkMode && styles.titleDark]}>
              Employee Login
            </Text>
            <TouchableOpacity onPress={toggleTheme}>
              <Ionicons
                name={isDarkMode ? 'sunny' : 'moon'}
                size={24}
                color={isDarkMode ? '#fff' : '#1f2937'}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.inputContainer, isDarkMode && styles.inputContainerDark]}>
            <Ionicons name="person-outline" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
            <TextInput
              placeholder="Enter Name"
              placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
              value={name}
              onChangeText={setName}
              style={[styles.input, isDarkMode && styles.inputDark]}
              autoCapitalize="words"
              autoFocus
            />
          </View>
          <View style={[styles.inputContainer, isDarkMode && styles.inputContainerDark]}>
            <Ionicons name="lock-closed-outline" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
            <TextInput
              placeholder="Enter 4-digit PIN"
              placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
              keyboardType="numeric"
              value={pin}
              onChangeText={setPin}
              maxLength={4}
              style={[styles.input, isDarkMode && styles.inputDark]}
              secureTextEntry
            />
          </View>
          <TouchableOpacity
            style={[
              styles.loginBtn,
              { backgroundColor: loading ? '#d1d5db' : '#4f46e5' },
              isDarkMode && { backgroundColor: loading ? '#6b7280' : '#818cf8' }
            ]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginBtnText}>Login</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  containerDark: {
    backgroundColor: '#1f2937',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  cardDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
  },
  titleDark: {
    color: '#f9fafb',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  inputContainerDark: {
    backgroundColor: '#4b5563',
    borderColor: '#4b5563',
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#1f2937',
  },
  inputDark: {
    color: '#f9fafb',
  },
  loginBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});