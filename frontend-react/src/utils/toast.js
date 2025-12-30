import { toast } from 'react-hot-toast';

const DEFAULT_DURATION_MS = 3500;

export const notifySuccess = (message, options = {}) =>
  toast.success(message, { duration: DEFAULT_DURATION_MS, ...options });

export const notifyError = (message, options = {}) =>
  toast.error(message, { duration: DEFAULT_DURATION_MS, ...options });

export const notifyInfo = (message, options = {}) =>
  toast(message, { icon: 'ℹ️', duration: DEFAULT_DURATION_MS, ...options });

export const notifyWarning = (message, options = {}) =>
  toast(message, { icon: '⚠️', duration: DEFAULT_DURATION_MS, ...options });

export const isNetworkError = (error) => {
  const code = error?.code;
  const message = String(error?.message || '').toLowerCase();
  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    message.includes('network error') ||
    message.includes('failed to fetch') ||
    message.includes('timeout')
  );
};

export const notifyConnectionError = (error, fallback = 'Error de conexión') => {
  if (isNetworkError(error)) {
    return notifyError(fallback);
  }
  return notifyError(fallback);
};
