import CryptoJS from 'crypto-js';
import { createClient } from '@supabase/supabase-js';

/* ======================
   CONFIG
====================== */
const SUPABASE_URL = 'https://nnlezmhknsetnrcewlel.supabase.co';
const SUPABASE_ANON_KEY =
  'sb_publishable_asWrhmgneQUF57jv5wHqhw_z8XsMT93';
const APPSCRIPT_EMAIL_URL = 'https://script.google.com/macros/s/AKfycbxtXXi2c3EuoqZDJj6-ypUFcG7GkxLqsQAjuVQi0_92sYwcrYipDEB7dlpDQPQx753Z/exec';
const APPSCRIPT_EMAIL_SECRET = 'yoyo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ======================
   HELPERS
====================== */
const hashPin = (pin) =>
  CryptoJS.enc.Base64.stringify(CryptoJS.SHA256(pin));

const csvToArray = (value) =>
  value
    ? value.split(',').map(v => v.trim()).filter(Boolean)
    : [];

const arrayToCsv = (arr) =>
  Array.isArray(arr) ? arr.join(',') : '';

const getItemById = async (itemId) => {
  const { data, error } = await supabase
    .from('items')
    .select('id, name, stock')
    .eq('id', itemId)
    .single();

  if (error || !data) {
    throw new Error(`Item ${itemId} not found`);
  }
  return data;
};

const updateItemStock = async (itemId, newStock) => {
  const { error } = await supabase
    .from('items')
    .update({ stock: newStock })
    .eq('id', itemId);

  if (error) throw error;
};

const addHistoryEntry = async ({
  employee_id,
  employee_name,
  item_id,
  item_name,
  qty,
  action = 'deduct',
  timestamp = new Date().toISOString(),
}) => {
  const payload = { employee_id, employee_name, item_id, item_name, qty, action, timestamp };
  const { error } = await supabase.from('history').insert(payload);
  if (error) {
    console.error('History insert failed:', error);
    throw error;
  }
};

const sendDeductionEmail = async (employeeName, itemName, qty) => {
  try {
    console.log('📧 Starting email process for:', { employeeName, itemName, qty });
    
    // Fetch all admin emails from supabase
    const { data: admins, error: adminError } = await supabase
      .from('employees')
      .select('email')
      .eq('role', 'admin');

    console.log('🔍 Admin query result:', { admins, adminError });

    if (adminError || !admins || admins.length === 0) {
      console.error('❌ Failed to fetch admin emails:', adminError);
      return;
    }

    const subject = `Item Deduction Notification`;
    const html = `<p>Dear Admin,</p>
                  <p><strong>${employeeName}</strong> has deducted <strong>${qty}</strong> of <strong>${itemName}</strong>.</p>`;
    
    // Send email to all admins
    for (const admin of admins) {
      console.log('📨 Sending email to:', admin.email);
      try {
        const result = await sendEmailViaAppScript({
          to: admin.email,
          subject,
          html,
        });
        console.log('✅ Email sent to', admin.email, ':', result);
      } catch (emailErr) {
        console.error('⚠️ Failed to send email to', admin.email, ':', emailErr);
      }
    }
  } catch (err) {
    console.error('❌ Failed to send deduction emails:', err);
  }
};

/* ======================
   AUTH
====================== */
export const login = async (name, pin) => {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('name', name)
    .eq('pin_hash', hashPin(pin))
    .single();

  if (error || !data) {
    throw new Error('Invalid name or PIN');
  }
console.log('LOGIN USER ID:', data.id, typeof data.id);
  const { error: updateError } = await supabase
    .from('employees')
    .update({
      last_login: new Date().toISOString(),
    })
    .eq('id', data.id);

  if (updateError) {
    console.error('Failed update last_login:', updateError);
  }

  return data;
};



