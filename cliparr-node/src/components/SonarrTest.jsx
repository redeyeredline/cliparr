import React, { useState, useEffect } from 'react';
import { apiClient } from '../integration/api-client.js';
import { logger } from '../services/logger.frontend.js';
import { wsClient } from '../services/websocket.frontend.js';

const SonarrTest = ({ backendReady }) => {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importStatus, setImportStatus] = useState({});
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    if (!backendReady) {
      return;
    }

    // Connect to WebSocket
    wsClient.connect();

    // Set up event listeners
    const handleConnection = (data) => {
      setWsConnected(data.status === 'connected');
    };

    const handleMessage = (data) => {
      if (data.type === 'import_progress') {
        setImportStatus((prev) => ({
          ...prev,
          [data.showId]: {
            status: data.status,
            message: data.message,
          },
        }));
      }
    };

    const handleError = (wsError) => {
      logger.error('WebSocket error:', wsError);
      setWsConnected(false);
    };

    // Add event listeners
    wsClient.addEventListener('connection', handleConnection);
    wsClient.addEventListener('message', handleMessage);
    wsClient.addEventListener('error', handleError);

    // Cleanup
    return () => {
      wsClient.removeEventListener('connection', handleConnection);
      wsClient.removeEventListener('message', handleMessage);
      wsClient.removeEventListener('error', handleError);
      wsClient.disconnect();
    };
  }, [backendReady]);

  const fetchShows = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getUnimportedShows();
      setShows(response);
    } catch (fetchError) {
      logger.error('Error fetching shows:', fetchError);
      setError(
        fetchError.response?.data?.details ||
        fetchError.message ||
        'Failed to fetch shows',
      );
    } finally {
      setLoading(false);
    }
  };

  const importShow = async (showId) => {
    try {
      setError(null);
      const response = await apiClient.importShow(showId);
      logger.info('Import started:', response);
      // Status updates will come through WebSocket
    } catch (importError) {
      logger.error('Error importing show:', importError);
      setError(
        importError.response?.data?.details ||
        importError.message ||
        'Failed to import show',
      );
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Sonarr Integration Test</h2>

      <div className="mb-4">
        <button
          onClick={fetchShows}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Fetch Unimported Shows'}
        </button>

        <div className="mt-2 text-sm">
          WebSocket Status: {wsConnected ? '✅ Connected' : '❌ Disconnected'}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shows.map((show) => (
          <div key={show.id} className="border rounded p-4">
            <h3 className="font-bold">{show.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{show.overview}</p>

            {importStatus[show.id] ? (
              <div className="text-sm">
                Status: {importStatus[show.id].status}
                <br />
                {importStatus[show.id].message}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => importShow(show.id)}
                className="bg-green-500 text-white px-3 py-1 rounded text-sm"
              >
                Import Show
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SonarrTest;
