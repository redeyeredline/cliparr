import React, { useState, useEffect } from 'react';
import ImportModal, { Show } from '../components/ImportModal';
import { useToast } from '../components/ToastContext';
import { apiClient } from '../integration/api-client';

export default function ImportModalTest() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [importing, setImporting] = useState(false);
  const toast = useToast();

  // Fetch unimported shows from API
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setLoading(true);
    setError(null);
    apiClient.getUnimportedShows()
      .then((data) => {
        setShows(data);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to fetch unimported shows');
        setLoading(false);
      });
  }, [isOpen]);

  // Import selected shows
  const handleImport = async (selectedIds: number[]) => {
    setImporting(true);
    setError(null);
    try {
      const res = await apiClient.importShows(selectedIds);
      toast({
        type: 'success',
        message: `Imported ${selectedIds.length} shows successfully!`,
      });
      setIsOpen(false);
    } catch (err) {
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
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Import Modal Test (API Data)</h1>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Open Import Modal
      </button>

      <ImportModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onImport={handleImport}
        shows={shows}
        loading={loading || importing}
        error={error}
      />
    </div>
  );
}
