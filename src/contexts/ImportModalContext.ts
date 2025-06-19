import { createContext } from 'react';

interface ImportModalContextType {
  openImportModal: () => void;
  closeImportModal: () => void;
}

export const ImportModalContext = createContext<ImportModalContextType | undefined>(undefined);
