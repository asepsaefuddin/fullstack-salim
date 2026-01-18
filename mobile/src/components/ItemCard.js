import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ItemCard({ item, onPress, showDeductButton, onDeduct, isDarkMode = false }) {
  const isLowStock = Number(item.stock) < 1;
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
          { borderLeftColor: isLowStock ? '#dc2626' : '#6366f1' },
          isDarkMode && { borderLeftColor: isLowStock ? '#dc2626' : '#818cf8' }
        ]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.name, isDarkMode && styles.nameDark]}>{item.name}</Text>
          {isLowStock && (
            <View style={[styles.lowStockBadge, isDarkMode && styles.lowStockBadgeDark]}>
              <Text style={styles.lowStockBadgeText}>Low</Text>
            </View>
          )}
        </View>
        <Text style={[styles.detail, isDarkMode && styles.detailDark]}>
          Category: <Text style={[styles.detailValue, isDarkMode && styles.detailValueDark]}>{item.category}</Text>
        </Text>
        <Text style={[styles.detail, isDarkMode && styles.detailDark]}>
          Stock:{' '}
          <Text style={isLowStock ? styles.lowStock : styles.stockOk}>
            {item.stock}
          </Text>
        </Text>
        {showDeductButton && (
          <TouchableOpacity
            style={[
              styles.deductButton,
              { backgroundColor: isLowStock ? '#d1d5db' : '#4f46e5' },
              isDarkMode && { backgroundColor: isLowStock ? '#6b7280' : '#818cf8' }
            ]}
            onPress={onDeduct ? onDeduct : onPress}
            disabled={isLowStock}
            activeOpacity={0.85}
          >
            <Text style={styles.deductButtonText}>Deduct</Text>
          </TouchableOpacity>
        )}
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
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDark: {
    backgroundColor: '#374151',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  name: {
    fontWeight: '700',
    fontSize: 18,
    color: '#1f2937',
    flex: 1,
    marginRight: 12,
  },
  nameDark: {
    color: '#f9fafb',
  },
  lowStockBadge: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  lowStockBadgeDark: {
    backgroundColor: '#b91c1c',
  },
  lowStockBadgeText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 12,
  },
  detail: {
    color: '#6b7280',
    fontSize: 15,
    marginBottom: 6,
    lineHeight: 22,
  },
  detailDark: {
    color: '#9ca3af',
  },
  detailValue: {
    color: '#4b5563',
    fontWeight: '500',
  },
  detailValueDark: {
    color: '#d1d5db',
  },
  lowStock: {
    color: '#dc2626',
    fontWeight: '700',
  },
  stockOk: {
    color: '#10b981',
    fontWeight: '700',
  },
  deductButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  deductButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});