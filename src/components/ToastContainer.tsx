/**
 * ToastContainer component
 * Renders toast notifications in a fixed position
 */

import React from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, type Toast, type ToastType } from '../store/toastStore';

/**
 * Get icon for toast type
 */
const getToastIcon = (type: ToastType) => {
  switch (type) {
    case 'success':
      return <CheckCircle size={20} className="text-green-600 dark:text-green-400" />;
    case 'error':
      return <AlertCircle size={20} className="text-red-600 dark:text-red-400" />;
    case 'info':
      return <Info size={20} className="text-blue-600 dark:text-blue-400" />;
  }
};

/**
 * Get background color for toast type
 */
const getToastBgColor = (type: ToastType) => {
  switch (type) {
    case 'success':
      return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    case 'error':
      return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    case 'info':
      return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
  }
};

/**
 * Get text color for toast type
 */
const getToastTextColor = (type: ToastType) => {
  switch (type) {
    case 'success':
      return 'text-green-800 dark:text-green-200';
    case 'error':
      return 'text-red-800 dark:text-red-200';
    case 'info':
      return 'text-blue-800 dark:text-blue-200';
  }
};

/**
 * Individual toast component
 */
interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg mb-3 ${getToastBgColor(
        toast.type
      )} animate-slide-in-bottom`}
      role="alert"
      aria-live="polite"
    >
      {getToastIcon(toast.type)}
      <p className={`flex-1 text-sm ${getToastTextColor(toast.type)}`}>{toast.message}</p>
      <button
        onClick={onDismiss}
        className={`flex-shrink-0 ${getToastTextColor(toast.type)} opacity-70 hover:opacity-100`}
        aria-label="Dismiss notification"
      >
        <X size={18} />
      </button>
    </div>
  );
};

/**
 * ToastContainer component
 * Displays all active toasts
 */
export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-md w-full px-4"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};
