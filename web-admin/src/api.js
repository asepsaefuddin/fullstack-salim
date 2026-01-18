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


const url = process.env.APPSCRIPT;
const secret = process.env.REACT_APP_API_SECRET;

export const sendEmail = async (to, subject, html) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secret,
        to,
        subject,
        html,
      }),
    });

    const result = await response.json();
    
    if (result.status !== 'success') {
      throw new Error(result.message || 'Failed to send email');
    }

    return result;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
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

  // 🔑 Gunakan 'timestamp' bukan 'created_at' karena itu field yang di-insert
  const { data, error } = await query.order('timestamp', { ascending: false });

  if (error) {
    console.error('❌ getHistory ERROR:', error);
    throw error;
  }
  
  console.log('✅ getHistory result:', data);
  return data;
};

export const updateHistory = async (history) => {
  const qty = Number(history.qty);
  const action =
    history.action !== null && history.action !== undefined
      ? String(history.action).trim()
      : '';
  const stockAfter = history.stock_after !== undefined ? Number(history.stock_after) : null;

  if (!Number.isInteger(qty)) {
    throw new Error('INVALID_QTY');
  }

  if (!action) {
    throw new Error('ACTION_EMPTY');
  }

  // 🔑 Hanya update stock_after, qty tidak berubah di database
  const payload = {
    action,
  };

  // 🔑 Tambah stock_after jika disediakan
  if (stockAfter !== null) {
    payload.stock_after = stockAfter;
    console.log('[API] Updating stock_after:', stockAfter);
  }

  console.log('PATCH payload:', payload);

  const { data, error } = await supabase
    .from('history')
    .update(payload)
    .eq('id', history.id);

  if (error) {
    console.error('SUPABASE ERROR DETAIL:', error);
    throw error;
  }

  console.log('[API] Update history success:', data);
  return data;
};

// api.js
// Helper: resolve current logged-in user from localStorage
const resolveCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    return {
      id: u.id || u.employee_id || 'SYSTEM',
      name: (u.name || u.employee_name || u.username || 'System Admin').toString(),
    };
  } catch {
    return null;
  }
};

export const addHistory = async (payload) => {
  console.log('🔥 addHistory CALLED with payload:', payload);

  // Resolve employee from current session
  const currentUser = resolveCurrentUser();

  // Validate minimal required fields
  if (!payload.item_id || !payload.action || !payload.qty) {
    console.error('❌ Invalid payload:', payload);
    throw new Error('Missing required fields for history');
  }

  const stockBefore = Number(payload.stock_before || 0);
  const stockAfter = Number(payload.stock_after || 0);
  
  // 🔑 Untuk deduct: qty = jumlah yang dikurangi (dari payload.qty)
  // 🔑 Untuk add/min: qty = stock_after
  let finalQty;
  if (payload.action === 'deduct') {
    finalQty = Number(payload.qty); // ambil dari qty yang dikirim
  } else {
    finalQty = stockAfter; // untuk add/min tetap pakai stock_after
  }
  
  // Tentukan action otomatis berdasarkan stock_before dan stock_after
  let finalAction = payload.action;
  
  // Logic: 
  // - Jika stock_after > stock_before = add
  // - Jika stock_after < stock_before = min
  // - Jika action sudah 'deduct', biarkan tetap 'deduct'
  if (payload.action !== 'deduct') {
    if (stockAfter > stockBefore) {
      finalAction = 'add';
    } else if (stockAfter < stockBefore) {
      finalAction = 'min';
    }
  }

  const historyData = {
    employee_id: String((currentUser?.id ?? payload.employee_id) || 'SYSTEM'),
    employee_name: String((currentUser?.name ?? payload.employee_name) || 'Unknown'),
    item_id: String(payload.item_id),
    item_name: String(payload.item_name || 'Unknown Item'),
    action: String(finalAction),
    qty: finalQty, // 🔑 untuk deduct = qty yang dikurangi, untuk add/min = stock_after
    stock_before: stockBefore,
    stock_after: stockAfter,
    timestamp: new Date().toISOString(),
  };

  console.log('📤 Inserting history data:', historyData);
  console.log('📊 Stock analysis:', {
    before: stockBefore,
    after: stockAfter,
    change: stockAfter - stockBefore,
    qty: finalQty,
    originalAction: payload.action,
    determinedAction: finalAction,
    logic: payload.action === 'deduct' 
      ? `kept as deduct (qty=${finalQty} from payload)` 
      : stockAfter > stockBefore 
        ? 'stock increased (add)' 
        : 'stock decreased (min)'
  });

  const { data, error } = await supabase
    .from('history')
    .insert([historyData])
    .select();

  if (error) {
    console.error('❌ addHistory ERROR:', error);
    console.error('Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }

  console.log('✅ History recorded successfully:', data);
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

// Helper: kirim notifikasi email untuk task
const sendTaskNotification = async (task, action) => {
  if (!task?.employee_id) return;
  try {
    const { data: employee } = await supabase
      .from('employees')
      .select('email,name')
      .eq('id', task.employee_id)
      .single();
    if (!employee?.email) return;

    const title = task.title || task.name || task.task_id || 'Task';
    const subject = `Task ${action === 'create' ? 'Assigned' : 'Updated'}: ${title}`;
    const html = `
      <p>Hi ${employee.name || 'there'},</p>
      <p>Your task has been ${action === 'create' ? 'assigned' : 'updated'}.</p>
      <p><strong>${title}</strong></p>
    `;

    await sendEmail(employee.email, subject, html);
  } catch (err) {
    console.error('Task email notification failed:', err);
  }
};

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
  await sendTaskNotification(data, 'create');
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
  await sendTaskNotification(data, 'update');
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

// Cache key for configuration settings
const CONFIG_CACHE_KEY = 'app_config_cache';

// Save configuration to cache
const saveConfigToCache = (config) => {
  localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
};

// Load configuration from cache
const loadConfigFromCache = () => {
  const cachedConfig = localStorage.getItem(CONFIG_CACHE_KEY);
  return cachedConfig ? JSON.parse(cachedConfig) : null;
};

// Export supabase for use in other files if needed
export { supabase };
