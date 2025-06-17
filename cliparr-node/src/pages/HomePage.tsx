import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../integration/api-client';
import { logger } from '../services/logger.frontend.js';
import { wsClient } from '../services/websocket.frontend.js';
import AlphabetSidebar from '../components/AlphabetSidebar';
import { useToast } from '../components/ToastContext';
import { FaTrash } from 'react-icons/fa';

interface Show {
  id: number;
  title: string;
  seasonCount: number;
  episodeCount: number;
  status: string;
}

interface DbStatus {
  success: boolean;
  message: string;
  testValue?: string;
}

function HomePage() {
  const [health, setHealth] = useState('checking...');
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [healthCheckMsg, setHealthCheckMsg] = useState<string | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Show; direction: 'asc' | 'desc' } | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const toast = useToast();

  // Map to store refs for the first show of each letter
  const letterRefs = useRef<{ [letter: string]: HTMLTableRowElement | null }>({});

  // Get available letters from shows
  const availableLetters = [...new Set(shows.map((show) => show.title.charAt(0).toUpperCase()))].sort();

  // Sort shows based on current sort config
  const sortedShows = [...shows].sort((a, b) => {
    if (!sortConfig) {
      return 0;
    }
    const { key, direction } = sortConfig;
    if (a[key] < b[key]) {
      return direction === 'asc' ? -1 : 1;
    }
    if (a[key] > b[key]) {
      return direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Find the first index for each letter
  const firstIndexForLetter: { [letter: string]: number } = {};
  sortedShows.forEach((show, idx) => {
    const letter = show.title.charAt(0).toUpperCase();
    if (firstIndexForLetter[letter] === undefined) {
      firstIndexForLetter[letter] = idx;
    }
  });

  // Scroll to the first show with the selected letter
  const handleLetterClick = (letter: string) => {
    setActiveLetter(letter);
    const ref = letterRefs.current[letter];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSort = (key: keyof Show) => {
    setSortConfig((current) => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const fetchShows = useCallback(async () => {
    try {
      const data = await apiClient.getImportedShows();
      setShows(data);
    } catch (err) {
      logger.error('Failed to fetch shows:', err);
      setError('Failed to fetch shows');
    }
  }, []);

  useEffect(() => {
    // Set up WebSocket event listeners
    const handleConnection = (data: { status: string }) => {
      setWsStatus(data.status);
      if (data.status === 'error') {
        setError('WebSocket connection failed');
      } else {
        setError(null);
      }
    };

    const handleError = () => {
      setWsStatus('error');
      setError('WebSocket connection failed');
    };

    // Add event listeners
    wsClient.addEventListener('connection', handleConnection);
    wsClient.addEventListener('error', handleError);

    // Cleanup
    return () => {
      wsClient.removeEventListener('connection', handleConnection);
      wsClient.removeEventListener('error', handleError);
    };
  }, []);

  const testDatabase = useCallback(async () => {
    try {
      const data = await apiClient.testDatabase();
      setDbStatus(data);
      if (!data.success) {
        setError('Database test failed');
      }
    } catch {
      setDbStatus({ success: false, message: 'Database test failed' });
      setError('Failed to check database status');
    }
  }, []);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setHealthCheckMsg(null);
    try {
      const data = await apiClient.checkHealth();
      setHealth(data.status);
      if (data.status === 'healthy') {
        wsClient.connect();
        testDatabase();
        setHealthCheckMsg('✅ Server health check successful!');
        logger.info('Health check result:', data);
      } else {
        setHealthCheckMsg('❌ Server health check failed.');
        logger.error('Health check failed:', data);
      }
    } catch (err) {
      setHealth('error');
      setHealthCheckMsg('❌ Failed to connect to server.');
      logger.error('Health check error:', err);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, [testDatabase]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  useEffect(() => {
    if (health === 'healthy') {
      fetchShows();
    }
  }, [health, fetchShows]);

  // Selection logic
  const allSelected = selected.length === sortedShows.length && sortedShows.length > 0;
  const handleSelectAll = () => {
    setSelected(allSelected ? [] : sortedShows.map((show) => show.id));
  };
  const handleSelect = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]);
  };
  const handleDelete = async () => {
    try {
      const result = await apiClient.deleteShows(selected);
      toast({ type: 'success', message: `${result.deleted} shows deleted` });
      setSelected([]);
      fetchShows();
    } catch {
      toast({ type: 'error', message: 'Failed to delete shows' });
    }
  };

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Shows Table */}
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 w-12 text-center align-middle">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    aria-label="Select all shows"
                    className="align-middle"
                  />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('title')}
                >
                  Title {sortConfig?.key === 'title' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('seasonCount')}
                >
                  Seasons {sortConfig?.key === 'seasonCount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('episodeCount')}
                >
                  Episodes {sortConfig?.key === 'episodeCount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {sortedShows.map((show, idx) => (
                <tr key={show.id} ref={(el) => {
                  const letter = show.title.charAt(0).toUpperCase();
                  if (firstIndexForLetter[letter] === idx) {
                    letterRefs.current[letter] = el;
                  }
                }}>
                  <td className="px-4 py-2 w-12 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={selected.includes(show.id)}
                      onChange={() => handleSelect(show.id)}
                      aria-label={`Select show ${show.title}`}
                      className="align-middle"
                    />
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">{show.title}</td>
                  <td className="px-6 py-2 whitespace-nowrap">{show.seasonCount}</td>
                  <td className="px-6 py-2 whitespace-nowrap">{show.episodeCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Fixed bottom bar for deletion */}
        {selected.length > 0 && (
          <div
            className="fixed bottom-0 left-0 w-full bg-gray-900 border-t border-gray-700 flex justify-end items-center p-4 z-50"
            style={{ boxShadow: '0 -2px 8px rgba(0,0,0,0.3)' }}
          >
            <span className="text-gray-300 mr-4">{selected.length} series selected</span>
            <button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-8 rounded shadow text-lg"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {/* Alphabet Sidebar on the right */}
      <AlphabetSidebar
        letters={availableLetters}
        activeLetter={activeLetter}
        onLetterClick={handleLetterClick}
      />
    </div>
  );
}

export default HomePage;