/* ======================
   ITEMS
====================== */
export const getItems = async () => {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const deductItem = async ({ employeeId, employeeName, items }) => {
  console.log('🚀 Starting deductItem:', { employeeId, employeeName, items });
  
  for (const item of items) {
    // 1. Get current item data
    const data = await getItemById(item.itemId);
    console.log('📦 Current item data:', { id: data.id, name: data.name, currentStock: data.stock });
    
    // 2. Calculate new stock (prevent negative)
    const newStock = Math.max(data.stock - item.qty, 0);
    console.log('📊 Calculating new stock:', { 
      currentStock: data.stock, 
      deductQty: item.qty, 
      newStock 
    });
    
    // 3. Update stock in database
    await updateItemStock(item.itemId, newStock);
    console.log('✅ Stock updated in database:', { itemId: item.itemId, newStock });
    
    // 4. Add history entry
    await addHistoryEntry({
      employee_id: employeeId,
      employee_name: employeeName,
      item_id: item.itemId,
      item_name: data.name,
      qty: item.qty,
      action: 'deduct',
    });
    console.log('📝 History entry added');
    
    // 5. Send email notification
    console.log('📧 Calling sendDeductionEmail for:', data.name);
    await sendDeductionEmail(employeeName, data.name, item.qty);
  }
  
  console.log('✅ deductItem completed successfully');
  return { success: true };
};

/* ======================
   HISTORY
====================== */
export const getHistory = async ({ employeeId, itemId } = {}) => {
  let query = supabase.from('history').select('*');

  if (employeeId) query = query.eq('employee_id', employeeId);
  if (itemId) query = query.eq('item_id', itemId);

  const { data, error } = await query.order('timestamp', { ascending: false });
  if (error) throw error;

  return data;
};

/* ======================
   TASKS
====================== */
export const getTasks = async ({ employeeId } = {}) => {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    return tasks.map(task => {
      const readBy = csvToArray(task.read_by);
      const checkedBy = csvToArray(task.checked_by);
      
      // Parse deducted_by_list - ensure it's always an array
      let deductedBy = [];
      if (Array.isArray(task.deducted_by_list)) {z
        deductedBy = task.deducted_by_list.map(id => String(id));
      } else if (typeof task.deducted_by_list === 'string') {
        deductedBy = csvToArray(task.deducted_by_list);
      } else if (task.deducted_by_list === null || task.deducted_by_list === undefined) {
        deductedBy = [];
      }

      const can_mark_done =
        employeeId &&
        checkedBy.includes(String(employeeId)) &&
        deductedBy.includes(String(employeeId));

      // Debug log
      console.log('getTasks mapping:', {
        taskId: task.task_id,
        deducted_by_list_raw: task.deducted_by_list,
        deductedBy,
        checked_by_raw: task.checked_by,
        checkedBy,
        employeeId: String(employeeId),
        can_mark_done
      });

      return {
        ...task,
        read_by_list: readBy,
        read_count: readBy.length,
        checked_by_list: checkedBy,
        checked_count: checkedBy.length,
        deducted_by_list: deductedBy,
        can_mark_done,
      };
    });
  } catch (err) {
    console.error('getTasks error:', err);
    return [];
  }
};

export const updateTaskReadStatus = async (taskId, employeeId) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('read_by')
    .eq('task_id', taskId)
    .single();

  if (error) throw error;

  const list = csvToArray(data.read_by);
  const employeeIdStr = String(employeeId);
  
  if (!list.includes(employeeIdStr)) {
    list.push(employeeIdStr);
  }

  await supabase
    .from('tasks')
    .update({ read_by: arrayToCsv(list) })
    .eq('task_id', taskId);

  return { success: true };
};

export const updateTaskCheckStatus = async (taskId, employeeId) => {
  const { data, error } = await supabase
    .from('tasks')
    .select('checked_by')
    .eq('task_id', taskId)
    .single();

  if (error) throw error;

  const list = csvToArray(data.checked_by);
  const employeeIdStr = String(employeeId);
  
  if (!list.includes(employeeIdStr)) {
    list.push(employeeIdStr);
  }

  await supabase
    .from('tasks')
    .update({ checked_by: arrayToCsv(list) })
    .eq('task_id', taskId);

  return { success: true };
};

