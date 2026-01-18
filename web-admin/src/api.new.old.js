import { supabase } from './lib/supabaseClient';
import CryptoJS from 'crypto-js';

const hashPin = (pin) =>
  CryptoJS.SHA256(pin).toString(CryptoJS.enc.Base64);

// Helper: Generate random ID dengan format string acak
const generateRandomId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

// Helper: Generate random ID untuk items
const generateRandomItemId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'ITEM';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

export const login = async (email, password) => {
  const pinHash = hashPin(password);

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .eq('pin_hash', pinHash)
    .single();

  if (error || !data) {
    throw new Error('LOGIN_FAILED');
  }

  return data;
};

/**
 * =====================================================
 * ITEMS
 * =====================================================
 */

export const getItems = async () => {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const searchItems = async (query) => {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .ilike('name', `%${query}%`);

  if (error) throw error;
  return data;
};

export const addItem = async (item) => {
  const { data, error } = await supabase
    .from('items')
    .insert([{
      id: generateRandomItemId(),
      name: item.name,
      category: item.category,
      stock: parseFloat(item.stock) || 0,
      created_at: new Date(),
      updated_at: new Date(),
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateItem = async (item) => {
  const { data, error } = await supabase
    .from('items')
    .update({
      ...item,
      updated_at: new Date(),
    })
    .eq('id', item.id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteItem = async (id) => {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
};

/**
 * =====================================================
 * EMPLOYEES
 * =====================================================
 */

export const getEmployees = async () => {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const addEmployee = async (employee) => {
  const payload = {
    id: generateRandomId(),
    name: employee.name,
    email: employee.email.toLowerCase().trim(),
    role: employee.role,
    pin_hash: hashPin(employee.pin),
    created_at: new Date(),
  };

  const { data, error } = await supabase
    .from('employees')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateEmployee = async (employee) => {
  const payload = { ...employee };

  if (employee.pin) {
    payload.pin_hash = hashPin(employee.pin);
  }

  const { data, error } = await supabase
    .from('employees')
    .update(payload)
    .eq('id', employee.id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteEmployee = async (id) => {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
};

/**
 * =====================================================
 * HISTORY
 * =====================================================
 */

export const getHistory = async (params) => {
  let query = supabase.from('history').select('*');

  if (params?.itemId) query = query.eq('item_id', params.itemId);
  if (params?.employeeId) query = query.eq('employee_id', params.employeeId);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const updateHistory = async (history) => {
  const { data, error } = await supabase
    .from('history')
    .update({
      ...history,
      updated_at: new Date(),
    })
    .eq('id', history.id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteHistory = async (id) => {
  const { error } = await supabase
    .from('history')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
};

/**
 * =====================================================
 * TASKS
 * =====================================================
 */

export const addTask = async (taskData) => {
  const taskId = `TASK${Date.now()}`;

  const { data, error } = await supabase
    .from('tasks')
    .insert([{
      ...taskData,
      task_id: taskId,
      created_at: new Date(),
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getTasks = async (employeeId) => {
  let query = supabase.from('tasks').select('*');

  if (employeeId) {
    query = query.eq('employee_id', employeeId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(task => {
    const readList =
      typeof task.read_by === 'string'
        ? task.read_by.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const checkedList =
      typeof task.checked_by === 'string'
        ? task.checked_by.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    return {
      ...task,

      // 🔑 ini yang dipakai UI
      read_by_list: readList,
      read_by_count: readList.length,

      checked_by_list: checkedList,
      checked_by_count: checkedList.length,
    };
  });
};


export const updateTask = async (taskData) => {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      ...taskData,
      updated_at: new Date(),
    })
    .eq('task_id', taskData.task_id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteTask = async (taskId) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('task_id', taskId);

  if (error) throw error;
  return { success: true };
};

/**
 * =====================================================
 * SETTINGS
 * =====================================================
 */

export const updateLowStockThreshold = async (threshold) => {
  const { data, error } = await supabase
    .from('settings')
    .upsert(
      [{
        setting_key: 'LOW_STOCK_THRESHOLD',
        setting_value: threshold,
      }],
      { onConflict: 'setting_key' }
    )
    .select()
    .limit(1);

  if (error) throw error;
  return data[0];
};


export const getLowStockThreshold = async () => {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('setting_key', 'LOW_STOCK_THRESHOLD')
    .limit(1);

  if (error || !data || data.length === 0) return null;

  return data[0];
};
