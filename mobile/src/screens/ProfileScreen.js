// ProfileScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@theme';

export default function ProfileScreen({ route, navigation }) {
  const { employeeId, employeeName } = route.params;
  const [isDarkMode, setIsDarkMode] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bubbleAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;

  // ---------------------------------------------------------------
  // Load theme from cache on mount
  // ---------------------------------------------------------------
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_KEY);
        if (stored === 'dark') {
          setIsDarkMode(true);
        } else if (stored === 'light') {
          setIsDarkMode(false);
        }
        // Start fade-in animation
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        console.error('Failed to load theme', error);
      }
    };

    loadTheme();
  }, []);

  // Bubble animation loop
  useEffect(() => {
    bubbleAnims.forEach((anim, idx) => {
      const distance = -320 - idx * 40;
      const duration = 6500 + idx * 500;
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    });
  }, [bubbleAnims]);

  // ---------------------------------------------------------------
  // Toggle theme + save to cache
  // ---------------------------------------------------------------
  const toggleTheme = async () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    try {
      await AsyncStorage.setItem(THEME_KEY, newDarkMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Failed to save theme', error);
    }
  };

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Background accents */}
      <View style={[styles.bgCircleOne, isDarkMode ? styles.bgCircleOneDark : styles.bgCircleOneLight]} />
      <View style={[styles.bgCircleTwo, isDarkMode ? styles.bgCircleTwoDark : styles.bgCircleTwoLight]} />
      <View style={styles.bubblesLayer} pointerEvents="none">
        {bubbleAnims.map((anim, idx) => {
          const size = 40 + idx * 12;
          const left = 10 + (idx % 3) * 25;
          return (
            <Animated.View
              key={idx}
              style={[
                styles.bubble,
                { width: size, height: size, left: `${left}%`, opacity: 0.6 },
                { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [80, -320 - idx * 20] }) }] },
              ]}
            />
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDarkMode ? '#fff' : '#1f2937'}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
            Profile
          </Text>
          <TouchableOpacity onPress={toggleTheme}>
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={24}
              color={isDarkMode ? '#fff' : '#1f2937'}
            />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <Animated.View style={[styles.card, isDarkMode ? styles.cardDark : styles.cardLight, { opacity: fadeAnim }]}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, isDarkMode && styles.avatarDark]}>
              <Text style={styles.avatarText}>
                {employeeName?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            My Profile
          </Text>

          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons
                  name="person-circle-outline"
                  size={20}
                  color={isDarkMode ? '#9ca3af' : '#6b7280'}
                />
                <Text style={[styles.label, isDarkMode && styles.labelDark]}>
                  Employee ID:
                </Text>
              </View>
              <Text style={[styles.value, isDarkMode && styles.valueDark]}>
                {employeeId}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons
                  name="id-card-outline"
                  size={20}
                  color={isDarkMode ? '#9ca3af' : '#6b7280'}
                />
                <Text style={[styles.label, isDarkMode && styles.labelDark]}>
                  Name:
                </Text>
              </View>
              <Text style={[styles.value, isDarkMode && styles.valueDark]}>
                {employeeName}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Quick Actions */}
        <View style={[styles.statsCard, isDarkMode ? styles.statsCardDark : styles.statsCardLight]}>
          <Text style={[styles.statsTitle, isDarkMode && styles.statsTitleDark]}>
            Quick Actions
          </Text>

          <View style={styles.statsRow}>
            <TouchableOpacity
              style={[styles.statItem, isDarkMode && styles.statItemDark]}
              onPress={() => navigation.navigate('History', { employeeId })}
            >
              <Ionicons
                name="time-outline"
                size={24}
                color={isDarkMode ? '#818cf8' : '#4f46e5'}
              />
              <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statItem, isDarkMode && styles.statItemDark]}
              onPress={() => navigation.navigate('Deduct', { employeeId, employeeName })}
            >
              <Ionicons
                name="remove-circle-outline"
                size={24}
                color={isDarkMode ? '#818cf8' : '#4f46e5'}
              />
              <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                Deduct
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statItem, isDarkMode && styles.statItemDark]}
              onPress={() => navigation.navigate('Dashboard', { employeeId, employeeName })}
            >
              <Ionicons
                name="home-outline"
                size={24}
                color={isDarkMode ? '#818cf8' : '#4f46e5'}
              />
              <Text style={[styles.statLabel, isDarkMode && styles.statLabelDark]}>
                Home
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// -------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  containerDark: {
    backgroundColor: '#0b1224',
  },
  bgCircleOne: { position: 'absolute', width: 260, height: 260, borderRadius: 130 },
  bgCircleOneLight: { backgroundColor: '#a5b4fc', opacity: 0.22, top: -60, right: -40 },
  bgCircleOneDark: { backgroundColor: '#4338ca', opacity: 0.18, top: -60, right: -40 },
  bgCircleTwo: { position: 'absolute', width: 220, height: 220, borderRadius: 110 },
  bgCircleTwoLight: { backgroundColor: '#7dd3fc', opacity: 0.18, bottom: -50, left: -30 },
  bgCircleTwoDark: { backgroundColor: '#0ea5e9', opacity: 0.14, bottom: -50, left: -30 },
  bubblesLayer: {
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
    top: 0,
  },
  bubble: {
    position: 'absolute',
    bottom: -40,
    backgroundColor: '#7c3aed',
    borderRadius: 999,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerTitleDark: {
    color: '#e5e7eb',
  },

  card: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    marginBottom: 24,
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderColor: 'rgba(0,0,0,0.05)',
  },
  cardDark: {
    backgroundColor: 'rgba(17,24,39,0.75)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarDark: {
    backgroundColor: '#818cf8',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: '#3d4a63ff',
    marginBottom: 24,
  },
  titleDark: {
    color: '#e5e7eb',
  },
  infoContainer: {
    width: '100%',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontWeight: '700',
    color: '#273a52ff',
    fontSize: 17,
    letterSpacing: 0.2,
    marginLeft: 8,
  },
  labelDark: {
    color: '#cbd5e1',
  },
  value: {
    color: '#283859ff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  valueDark: {
    color: '#e5e7eb',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    width: '100%',
  },
  statsCard: {
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderWidth: 1,
  },
  statsCardLight: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statsCardDark: {
    backgroundColor: 'rgba(17,24,39,0.75)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsTitleDark: {
    color: '#f9fafb',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    minWidth: 80,
  },
  statItemDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: {
    marginTop: 8,
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500',
  },
  statLabelDark: {
    color: '#cbd5e1',
  },
});