export const canMarkTaskDone = async (taskId, employeeId) => {
  const employeeIdStr = String(employeeId);

  // Fetch task assignment and check status
  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .select('checked_by, assigned_at')
    .eq('task_id', taskId)
    .single();
  if (taskErr) throw taskErr;

  const checkedList = csvToArray(task.checked_by);
  const isChecked = checkedList.includes(employeeIdStr);

  // Check deduction after task was assigned
  const { data: hist, error: histErr } = await supabase
    .from('history')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('action', 'deduct')
    .gt('timestamp', task.assigned_at)
    .limit(1);
  if (histErr) throw histErr;

  const hasValidDeduct = Array.isArray(hist) && hist.length > 0;

  return isChecked && hasValidDeduct;
};

export const doneTask = async (taskId, employeeId) => {
  const allowed = await canMarkTaskDone(taskId, employeeId);
  if (!allowed) {
    throw new Error('Task cannot be marked as done. You must check the task and deduct after it was assigned.');
  }

  const { data } = await supabase
    .from('tasks')
    .select('done_by')
    .eq('task_id', taskId)
    .single();

  const list = csvToArray(data?.done_by);
  const idStr = String(employeeId);

  if (!list.includes(idStr)) list.push(idStr);

  await supabase
    .from('tasks')
    .update({
      done_by: arrayToCsv(list),
      done_at: new Date().toISOString(),
      status: 'completed',
    })
    .eq('task_id', taskId);

  return { success: true, doneByList: list };
};

export const deductTaskItems = async ({ taskId, employeeId, employeeName, items }) => {
  if (!items || items.length === 0) throw new Error("No items specified for deduction.");
  for (const item of items) {
    const { data: currentItemData } = await supabase
      .from('items')
      .select('stock, name')
      .eq('id', item.item_id)
      .single();
    const newStock = (currentItemData?.stock || 0) - item.required_qty;
    const { error: updateError } = await supabase
      .from('items')
      .update({ stock: newStock })
      .eq('id', item.item_id);
    if (updateError) throw new Error(`Failed to update stock for item ID ${item.item_id}`);

    await addHistoryEntry({
      employee_id: employeeId,
      employee_name: employeeName,
      item_id: item.item_id,
      item_name: currentItemData?.name || 'Unknown Item',
      qty: item.required_qty,
      action: 'deduct',
    });
    await sendDeductionEmail(employeeName, currentItemData?.name || 'Unknown Item', item.required_qty);
  }
  const { data: taskData, error: taskError } = await supabase
    .from('tasks')
    .select('deducted_by_list')
    .eq('task_id', taskId)
    .single();
  if (taskError || !taskData) throw new Error("Task not found.");

  let deductedByList = Array.isArray(taskData.deducted_by_list)
    ? taskData.deducted_by_list
    : csvToArray(taskData.deducted_by_list);
  const employeeIdStr = String(employeeId);
  if (!deductedByList.includes(employeeIdStr)) deductedByList.push(employeeIdStr);

  const { error: updateTaskError } = await supabase
    .from('tasks')
    .update({ deducted_by_list: deductedByList })
    .eq('task_id', taskId);
  if (updateTaskError) throw new Error("Failed to update task deducted status.");

  return { success: true, newDeductedList: deductedByList };
};

/* ======================
   APP SCRIPT EMAIL
====================== */
export const sendEmailViaAppScript = async ({ to, subject, html }) => {
  if (!to || !subject || !html) {
    throw new Error('Missing required fields (to, subject, html)');
  }
  console.log('🌐 Calling Apps Script with:', { to, subject });
  const res = await fetch(APPSCRIPT_EMAIL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: APPSCRIPT_EMAIL_SECRET,
      to,
      subject,
      html,
    }),
  });
  const json = await res.json();
  console.log('📥 Apps Script response:', json);
  if (!res.ok || json.status !== 'success') {
    throw new Error(json?.message || 'Failed to send email');
  }
  return { success: true };
};

export const registerPushToken = async (employeeId, token) => {
  await supabase
    .from('employees')
    .update({ push_token: token })
    .eq('id', employeeId);

  return { success: true };
};
