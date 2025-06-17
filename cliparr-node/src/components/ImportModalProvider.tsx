import React, { createContext, useContext, useState, useCallback } from 'react';
import ImportModal, { Show } from './ImportModal';
import { apiClient } from '../integration/api-client';
import { useToast } from './ToastContext';

interface ImportModalContextType {
  openImportModal: () => void;
  closeImportModal: () => void;
}

const ImportModalContext = createContext<ImportModalContextType | undefined>(undefined);

export function useImportModal() {
  const ctx = useContext(ImportModalContext);
  if (!ctx) {
    throw new Error('useImportModal must be used within ImportModalProvider');
  }
  return ctx;
}

export const ImportModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const toast = useToast();

  const openImportModal = useCallback(() => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setShows([]);
    apiClient.getUnimportedShows()
      .then((data) => {
        setShows(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch unimported shows');
        setLoading(false);
      });
  }, []);

  const closeImportModal = useCallback(() => {
    setOpen(false);
    setShows([]);
    setError(null);
    setLoading(false);
    setImporting(false);
  }, []);

  const handleImport = async (selectedIds: number[]) => {
    setImporting(true);
    setError(null);
    try {
      await apiClient.importShows(selectedIds);
      toast({
        type: 'success',
        message: `Imported ${selectedIds.length} shows successfully!`,
      });
      closeImportModal();
    } catch {
      setError('Failed to import shows');
      toast({
        type: 'error',
        message: 'Failed to import shows',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <ImportModalContext.Provider value={{ openImportModal, closeImportModal }}>
      {children}
      <ImportModal
        open={open}
        onClose={closeImportModal}
        onImport={handleImport}
        shows={shows}
        loading={loading || importing}
        error={error}
      />
    </ImportModalContext.Provider>
  );
};

// For clarity, export a root component for modal placement
export const ImportModalRoot = () => null;
