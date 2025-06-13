import React, { useState, useEffect } from 'react';
import { useToast } from './ToastProvider';

function ImportModal({ isOpen, onClose, onImport }) {
  const [shows, setShows] = useState([]);
  const [selectedShows, setSelectedShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchShows();
    }
  }, [isOpen]);

  const fetchShows = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sonarr/series');
      const data = await response.json();
      setShows(data);
    } catch (error) {
      addToast('Failed to fetch shows', 'error');
      console.error('Error fetching shows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectShow = (showId) => {
    setSelectedShows(prev => 
      prev.includes(showId)
        ? prev.filter(id => id !== showId)
        : [...prev, showId]
    );
  };

  const handleImport = async () => {
    try {
      const response = await fetch('/api/sonarr/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sonarrIds: selectedShows }),
      });

      if (!response.ok) {
        throw new Error('Failed to import shows');
      }

      addToast('Shows imported successfully', 'success');
      onImport();
      onClose();
    } catch (error) {
      addToast('Failed to import shows', 'error');
      console.error('Error importing shows:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Import Shows</h2>
        
        {loading ? (
          <div className="text-center py-4">Loading shows...</div>
        ) : (
          <div className="space-y-2">
            {shows.map(show => (
              <div
                key={show.id}
                className="flex items-center p-2 hover:bg-gray-100 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedShows.includes(show.id)}
                  onChange={() => handleSelectShow(show.id)}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">{show.title}</div>
                  <div className="text-sm text-gray-600">{show.overview}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={selectedShows.length === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Import Selected ({selectedShows.length})
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportModal; 