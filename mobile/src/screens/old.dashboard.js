// DashboardScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Vibration,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { getItems, getTasks, updateTaskReadStatus, updateTaskCheckStatus, doneTask, deductTaskItems, getHistory } from '../api';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// -------------------------------------------------------------------
// Cache keys
// -------------------------------------------------------------------
const CACHE_ITEMS_KEY = 'cached_items';
const CACHE_TASKS_KEY = 'cached_tasks';

// -------------------------------------------------------------------
// Deep equality helper
// -------------------------------------------------------------------
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
};

// -------------------------------------------------------------------
// Cache helpers
// -------------------------------------------------------------------
const loadFromCache = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveToCache = async (key, data) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to cache data', e);
  }
};

export default function DashboardScreen({ route, navigation }) {
  const { employeeId, employeeName, refresh, incomingCall: initialIncomingCall } = route.params || {};
  const [items, setItems] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [incomingCall, setIncomingCall] = useState(initialIncomingCall || null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const tasksPerPage = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const soundRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  // Button-level loading for "Check Task"
  const [checking, setChecking] = useState(false);
  const [hasDeductToday, setHasDeductToday] = useState(false);
  const [historyDeductToday, setHistoryDeductToday] = useState([]); // Store today's deduct history

  // ---------------------------------------------------------------
  // Play/Stop Ringtone
  // ---------------------------------------------------------------
  const playRingtone = async () => {
    try {
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
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping ringtone:', error);
    }
  };

  // ---------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------
  const handleLogout = async () => {
    try {
      setLoading(true);
      await AsyncStorage.multiRemove(['user', 'token', 'employeeId', 'employeeName']);
      navigation.replace('Login');
    } catch (error) {
      Alert.alert("Error", "Failed to log out.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------
  // Mark visible tasks as read
  // ---------------------------------------------------------------
  const markVisibleTasksAsRead = async (tasks) => {
    try {
      const unreadTasks = tasks.filter(task => {
        const readByList = task.read_by_list || [];
        return !readByList.includes(employeeId);
      });

      await Promise.all(
        unreadTasks.map(task =>
          updateTaskReadStatus(task.task_id, employeeId)
        )
      );

      // sinkronkan read_by_list di state agar isRead true
      if (unreadTasks.length) {
        setTasks(prev =>
          prev.map(t =>
            unreadTasks.find(u => u.task_id === t.task_id)
              ? { ...t, read_by_list: [...(t.read_by_list || []), employeeId] }
              : t
          )
        );
        setSelectedTask(prev =>
          prev && unreadTasks.find(u => u.task_id === prev.task_id)
            ? { ...prev, read_by_list: [...(prev.read_by_list || []), employeeId] }
            : prev
        );
      }
    } catch (error) {
      console.log("Failed to update read status:", error);
    }
  };

  // ---------------------------------------------------------------
  // Load data (cache first → API → update cache)
  // ---------------------------------------------------------------
  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);

    // 1. Load from cache
    if (!isRefresh) {
      const [cachedItems, cachedTasks] = await Promise.all([
        loadFromCache(CACHE_ITEMS_KEY),
        loadFromCache(CACHE_TASKS_KEY),
      ]);

      if (Array.isArray(cachedItems)) setItems(cachedItems);
      if (Array.isArray(cachedTasks)) setTasks(cachedTasks);

      if (cachedItems || cachedTasks) {
        setLoading(false);
        setRefreshing(true);
      }
    }

    // 2. Fetch fresh data
    try {
      const [itemsResponse, tasksResponse] = await Promise.all([
        getItems(),
        getTasks({ employeeId }),
      ]);

      const newItems = Array.isArray(itemsResponse) ? itemsResponse : [];
      const newTasks = Array.isArray(tasksResponse) ? tasksResponse : [];

      // Only update if changed
      setItems(prev => deepEqual(prev, newItems) ? prev : newItems);
      setTasks(prev => deepEqual(prev, newTasks) ? prev : newTasks);

      // Save to cache
      await Promise.all([
        saveToCache(CACHE_ITEMS_KEY, newItems),
        saveToCache(CACHE_TASKS_KEY, newTasks),
      ]);

      // Mark tasks as read immediately & stop notifications
      await markVisibleTasksAsRead(newTasks);
      stopRingtone();
      Vibration.cancel();

      if (incomingCall && !isRefresh) {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      Alert.alert("Error", "Failed to load data.");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setRefreshing(false);
      }, 300);
    }
  }, [employeeId, incomingCall]);

  // ---------------------------------------------------------------
  // Refresh handler
  // ---------------------------------------------------------------
  const handleRefresh = () => {
    loadData(true);
  };

  // ---------------------------------------------------------------
  // Incoming call handler
  // ---------------------------------------------------------------
  const handleAnswerCall = () => {
    stopRingtone();
    Vibration.cancel();
    setIncomingCall(null);
    navigation.setParams({ incomingCall: null });
  };

  // ---------------------------------------------------------------
  // Focus effect
  // ---------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {
        stopRingtone();
        Vibration.cancel();
      };
    }, [loadData])
  );

  // ---------------------------------------------------------------
  // Initial incoming call
  // ---------------------------------------------------------------
  useEffect(() => {
    if (initialIncomingCall) {
      setIncomingCall(initialIncomingCall);
      playRingtone();
      Vibration.vibrate([500, 500], true);
    }
    return () => {
      stopRingtone();
      Vibration.cancel();
    };
  }, [initialIncomingCall]);

  // ---------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------
  const indexOfLastTask = currentPage * tasksPerPage;
  const indexOfFirstTask = indexOfLastTask - tasksPerPage;
  const currentTasks = tasks.slice(indexOfFirstTask, indexOfLastTask);
  const totalPages = Math.ceil(tasks.length / tasksPerPage);

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // ---------------------------------------------------------------
  // Task Actions
  // ---------------------------------------------------------------
  const handleDeductTask = () => {
    if (!selectedTask) return;

    Alert.alert(
      "Confirm Deduction",
      "Are you sure you want to deduct items for this task? This action cannot be undone.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Deduct",
          onPress: async () => {
            try {
              setLoading(true);
              const { newDeductedList } = await deductTaskItems({
                taskId: selectedTask.task_id,
                employeeId,
                employeeName,
                items: selectedTask.items,
              });

              // Update state locally for immediate UI feedback
              const updateTask = (t) => ({ ...t, deducted_by_list: newDeductedList });

              setTasks(prevTasks =>
                prevTasks.map(t =>
                  t.task_id === selectedTask.task_id ? updateTask(t) : t
                )
              );
              setSelectedTask(prev => updateTask(prev));
              Alert.alert("Success", "Items deducted successfully.");
              // Refresh flag after a successful deduct
              await refreshHasDeductToday();
            } catch (error) {
              Alert.alert("Error", error.message || "Failed to deduct items.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCheckTask = () => {
    Alert.alert(
      "Confirm Check",
      "Are you sure you want to check this task?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          onPress: async () => {
            try {
              setChecking(true);
              await updateTaskCheckStatus(selectedTask.task_id, employeeId);
              
              // Update state locally for immediate UI feedback
              const updateTask = (t) => ({
                ...t,
                checked_by_list: [...(t.checked_by_list || []), employeeId],
                checked_by_count: (t.checked_by_count || 0) + 1,
              });

              setTasks(prevTasks =>
                prevTasks.map(t =>
                  t.task_id === selectedTask.task_id ? updateTask(t) : t
                )
              );
              setSelectedTask(prev => updateTask(prev));
              // Refresh flag after check
              await refreshHasDeductToday();
            } catch (error) {
              Alert.alert("Error", "Failed to check task.");
            } finally {
              setChecking(false);
            }
          },
        },
      ]
    );
  };

  const handleDoneTask = async () => {
    if (!selectedTask) return;
    
    // Re-check isDone status
    const currentDoneList = getDoneByList();
    const alreadyDone = currentDoneList.includes(String(employeeId));
    
    if (alreadyDone) {
      Alert.alert("Already Done", "You have already marked this task as done.");
      return;
    }
    
    // Validate conditions before attempting
    if (!isChecked) {
      Alert.alert("Not allowed", "You must Check the task first before marking it as done.");
      return;
    }
    
    if (!hasDeductToday) {
      Alert.alert("Not allowed", "You must have at least one Deduct Item today before marking this task as done.");
      return;
    }
    
    try {
      setLoading(true);
      const result = await doneTask(selectedTask.task_id, employeeId);
      const now = new Date().toISOString();

      // Update state locally with the new done_by list
      const updateTask = (t) => ({
        ...t,
        done_by: result.doneByList.join(','),
        done_at: now,
        status: 'completed'
      });
      
      setTasks(prev =>
        prev.map(t =>
          t.task_id === selectedTask.task_id ? updateTask(t) : t
        )
      );
      setSelectedTask(prev => updateTask(prev));
      
      Alert.alert("Success", "Task marked as done successfully!");

    } catch (error) {
      console.error('Done task error:', error);
      Alert.alert("Error", error.message || "Failed to mark task as done.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------
  // Theme & Modal
  // ---------------------------------------------------------------
  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const openTaskModal = (task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
    Animated.spring(modalAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
    // pastikan status terbaru terambil setelah kembali dari Deduct
    loadData(true);
    // Update today deduct flag on open
    refreshHasDeductToday();
  };

  const closeTaskModal = () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowTaskModal(false));
  };

  // Helper: check "today"
  const isToday = (iso) => {
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  };

  // Refresh hasDeductToday from history and store today's deduct records
  const refreshHasDeductToday = useCallback(async () => {
    try {
      const history = await getHistory({ employeeId });
      const todayDeducts = Array.isArray(history) 
        ? history.filter(h => h.action === 'deduct' && isToday(h.timestamp))
        : [];
      
      setHistoryDeductToday(todayDeducts);
      setHasDeductToday(todayDeducts.length > 0);
      
      console.log('Today Deduct History:', {
        employeeId,
        count: todayDeducts.length,
        items: todayDeducts.map(h => ({ item_id: h.item_id, item_name: h.item_name, timestamp: h.timestamp }))
      });
    } catch (error) {
      console.error('Error fetching deduct history:', error);
      setHistoryDeductToday([]);
      setHasDeductToday(false);
    }
  }, [employeeId]);

  // Refresh on mount and when modal opens
  useEffect(() => {
    refreshHasDeductToday();
  }, [refreshHasDeductToday]);

  useEffect(() => {
    if (showTaskModal) {
      refreshHasDeductToday();
    }
  }, [showTaskModal, refreshHasDeductToday]);

  // ---------------------------------------------------------------
  // Derived statuses for selected task
  // ---------------------------------------------------------------
  const isRead = selectedTask?.read_by_list?.includes(String(employeeId));
  const isChecked = selectedTask?.checked_by_list?.includes(String(employeeId));
  
  // Parse done_by with fallback
  const getDoneByList = () => {
    if (!selectedTask?.done_by) return [];
    
    // If it's already an array
    if (Array.isArray(selectedTask.done_by)) {
      return selectedTask.done_by.map(id => String(id));
    }
    
    // If it's a string (CSV format)
    if (typeof selectedTask.done_by === 'string') {
      return selectedTask.done_by.split(',').map(s => String(s).trim()).filter(Boolean);
    }
    
    return [];
  };
  
  const doneByList = getDoneByList();
  const isDone = doneByList.includes(String(employeeId));

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  if (loading && !refreshing) {
    return (
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size={50} color="#6366f1" />
          <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
            Loading from cache…
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Welcome, <Text style={styles.highlight}>{employeeName}</Text>
          </Text>
          <TouchableOpacity onPress={toggleTheme} disabled={loading}>
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={24}
              color={isDarkMode ? '#fff' : '#1f2937'}
            />
          </TouchableOpacity>
        </View>

        {/* Refreshing Badge */}
        {refreshing && (
          <View style={styles.refreshBadge}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.refreshText}>Refreshing…</Text>
          </View>
        )}

        {/* Search */}
        <TouchableOpacity
          style={[styles.searchBox, isDarkMode && styles.searchBoxDark]}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Ionicons name="search" size={20} color={isDarkMode ? '#9ca3af' : '#6b7280'} />
          <Text style={[styles.searchText, isDarkMode && styles.searchTextDark]}>
            Search items...
          </Text>
        </TouchableOpacity>

        {/* Tasks */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Your Tasks
            </Text>

            {currentTasks.length > 0 ? (
              currentTasks.map(task => {
                // Helper function to parse list safely
                const parseList = (value) => {
                  if (!value) return [];
                  if (Array.isArray(value)) return value.map(id => String(id));
                  if (typeof value === 'string') {
                    return value.split(',').map(s => String(s).trim()).filter(Boolean);
                  }
                  return [];
                };

                // Check if current employee has checked this task
                const taskCheckedByList = parseList(task.checked_by_list);
                const isTaskChecked = taskCheckedByList.includes(String(employeeId));
                
                // Check if employee has ANY deduct TODAY (from history)
                const isTaskDeducted = hasDeductToday;
                
                // Debug log
                console.log('Task Badge Debug:', {
                  taskId: task.task_id,
                  title: task.title,
                  employeeId: String(employeeId),
                  isTaskChecked,
                  hasDeductToday,
                  isTaskDeducted,
                  historyDeductCount: historyDeductToday.length
                });
                
                return (
                  <TouchableOpacity
                    key={task.task_id}
                    style={[
                      styles.taskItem,
                      isDarkMode && styles.taskItemDark,
                      task.status === 'completed' && styles.completedTask,
                    ]}
                    onPress={() => openTaskModal(task)}
                    disabled={loading}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={[styles.taskTitle, isDarkMode && styles.taskTitleDark]}>
                        {task.title}
                      </Text>
                      <View style={styles.badgeContainer}>
                        {task.read_by_list && !task.read_by_list.includes(employeeId) && (
                          <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>NEW</Text>
                          </View>
                        )}
                        {isTaskDeducted && (
                          <View style={styles.deductedBadge}>
                            <Ionicons name="checkmark-circle" size={14} color="#fff" />
                            <Text style={styles.deductedBadgeText}>DEDUCTED</Text>
                          </View>
                        )}
                        {isTaskChecked && (
                          <View style={styles.checkedBadge}>
                            <Ionicons name="checkmark-done" size={14} color="#fff" />
                            <Text style={styles.checkedBadgeText}>CHECKED</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Text style={[styles.taskDesc, isDarkMode && styles.taskDescDark]}>
                      {task.description || "No description provided"}
                    </Text>

                    {task.items && task.items.length > 0 && (
                      <View style={styles.itemsContainer}>
                        {task.items.map((item, index) => (
                          <Text key={item.item_id || index} style={[styles.taskItemText, isDarkMode && styles.taskItemTextDark]}>
                            • {item.item_name} (Required: {item.required_qty})
                          </Text>
                        ))}
                      </View>
                    )}

                    <View style={styles.footer}>
                      <View style={styles.statusContainer}>
                        <Text style={[styles.taskStatus, isDarkMode && styles.taskStatusDark]}>
                          Status: {task.status === 'completed' ? 'Completed' : 'Pending'}
                        </Text>
                        {/* Show personal task progress */}
                        <View style={styles.personalProgress}>
                          {isTaskDeducted && (
                            <View style={styles.miniStatusBadge}>
                              <Ionicons name="remove-circle" size={16} color="#ef4444" />
                            </View>
                          )}
                          {isTaskChecked && (
                            <View style={styles.miniStatusBadge}>
                              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={[styles.taskDate, isDarkMode && styles.taskDateDark]}>
                        {new Date(task.assigned_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
                No tasks assigned
              </Text>
            )}

            {/* Pagination */}
            {tasks.length > tasksPerPage && (
              <View style={styles.paginationContainer}>
                <TouchableOpacity
                  style={[styles.pageButton, isDarkMode && styles.pageButtonDark, currentPage === 1 && styles.disabledButton]}
                  onPress={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                >
                  <Text style={[styles.pageButtonText, isDarkMode && styles.pageButtonTextDark]}>
                    Previous
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.pageInfo, isDarkMode && styles.pageInfoDark]}>
                  Page {currentPage} of {totalPages}
                </Text>

                <TouchableOpacity
                  style={[styles.pageButton, isDarkMode && styles.pageButtonDark, currentPage === totalPages && styles.disabledButton]}
                  onPress={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                >
                  <Text style={[styles.pageButtonText, isDarkMode && styles.pageButtonTextDark]}>
                    Next
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonsSection}>
            {/* Row 1: Deduct & History */}
            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[styles.halfButton, styles.deductButton]}
                onPress={() => navigation.navigate('Deduct', { employeeId, employeeName })}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Ionicons name="download-outline" size={22} color="#fff" />
                <Text style={styles.buttonText}>Deduct Item</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.halfButton, styles.historyButton]}
                onPress={() => navigation.navigate('History', { employeeId })}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Ionicons name="time-outline" size={22} color="#fff" />
                <Text style={styles.buttonText}>My History</Text>
              </TouchableOpacity>
            </View>

            {/* Row 2: Profile */}
            <TouchableOpacity
              style={[styles.fullButton, styles.profileButton]}
              onPress={() => navigation.navigate('Profile', { employeeId, employeeName })}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Ionicons name="person-circle-outline" size={22} color="#fff" />
              <Text style={styles.buttonText}>My Profile</Text>
            </TouchableOpacity>

            {/* Row 3: Logout */}
            <TouchableOpacity
              style={[styles.fullButton, styles.logoutButton]}
              onPress={handleLogout}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={22} color="#fff" />
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Incoming Call Overlay */}
      {incomingCall && (
        <Animated.View style={[styles.callContainer, { opacity: fadeAnim }]}>
          <View style={[styles.callBox, isDarkMode && styles.callBoxDark]}>
            <Text style={[styles.callTitle, isDarkMode && styles.callTitleDark]}>
              Incoming Task Call
            </Text>
            <Text style={[styles.callTask, isDarkMode && styles.callTaskDark]}>
              {incomingCall.taskTitle || "New Task"}
            </Text>
            <Text style={[styles.callDescription, isDarkMode && styles.callDescriptionDark]}>
              {incomingCall.taskDescription || "No description"}
            </Text>
            <View style={styles.callButtons}>
              <TouchableOpacity
                style={[styles.callButton, { backgroundColor: '#4f46e5' }]}
                onPress={handleAnswerCall}
              >
                <Text style={styles.callButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Task Modal */}
      <Modal visible={showTaskModal} transparent onRequestClose={closeTaskModal}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, isDarkMode && styles.modalContentDark, { transform: [{ scale: modalAnim }] }]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
              {selectedTask?.title}
            </Text>
            <Text style={[styles.modalDesc, isDarkMode && styles.modalDescDark]}>
              {selectedTask?.description || "No description"}
            </Text>

            {selectedTask?.items?.length > 0 && (
              <View style={styles.modalItemsContainer}>
                <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>Items:</Text>
                {selectedTask.items.map((item, i) => (
                  <Text key={i} style={[styles.modalItemText, isDarkMode && styles.modalItemTextDark]}>
                    • {item.item_name} (Required: {item.required_qty})
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.modalFooter}>
              <Text style={[styles.modalStatus, isDarkMode && styles.modalStatusDark]}>
                Status: {selectedTask?.status === 'completed' ? 'Completed' : 'Pending'}
              </Text>
              <Text style={[styles.modalDate, isDarkMode && styles.modalDateDark]}>
                {selectedTask?.assigned_at ? new Date(selectedTask.assigned_at).toLocaleDateString() : 'N/A'}
              </Text>
            </View>

            {/* ---- DEDUCT BUTTON (same as bottom nav) ---- */}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#4f46e5', marginBottom: 12, shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 }]}
              onPress={() => {
                closeTaskModal();
                navigation.navigate('Deduct', { employeeId, employeeName });
              }}
              disabled={loading}
            >
              <Ionicons name="download-outline" size={22} color="#ffffff" />
              <Text style={styles.actionButtonText}>Deduct Item</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </TouchableOpacity>

            {/* ---- CHECK TASK BUTTON ---- */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: isChecked ? '#9ca3af' : '#4f46e5',
                  marginBottom: 8,
                  opacity: checking ? 0.8 : 1,
                  shadowColor: isChecked ? '#9ca3af' : '#4f46e5',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 5,
                },
              ]}
              onPress={handleCheckTask}
              disabled={isChecked || checking}
            >
              {checking ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.actionButtonText}>Checking…</Text>
                </>
              ) : isChecked ? (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Task Checked</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#ffffff" />
                  <Text style={styles.actionButtonText}>Check Task</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Done Task */}
            {(() => {
              // Debug logs
              console.log('Debug Mark as Done:', {
                isChecked,
                hasDeductToday,
                isDone,
                employeeId,
                doneByList,
                historyDeductTodayCount: historyDeductToday.length
              });
              
              // Mark as Done enabled only if:
              // 1. Task is checked by current employee
              // 2. Employee has at least one deduct today (from history table)
              // 3. Not already marked as done by this employee
              const disabledDone = !isChecked || !hasDeductToday || isDone;
              
              return (
                <>
                  <View style={[styles.doneSection, isDarkMode && styles.doneSectionDark]}>
                    <Text style={[styles.modalSectionTitle, isDarkMode && styles.modalSectionTitleDark]}>
                      Mark as Done Requirements:
                    </Text>
                    
                    <View style={styles.requirementRow}>
                      <Ionicons 
                        name={isChecked ? "checkmark-circle" : "close-circle"} 
                        size={20} 
                        color={isChecked ? "#10b981" : "#ef4444"} 
                      />
                      <Text style={[styles.requirementText, isDarkMode && styles.requirementTextDark]}>
                        1. Task Checked {isChecked ? '✓' : '✗'}
                      </Text>
                    </View>
                    
                    <View style={styles.requirementRow}>
                      <Ionicons 
                        name={hasDeductToday ? "checkmark-circle" : "close-circle"} 
                        size={20} 
                        color={hasDeductToday ? "#10b981" : "#ef4444"} 
                      />
                      <Text style={[styles.requirementText, isDarkMode && styles.requirementTextDark]}>
                        2. Deduct Item Today {hasDeductToday ? '✓' : '✗'} ({historyDeductToday.length} item{historyDeductToday.length !== 1 ? 's' : ''})
                      </Text>
                    </View>
                    
                    {historyDeductToday.length > 0 && (
                      <View style={styles.deductDetailsContainer}>
                        <Text style={[styles.deductDetailsTitle, isDarkMode && styles.deductDetailsTitleDark]}>
                          Today's Deductions:
                        </Text>
                        {historyDeductToday.slice(0, 3).map((h, idx) => (
                          <Text key={idx} style={[styles.deductDetailsText, isDarkMode && styles.deductDetailsTextDark]}>
                            • {h.item_name} (Qty: {h.qty}) at {new Date(h.timestamp).toLocaleTimeString()}
                          </Text>
                        ))}
                        {historyDeductToday.length > 3 && (
                          <Text style={[styles.deductDetailsText, isDarkMode && styles.deductDetailsTextDark]}>
                            ... and {historyDeductToday.length - 3} more
                          </Text>
                        )}
                      </View>
                    )}
                    
                    {isDone && (
                      <View style={styles.requirementRow}>
                        <Ionicons name="checkmark-circle-double" size={20} color="#10b981" />
                        <Text style={[styles.requirementText, { color: '#10b981', fontWeight: '700' }]}>
                          Already marked as Done by you ✓
                        </Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.modalButton, 
                      { 
                        backgroundColor: disabledDone ? '#9ca3af' : '#10b981',
                        opacity: loading ? 0.7 : 1,
                      }
                    ]}
                    onPress={handleDoneTask}
                    disabled={disabledDone || loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator size="small" color="#ffffff" />
                        <Text style={styles.modalButtonText}>Processing...</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons 
                          name={isDone ? "checkmark-done" : "checkmark"} 
                          size={22} 
                          color="#ffffff" 
                        />
                        <Text style={styles.modalButtonText}>
                          {isDone ? 'Done ✓' : 'Mark as Done'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              );
            })()}

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#6b7280' }]}
              onPress={closeTaskModal}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2ff',
  },
  containerDark: {
    backgroundColor: '#0b1224',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
  },
  titleDark: {
    color: '#f9fafb',
  },
  highlight: {
    color: '#6366f1',
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#dfe3ff',
    shadowColor: '#4f46e5',
    shadowOpacity: 0.12,
  },
  searchBoxDark: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
  },
  searchText: {
    marginLeft: 10,
    color: '#6b7280',
    fontSize: 16,
  },
  searchTextDark: {
    color: '#9ca3af',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#111827',
    letterSpacing: 0.2,
  },
  sectionTitleDark: {
    color: '#e5e7eb',
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 12,
  },
  emptyTextDark: {
    color: '#9ca3af',
  },
  buttonsSection: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfButton: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  fullButton: {
    height: 56,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  deductButton: {
    backgroundColor: '#8b5cf6',
  },
  historyButton: {
    backgroundColor: '#06b6d4',
  },
  profileButton: {
    backgroundColor: '#ec4899',
  },
  logoutButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  loadingTextDark: {
    color: '#f9fafb',
  },
  refreshBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    shadowColor: '#312e81',
    shadowOpacity: 0.2,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  refreshText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  taskItem: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#7c3aed',
    shadowColor: '#312e81',
    shadowOpacity: 0.15,
    elevation: 4,
  },
  taskItemDark: {
    backgroundColor: '#111827',
    borderLeftColor: '#a855f7',
  },
  completedTask: {
    opacity: 0.85,
    borderLeftColor: '#22c55e',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  taskTitle: {
    fontWeight: '700',
    fontSize: 18,
    color: '#0f172a',
    flex: 1,
  },
  taskTitleDark: {
    color: '#f8fafc',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  newBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  deductedBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deductedBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  checkedBadge: {
    backgroundColor: '#10b981',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkedBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  personalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniStatusBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskDesc: {
    color: '#4b5563',
    fontSize: 15,
    marginBottom: 12,
    lineHeight: 22,
  },
  taskDescDark: {
    color: '#cbd5e1',
  },
  itemsContainer: {
    marginBottom: 12,
  },
  taskItemText: {
    color: '#4b5563',
    fontSize: 14,
    marginLeft: 8,
    lineHeight: 20,
  },
  taskItemTextDark: {
    color: '#d1d5db',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskStatus: {
    color: '#6b7280',
    fontSize: 14,
  },
  taskStatusDark: {
    color: '#9ca3af',
  },
  taskDate: {
    color: '#6b7280',
    fontSize: 13,
  },
  taskDateDark: {
    color: '#9ca3af',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 12,
  },
  pageButton: {
    padding: 12,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  pageButtonDark: {
    backgroundColor: '#8b5cf6',
  },
  disabledButton: {
    backgroundColor: '#e5e7eb',
  },
  pageButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  pageButtonTextDark: {
    color: '#ffffff',
  },
  pageInfo: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  pageInfoDark: {
    color: '#cbd5e1',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalContentDark: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    color: '#0f172a',
  },
  modalTitleDark: {
    color: '#e5e7eb',
  },
  modalDesc: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 16,
    lineHeight: 24,
  },
  modalDescDark: {
    color: '#cbd5e1',
  },
  modalItemsContainer: {
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1f2937',
  },
  modalSectionTitleDark: {
    color: '#f9fafb',
  },
  modalItemText: {
    fontSize: 15,
    color: '#4b5563',
    marginLeft: 12,
    lineHeight: 22,
  },
  modalItemTextDark: {
    color: '#d1d5db',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalStatus: {
    fontSize: 15,
    color: '#6b7280',
  },
  modalStatusDark: {
    color: '#9ca3af',
  },
  modalDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalDateDark: {
    color: '#9ca3af',
  },
  modalButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  checkedMessage: {
    fontSize: 16,
    color: '#10b981',
    textAlign: 'center',
    marginVertical: 12,
  },
  checkedMessageDark: {
    color: '#34d399',
  },
  callContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  callBox: {
    backgroundColor: '#0f172a',
    width: '85%',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  callBoxDark: {
    backgroundColor: '#0f172a',
  },
  callTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    color: '#e5e7eb',
  },
  callTitleDark: {
    color: '#f9fafb',
  },
  callTask: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    color: '#c7d2fe',
  },
  callTaskDark: {
    color: '#f9fafb',
  },
  callDescription: {
    fontSize: 15,
    color: '#cbd5e1',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  callDescriptionDark: {
    color: '#9ca3af',
  },
  callButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  callButton: {
    padding: 16,
    borderRadius: 10,
    width: '70%',
    alignItems: 'center',
  },
  callButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  statusNote: {
    textAlign: 'center',
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 10,
  },
  statusNoteDark: {
    color: '#cbd5e1',
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  doneSection: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  doneSectionDark: {
    backgroundColor: '#1f2937',
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  requirementText: {
    fontSize: 15,
    color: '#374151',
  },
  requirementTextDark: {
    color: '#d1d5db',
  },
  deductDetailsContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  deductDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  deductDetailsTitleDark: {
    color: '#d1d5db',
  },
  deductDetailsText: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 8,
    lineHeight: 18,
  },
  deductDetailsTextDark: {
    color: '#9ca3af',
  },
});