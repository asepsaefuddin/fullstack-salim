import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TaskCard({ task, onPress, isNew, isDarkMode = false }) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        style={[
          styles.card,
          isDarkMode && styles.cardDark,
          isNew && { borderLeftColor: isDarkMode ? '#818cf8' : '#6366f1' },
          task.status === 'completed' && styles.completedCard
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>{task.title}</Text>
          {isNew && (
            <View style={[styles.newBadge, isDarkMode && styles.newBadgeDark]}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>
        
        <Text
          style={[styles.description, isDarkMode && styles.descriptionDark]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {task.description || 'No description'}
        </Text>
        
        {task.items && task.items.length > 0 && (
          <View style={styles.itemsContainer}>
            {task.items.map((item, index) => (
              <Text key={index} style={[styles.itemText, isDarkMode && styles.itemTextDark]}>
                • {item.item_name} ({item.required_qty})
              </Text>
            ))}
          </View>
        )}
        
        <View style={styles.footer}>
          <Text style={[styles.status, isDarkMode && styles.statusDark]}>
            Status: {task.status === 'completed' ? '✅ Completed' : '🟡 Pending'}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={24}
            color={isDarkMode ? '#9ca3af' : '#6b7280'}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981', // Default green for completed tasks
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDark: {
    backgroundColor: '#374151',
  },
  completedCard: {
    opacity: 0.85,
    borderLeftColor: '#10b981', // Green for completed tasks
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontWeight: '700',
    fontSize: 18,
    color: '#1f2937',
    flex: 1,
    marginRight: 12,
  },
  titleDark: {
    color: '#f9fafb',
  },
  newBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  newBadgeDark: {
    backgroundColor: '#818cf8',
  },
  newBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    color: '#6b7280',
    fontSize: 15,
    marginBottom: 12,
    lineHeight: 22,
  },
  descriptionDark: {
    color: '#9ca3af',
  },
  itemsContainer: {
    marginBottom: 12,
  },
  itemText: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
  },
  itemTextDark: {
    color: '#d1d5db',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  status: {
    color: '#6b7280',
    fontSize: 14,
  },
  statusDark: {
    color: '#9ca3af',
  },
});