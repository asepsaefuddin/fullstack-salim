import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;
const SECRET_KEY = process.env.REACT_APP_API_SECRET;

const sendRequest = async (action, data = {}) => {
  try {
    // Debug logging
    console.log('Request:', { action, data });

    // Prepare the payload
    const payload = {
      action,
      data,
      secret: SECRET_KEY
    };

    const response = await axios({
      method: 'post',
      url: API_URL,
      data: JSON.stringify(payload),  // Send as stringified JSON
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      redirect: 'follow',  // Important for Google Apps Script
      responseType: 'json'
    });

    // Debug logging
    console.log('Response:', response.data);

    return response.data.data;
  } catch (error) {
    console.error('API Error:', {
      action,
      error: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
};

// Auth
export const login = (email, password) => sendRequest('LOGIN', { email, password });

// Items
export const getItems = () => sendRequest('GET_ITEMS');
export const searchItems = (query) => sendRequest('SEARCH_ITEMS', { query });
export const addItem = (item) => sendRequest('ADD_ITEM', item);
export const updateItem = (item) => sendRequest('UPDATE_ITEM', item);
export const deleteItem = (id) => sendRequest('DELETE_ITEM', { id });

// Employees
export const getEmployees = () => sendRequest('GET_EMPLOYEES');
export const addEmployee = (employee) => sendRequest('ADD_EMPLOYEE', employee);
export const updateEmployee = (employee) => sendRequest('UPDATE_EMPLOYEE', employee);
export const deleteEmployee = (id) => sendRequest('DELETE_EMPLOYEE', { id });

// History
export const getHistory = (params) => sendRequest('GET_HISTORY', params);
export const updateSettings = (settings) => sendRequest('UPDATE_SETTINGS', settings);
export const updateHistory = (history) => sendRequest('UPDATE_HISTORY', history);
export const deleteHistory = (id) => sendRequest('DELETE_HISTORY', { id });

// Tasks
export const addTask = (taskData) => sendRequest('ADD_TASK', taskData);
export const getTasks = (employeeId) => sendRequest('GET_TASKS', { employeeId });
export const updateTask = (taskData) => sendRequest('UPDATE_TASK', taskData);
export const deleteTask = (taskId) => sendRequest('DELETE_TASK', { taskId });

export const updateLowStockThreshold = (threshold) => {
  return sendRequest('UPDATE_LOW_STOCK_THRESHOLD', { threshold });
};

// Get Current Low Stock Threshold
export const getLowStockThreshold = () => {
  return sendRequest('GET_LOW_STOCK_THRESHOLD');
};