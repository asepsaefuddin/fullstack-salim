// DeductScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  RefreshControl,
} from 'react-native';
import { getItems, deductItem } from '../api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_ITEMS_KEY = 'deduct_cached_items';

// Deep equality
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false;
  }
  return true;
};

// Cache helpers
const loadFromCache = async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_ITEMS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveToCache = async (data) => {
  try {
    await AsyncStorage.setItem(CACHE_ITEMS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to cache items', e);
  }
};

export default function DeductScreen({ route, navigation }) {
  const { employeeId, employeeName, preselectedItem } = route.params || {};
  const [allItems, setAllItems] = useState([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(preselectedItem ? [{ item: preselectedItem, qty: '' }] : []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deducting, setDeducting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);

  const startFadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  // Silent background refresh
  const backgroundRefresh = useCallback(async () => {
    if (refreshing || loading) return;
    setRefreshing(true);

    try {
      const data = await getItems();
      const safeData = Array.isArray(data) ? data : [];

      if (!deepEqual(allItems, safeData)) {
        setAllItems(safeData);
        await saveToCache(safeData);
      }
    } catch (error) {
      console.error('Background refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [allItems, loading, refreshing]);

  // Manual pull-to-refresh (user-triggered)
  const onPullRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await getItems();
      const safeData = Array.isArray(data) ? data : [];

      setAllItems(safeData);
      await saveToCache(safeData);
    } catch (error) {
      Alert.alert("Error", "Failed to refresh items");
    } finally {
      setRefreshing(false);
    }
  };

  // Initial load
  const loadItems = useCallback(async () => {
    setLoading(true);
    const cached = await loadFromCache();

    if (Array.isArray(cached)) {
      setAllItems(cached);
      setFiltered(cached);
      setLoading(false);
      startFadeIn();
    }

    try {
      const data = await getItems();
      const safeData = Array.isArray(data) ? data : [];

      if (!deepEqual(cached, safeData)) {
        setAllItems(safeData);
        await saveToCache(safeData);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load items");
    } finally {
      setLoading(false);
      if (!cached) startFadeIn();
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(backgroundRefresh, 30000);
    return () => clearInterval(interval);
  }, [backgroundRefresh]);

  // Search handler
  useEffect(() => {
    const lower = search.toLowerCase();
    const result = allItems.filter(
      item =>
        (item.name || '').toLowerCase().includes(lower) ||
        (item.category || '').toLowerCase().includes(lower)
    );
    setFiltered(result);
  }, [search, allItems]);

  // Selection handlers
  const handleAddItem = (item) => {
    if (selected.find(sel => sel.item.id === item.id)) return;
    setSelected(prev => [...prev, { item, qty: '' }]);
    setSearch('');
  };

  const handleQtyChange = (idx, qty) => {
    setSelected(prev => prev.map((sel, i) => i === idx ? { ...sel, qty } : sel));
  };

  const handleRemove = (idx) => {
    setSelected(prev => prev.filter((_, i) => i !== idx));
  };

  // Deduct
  const handleDeduct = async () => {
  if (selected.length === 0) {
    Alert.alert("Error", "Add at least one item");
    return;
  }

  for (const sel of selected) {
    if (!sel.item?.id) {
      Alert.alert("Error", "Invalid item selected");
      return;
    }
    if (!sel.qty || isNaN(sel.qty) || Number(sel.qty) <= 0) {
      Alert.alert("Error", `Invalid quantity for ${sel.item.name}`);
      return;
    }
  }

  setDeducting(true);
  try {
    await deductItem({
      employeeId,
      employeeName,
      items: selected.map(sel => ({
        itemId: sel.item.id,
        qty: parseInt(sel.qty),
      })),
    });

    // Clear cache to force fresh data
    await AsyncStorage.removeItem(CACHE_ITEMS_KEY);
    
    // Reload items to show updated stock
    await loadItems();
    
    // Clear selection
    setSelected([]);
    
    Alert.alert("Success", "Items deducted successfully. Stock has been updated.", [
      { text: "OK", onPress: () => navigation.goBack() }
    ]);
  } catch (error) {
    console.error('❌ Deduction error:', error);
    Alert.alert("Error", error.message || "Deduction failed");
  } finally {
    setDeducting(false);
  }
};

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Loading UI
  if (loading) {
    return (
      <View style={[styles.loadingContainer, isDarkMode && styles.loadingContainerDark]}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
          Loading from cache…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, isDarkMode && styles.titleDark]}>
          Add Items to Deduct
        </Text>
        <TouchableOpacity onPress={toggleTheme}>
          <Ionicons
            name={isDarkMode ? 'sunny' : 'moon'}
            size={24}
            color={isDarkMode ? '#fff' : '#1f2937'}
          />
        </TouchableOpacity>
      </View>

      {/* Subtle Refresh Badge (background sync) */}
      {refreshing && !loading && (
        <View style={styles.refreshBadge}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.refreshText}>Updating…</Text>
        </View>
      )}

      {/* Search */}
      <View style={[styles.searchContainer, isDarkMode && styles.searchContainerDark]}>
        <Ionicons name="search" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
        <TextInput
          placeholder="Search items..."
          placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, isDarkMode && styles.searchInputDark]}
        />
      </View>

      {/* Items List + Selected */}
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={filtered}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.itemRow, isDarkMode && styles.itemRowDark]}
              onPress={() => handleAddItem(item)}
              activeOpacity={0.8}
            >
              <Text style={[styles.itemName, isDarkMode && styles.itemNameDark]}>
                {item.name}
              </Text>
              <Text style={[styles.itemStock, isDarkMode && styles.itemStockDark]}>
                {item.stock} in stock
              </Text>
            </TouchableOpacity>
          )}
          style={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullRefresh}
              colors={['#6366f1']}
              tintColor="#6366f1"
              progressBackgroundColor={isDarkMode ? '#374151' : '#ffffff'}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
              No items found.
            </Text>
          }
        />

        {/* Selected Items */}
        {selected.length > 0 && (
          <View style={[styles.selectedSection, isDarkMode && styles.selectedSectionDark]}>
            <Text style={[styles.selectedTitle, isDarkMode && styles.selectedTitleDark]}>
              Selected Items
            </Text>
            {selected.map((sel, idx) => (
              <View key={`${sel.item.id}-${idx}`} style={styles.selectedRow}>
                <Text style={[styles.selectedItemName, isDarkMode && styles.selectedItemNameDark]}>
                  {sel.item.name}
                </Text>
                <TextInput
                  placeholder="Qty"
                  placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                  value={sel.qty}
                  onChangeText={qty => handleQtyChange(idx, qty)}
                  keyboardType="numeric"
                  style={[styles.qtyInput, isDarkMode && styles.qtyInputDark]}
                />
                <TouchableOpacity
                  onPress={() => handleRemove(idx)}
                  style={styles.removeBtn}
                >
                  <Text style={styles.removeBtnText}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Deduct Button */}
        <TouchableOpacity
          style={[
            styles.deductBtn,
            deducting ? styles.deductBtnDisabled : styles.deductBtnActive,
            isDarkMode && (deducting ? styles.deductBtnDisabledDark : styles.deductBtnActiveDark)
          ]}
          onPress={handleDeduct}
          disabled={deducting}
        >
          <Text style={styles.deductBtnText}>
            {deducting ? "Processing..." : "Deduct All"}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// Styles (unchanged)
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f3f4f6' },
  containerDark: { backgroundColor: '#1f2937' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#1f2937' },
  titleDark: { color: '#f9fafb' },
  refreshBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366f1', alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  refreshText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, padding: 14, marginBottom: 24, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  searchContainerDark: { backgroundColor: '#374151', borderColor: '#4b5563' },
  searchInput: { flex: 1, marginLeft: 10, color: '#1f2937', fontSize: 16 },
  searchInputDark: { color: '#f9fafb' },
  list: { maxHeight: 200, marginBottom: 20 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#ffffff', borderRadius: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#6366f1', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  itemRowDark: { backgroundColor: '#374151', borderLeftColor: '#818cf8' },
  itemName: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  itemNameDark: { color: '#f9fafb' },
  itemStock: { fontSize: 14, color: '#6b7280' },
  itemStockDark: { color: '#9ca3af' },
  emptyText: { color: '#6b7280', textAlign: 'center', fontSize: 16, marginTop: 12 },
  emptyTextDark: { color: '#9ca3af' },
  selectedSection: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  selectedSectionDark: { backgroundColor: '#374151', borderColor: '#4b5563' },
  selectedTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#6366f1' },
  selectedTitleDark: { color: '#818cf8' },
  selectedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  selectedItemName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1f2937' },
  selectedItemNameDark: { color: '#f9fafb' },
  qtyInput: { borderWidth: 1, borderRadius: 8, borderColor: '#e5e7eb', padding: 10, width: 70, marginRight: 12, backgroundColor: '#ffffff', fontSize: 15, color: '#1f2937' },
  qtyInputDark: { borderColor: '#4b5563', backgroundColor: '#4b5563', color: '#f9fafb' },
  removeBtn: { backgroundColor: '#dc2626', borderRadius: 8, padding: 8 },
  removeBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  deductBtnActive: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  deductBtnActiveDark: { backgroundColor: '#818cf8' },
  deductBtnDisabled: { backgroundColor: '#d1d5db' },
  deductBtnDisabledDark: { backgroundColor: '#6b7280' },
  deductBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  loadingContainerDark: { backgroundColor: '#1f2937' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#1f2937' },
  loadingTextDark: { color: '#f9fafb' },
});