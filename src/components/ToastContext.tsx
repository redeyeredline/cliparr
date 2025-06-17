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
