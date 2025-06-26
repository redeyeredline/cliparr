// React context for import modal state management across components.
// Provides modal open/close functions and open state for global access.
import { createContext } from 'react';

export interface ImportModalContextType {
  openImportModal: () => void;
  closeImportModal: () => void;
  isOpen: boolean;
}

export const ImportModalContext = createContext<ImportModalContextType | undefined>(undefined);
