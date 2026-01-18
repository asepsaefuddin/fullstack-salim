// SearchScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
  Animated,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { getItems } from '../api';
import ItemCard from '../components/ItemCard';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PAGE_SIZE = 10;
const CACHE_ITEMS_KEY = 'search_cached_items';

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

export default function SearchScreen({ navigation, route }) {
  const { employeeId, employeeName } = route.params || {};
  const [query, setQuery] = useState('');
  const [allItems, setAllItems] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      const items = await getItems();
      const safeItems = Array.isArray(items) ? items : [];

      if (!deepEqual(allItems, safeItems)) {
        setAllItems(safeItems);
        await saveToCache(safeItems);
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
      const items = await getItems();
      const safeItems = Array.isArray(items) ? items : [];

      setAllItems(safeItems);
      await saveToCache(safeItems);
    } catch (error) {
      console.error('Pull refresh failed:', error);
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
      setPage(1);
      setLoading(false);
      startFadeIn();
    }

    try {
      const items = await getItems();
      const safeItems = Array.isArray(items) ? items : [];

      if (!deepEqual(cached, safeItems)) {
        setAllItems(safeItems);
        await saveToCache(safeItems);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
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

  // Search + filter
  useEffect(() => {
    const lower = query.toLowerCase();
    const result = allItems.filter(
      item =>
        (item.name || '').toLowerCase().includes(lower) ||
        (item.category || '').toLowerCase().includes(lower)
    );
    setFiltered(result);
    setPage(1);
  }, [query, allItems]);

  // Pagination
  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const handleLoadMore = () => {
    if (paginated.length < filtered.length) {
      setPage(p => p + 1);
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
          Search Items
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
          placeholder="Search items by name or category..."
          placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
          value={query}
          onChangeText={setQuery}
          style={[styles.input, isDarkMode && styles.inputDark]}
        />
      </View>

      {/* Items List with Pull-to-Refresh */}
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={paginated}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <View style={[styles.itemCardContainer, isDarkMode && styles.itemCardContainerDark]}>
              <ItemCard
                item={item}
                onPress={() => navigation.navigate('Deduct', { preselectedItem: item, employeeId, employeeName })}
                showDeductButton
                onDeduct={() => navigation.navigate('Deduct', { preselectedItem: item, employeeId, employeeName })}
              />
            </View>
          )}
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
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={paginated.length === 0 ? { flex: 1, justifyContent: 'center' } : { paddingBottom: 40 }}
        />
      </Animated.View>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f3f4f6' },
  containerDark: { backgroundColor: '#1f2937' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#1f2937' },
  titleDark: { color: '#f9fafb' },
  refreshBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366f1', alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  refreshText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  searchContainerDark: { backgroundColor: '#374151', borderColor: '#4b5563' },
  input: { flex: 1, marginLeft: 10, fontSize: 16, color: '#1f2937' },
  inputDark: { color: '#f9fafb' },
  emptyText: { color: '#6b7280', textAlign: 'center', fontSize: 16, marginTop: 30 },
  emptyTextDark: { color: '#9ca3af' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  loadingContainerDark: { backgroundColor: '#1f2937' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#1f2937' },
  loadingTextDark: { color: '#f9fafb' },
  itemCardContainer: { backgroundColor: '#ffffff', borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#6366f1', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  itemCardContainerDark: { backgroundColor: '#374151', borderLeftColor: '#818cf8' },
});