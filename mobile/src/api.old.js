import axios from 'axios';

// Use environment variables for API URL and secret key
const API_URL = "https://script.google.com/macros/s/AKfycbxYCFvEB7L6trJQreW9Z6OeR_J3ikaWnhNRfyYcyrflQ4x-m2WXRp70BKwD2vcGYso1/exec";
// const API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.REACT_NATIVE_API_URL || "https://script.google.com/macros/s/AKfycbyIX1kHYIMfvLXTej7m1jT1spaLQSaSPfU-an8uYfa6P57SGPJSXzN2rsAUBBDOS7pK9w/exec";
// const SECRET_KEY = process.env.EXPO_PUBLIC_SECRET_KEY || process.env.REACT_NATIVE_SECRET_KEY || "yoyo";
const SECRET_KEY = "yoyo";

const sendRequest = async (action, data = {}) => {
  const payload = { action, data, secret: SECRET_KEY };
  const response = await axios.post(API_URL, JSON.stringify(payload), {
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
  });
  if (response.data.status === "error") throw new Error(response.data.error || "API Error");
  return response.data.data;
};

export const login = (name, pin) => sendRequest('LOGIN', { name, pin });
export const getItems = () => sendRequest('GET_ITEMS');
export const deductItem = ({ employeeId, employeeName, items }) =>
  sendRequest('DEDUCT_ITEM', { employeeId, employeeName, items });
export const getHistory = (params = {}) => sendRequest('GET_HISTORY', params);
export const getTasks = (params = {}) => sendRequest('GET_TASKS', params);

export const updateTaskReadStatus = (taskId, employeeId) => 
  sendRequest('UPDATE_TASK_READ_STATUS', { taskId, employeeId });
export const updateTaskCheckStatus = (taskId, employeeId) => 
  sendRequest('UPDATE_TASK_CHECK_STATUS', { taskId, employeeId });
export const registerPushToken = (employeeId, token) => 
  sendRequest('REGISTER_PUSH_TOKEN', { employeeId, token });