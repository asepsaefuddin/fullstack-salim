import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function HistoryItem({ item, isDarkMode = false }) {
  const isDeduct = item.action === 'deduct';
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
      <View
        style={[
          styles.card,
          isDarkMode && styles.cardDark,
          { borderLeftColor: isDeduct ? '#dc2626' : '#10b981' },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.itemName, isDarkMode && styles.itemNameDark]}>
            {item.item_name}
          </Text>
          <View
            style={[
              styles.badge,
              isDeduct ? styles.deductBadge : styles.restockBadge,
              isDarkMode && (isDeduct ? styles.deductBadgeDark : styles.restockBadgeDark),
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: isDeduct ? '#dc2626' : '#10b981' },
              ]}
            >
              {isDeduct ? 'Deducted' : 'Restocked'}
            </Text>
          </View>
        </View>
        <Text style={[styles.date, isDarkMode && styles.dateDark]}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, isDarkMode && styles.detailLabelDark]}>
            Qty:
          </Text>
          <Text style={[styles.detailValue, isDarkMode && styles.detailValueDark]}>
            {item.qty}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, isDarkMode && styles.detailLabelDark]}>
            By:
          </Text>
          <Text style={[styles.detailValue, isDarkMode && styles.detailValueDark]}>
            {item.employee_name || '-'}
          </Text>
        </View>
      </View>
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
  itemName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
    marginRight: 12,
  },
  itemNameDark: {
    color: '#f9fafb',
  },
  badge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  deductBadge: {
    backgroundColor: '#fee2e2',
  },
  deductBadgeDark: {
    backgroundColor: '#b91c1c',
  },
  restockBadge: {
    backgroundColor: '#d1fae5',
  },
  restockBadgeDark: {
    backgroundColor: '#047857',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  date: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 10,
    lineHeight: 20,
  },
  dateDark: {
    color: '#9ca3af',
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  detailLabel: {
    fontWeight: '700',
    color: '#6b7280',
    width: 40,
  },
  detailLabelDark: {
    color: '#9ca3af',
  },
  detailValue: {
    color: '#4b5563',
    marginLeft: 8,
    fontSize: 15,
  },
  detailValueDark: {
    color: '#d1d5db',
  },
});