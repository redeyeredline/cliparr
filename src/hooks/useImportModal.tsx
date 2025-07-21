// Custom hook for accessing import modal context with error handling.
// Provides type-safe access to modal state and functions from ImportModalContext.
import { useContext } from 'react';
import { ImportModalContext } from '../contexts/ImportModalContext.tsx';

export function useImportModal() {
  const ctx = useContext(ImportModalContext);
  if (!ctx) {
    throw new Error('useImportModal must be used within ImportModalProvider');
  }
  return ctx;
}
