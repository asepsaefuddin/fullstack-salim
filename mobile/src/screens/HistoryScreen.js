// HistoryScreen.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { getHistory } from '../api';
import HistoryItem from '../components/HistoryItem';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PAGE_SIZE = 10;
const CACHE_HISTORY_KEY = 'history_cached_data';

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
    const raw = await AsyncStorage.getItem(CACHE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveToCache = async (data) => {
  try {
    await AsyncStorage.setItem(CACHE_HISTORY_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to cache history', e);
  }
};

export default function HistoryScreen({ route }) {
  const { employeeId } = route.params;
  const [allHistory, setAllHistory] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
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
      const data = await getHistory({ employeeId });
      const safeData = Array.isArray(data) ? data : [];

      if (!deepEqual(allHistory, safeData)) {
        setAllHistory(safeData);
        await saveToCache(safeData);
      }
    } catch (error) {
      console.error('Background refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [employeeId, allHistory, refreshing, loading]);

  // Manual pull-to-refresh (user-triggered)
  const onPullRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await getHistory({ employeeId });
      const safeData = Array.isArray(data) ? data : [];

      setAllHistory(safeData);
      await saveToCache(safeData);
    } catch (error) {
      console.error('Pull refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Initial load
  const loadHistory = useCallback(async () => {
    setLoading(true);
    const cached = await loadFromCache();

    if (Array.isArray(cached)) {
      setAllHistory(cached);
      setFiltered(cached);
      setPage(1);
      setLoading(false);
      startFadeIn();
    }

    try {
      const data = await getHistory({ employeeId });
      const safeData = Array.isArray(data) ? data : [];

      if (!deepEqual(cached, safeData)) {
        setAllHistory(safeData);
        await saveToCache(safeData);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
      if (!cached) startFadeIn();
    }
  }, [employeeId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Auto background refresh every 30s
  useEffect(() => {
    const interval = setInterval(backgroundRefresh, 30000);
    return () => clearInterval(interval);
  }, [backgroundRefresh]);

  // Update paginated list
  useEffect(() => {
    setHistory(filtered.slice(0, page * PAGE_SIZE));
  }, [filtered, page]);

  // Filter logic
  useEffect(() => {
    let result = allHistory;

    if (query) {
      const lower = query.toLowerCase();
      result = result.filter(
        item =>
          (item.item_name || '').toString().toLowerCase().includes(lower) ||
          (item.category || '').toString().toLowerCase().includes(lower)
      );
    }

    if (fromDate || toDate) {
      result = result.filter(item => {
        if (!item.timestamp) return false;
        let itemDateStr = '';
        if (typeof item.timestamp === 'string' && item.timestamp.length >= 10) {
          itemDateStr = item.timestamp.slice(0, 10);
        } else {
          const d = new Date(item.timestamp);
          if (!isNaN(d)) itemDateStr = d.toISOString().slice(0, 10);
        }
        const fromOk = !fromDate || itemDateStr >= fromDate;
        const toOk = !toDate || itemDateStr <= toDate;
        return fromOk && toOk;
      });
    }

    setFiltered(result);
    setPage(1);
  }, [query, fromDate, toDate, allHistory]);

  const handleLoadMore = () => {
    if (history.length < filtered.length) {
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
        <Text style={[styles.title, isDarkMode && styles.titleDark]}>My History</Text>
        <TouchableOpacity onPress={toggleTheme}>
          <Ionicons name={isDarkMode ? 'sunny' : 'moon'} size={24} color={isDarkMode ? '#fff' : '#1f2937'} />
        </TouchableOpacity>
      </View>

      {/* Subtle Refresh Badge (background sync) */}
      {refreshing && !loading && (
        <View style={styles.refreshBadge}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.refreshText}>Updating…</Text>
        </View>
      )}

      {/* Filters */}
      <View style={styles.filterRow}>
        <View style={styles.filterCol}>
          <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>From</Text>
          <View style={[styles.filterInputContainer, isDarkMode && styles.filterInputContainerDark]}>
            <Ionicons name="calendar-outline" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
            <TextInput
              style={[styles.filterInput, isDarkMode && styles.filterInputDark]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
              value={fromDate}
              onChangeText={setFromDate}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
        </View>
        <View style={styles.filterCol}>
          <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>Until</Text>
          <View style={[styles.filterInputContainer, isDarkMode && styles.filterInputContainerDark]}>
            <Ionicons name="calendar-outline" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
            <TextInput
              style={[styles.filterInput, isDarkMode && styles.filterInputDark]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
              value={toDate}
              onChangeText={setToDate}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, isDarkMode && styles.searchContainerDark]}>
        <Ionicons name="search" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
        <TextInput
          placeholder="Search by item name..."
          placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
          value={query}
          onChangeText={setQuery}
          style={[styles.input, isDarkMode && styles.inputDark]}
        />
      </View>

      {/* List with Pull-to-Refresh */}
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={history}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <View style={[styles.historyItemContainer, isDarkMode && styles.historyItemContainerDark]}>
              <HistoryItem item={item} />
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
              No history found.
            </Text>
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={history.length === 0 ? { flex: 1, justifyContent: 'center' } : { paddingBottom: 40 }}
        />
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
  refreshBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  refreshText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
  filterRow: { flexDirection: 'row', marginBottom: 16, gap: 12 },
  filterCol: { flex: 1 },
  filterLabel: { fontSize: 14, fontWeight: '500', color: '#6b7280', marginBottom: 6, marginLeft: 4 },
  filterLabelDark: { color: '#9ca3af' },
  filterInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  filterInputContainerDark: { backgroundColor: '#374151', borderColor: '#4b5563' },
  filterInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#1f2937' },
  filterInputDark: { color: '#f9fafb' },
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
  historyItemContainer: { backgroundColor: '#ffffff', borderRadius: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#6366f1', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  historyItemContainerDark: { backgroundColor: '#374151', borderLeftColor: '#818cf8' },
});