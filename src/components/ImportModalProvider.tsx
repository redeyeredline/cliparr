// Provider component for import modal functionality with state management and API integration.
// Handles fetching unimported shows, import operations, and modal state across the application.
import React, { useState, useCallback } from 'react';
import ImportModal, { Show } from './ImportModal';
import { apiClient } from '../integration/api-client';
import { useToast } from './ToastContext';
import { ImportModalContext } from '../contexts/ImportModalContext.tsx';

export const ImportModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const toast = useToast();

  const openImportModal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1) fetch your shows
      const data = await apiClient.getUnimportedShows();
      setShows(data);
      // 2) then open the modal at its full size
      setOpen(true);
    } catch {
      setError('Failed to fetch unimported shows');
      // still open so user can see/retry the error
      setOpen(true);
    } finally {
      setLoading(false);
    }
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
    closeImportModal();
    try {
      await apiClient.importShows(selectedIds);
      toast({ type: 'success', message: `Imported ${selectedIds.length} shows successfully!` });
    } catch {
      toast({ type: 'error', message: 'Failed to import shows' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <ImportModalContext.Provider value={{ openImportModal, closeImportModal, isOpen: open }}>
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
