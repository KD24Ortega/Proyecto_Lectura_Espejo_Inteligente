// import axios from 'axios';

// const api = axios.create({
//   baseURL: 'http://127.0.0.1:8000'
// });

// // Interceptor JWT
// api.interceptors.request.use(config => {
//   const token = localStorage.getItem('token');
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

// export default api;

import axios from "axios";

const normalizeApiBaseUrl = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim().replace(/\/+$/, "");

  // If the user sets "myapp.up.railway.app" (no scheme), treat it as https.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
};

export const API_BASE_URL =
  normalizeApiBaseUrl(import.meta.env.VITE_API_URL) ?? "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

export default api;
