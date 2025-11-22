/**
 * Toast notification store
 * Manages global toast notifications for non-blocking user feedback
 */

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number; // milliseconds
}

interface ToastState {
  toasts: Toast[];

  /**
   * Add a new toast notification
   */
  addToast: (type: ToastType, message: string, duration?: number) => void;

  /**
   * Remove a toast by ID
   */
  removeToast: (id: string) => void;

  /**
   * Convenience methods
   */
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

/**
 * Generate a unique ID for toasts
 */
const generateId = (): string => {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Toast store
 */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (type, message, duration = 3000) => {
    const id = generateId();
    const toast: Toast = { id, type, message, duration };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  // Convenience methods
  success: (message, duration) => {
    useToastStore.getState().addToast('success', message, duration);
  },

  error: (message, duration) => {
    useToastStore.getState().addToast('error', message, duration);
  },

  info: (message, duration) => {
    useToastStore.getState().addToast('info', message, duration);
  },
}));
