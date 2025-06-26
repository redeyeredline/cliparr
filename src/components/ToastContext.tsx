// React context for toast notifications providing a hook-based API for displaying messages.
// Creates a context provider and custom hook for managing toast state across components.
import { createContext, useContext } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
  (params: { type?: ToastType; message: string; duration?: number }): void;
}

export const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
