import { useContext } from 'react';
import { ImportModalContext } from '../contexts/ImportModalContext';

export function useImportModal() {
  const ctx = useContext(ImportModalContext);
  if (!ctx) {
    throw new Error('useImportModal must be used within ImportModalProvider');
  }
  return ctx;
}
