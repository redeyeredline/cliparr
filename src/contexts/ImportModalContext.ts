import { createContext } from 'react';

export interface ImportModalContextType {
  openImportModal: () => void;
  closeImportModal: () => void;
  isOpen: boolean;
}

export const ImportModalContext = createContext<ImportModalContextType | undefined>(undefined);
