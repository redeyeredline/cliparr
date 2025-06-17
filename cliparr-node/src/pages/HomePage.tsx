import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../integration/api-client';
import { logger } from '../services/logger.frontend.js';
import { wsClient } from '../services/websocket.frontend.js';
import AlphabetSidebar from '../components/AlphabetSidebar';

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

  return (
    <div className="flex h-full">
      {/* Alphabet Sidebar */}
      <AlphabetSidebar
        letters={availableLetters}
        activeLetter={activeLetter}
        onLetterClick={handleLetterClick}
      />
      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Shows Table */}
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
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
              {sortedShows.map((show, idx) => {
                const letter = show.title.charAt(0).toUpperCase();
                // Attach ref only to the first show for each letter
                const ref = firstIndexForLetter[letter] === idx
                  ? (el: HTMLTableRowElement | null) => {
                      letterRefs.current[letter] = el;
                    }
                  : undefined;
                return (
                  <tr
                    key={show.id}
                    ref={ref}
                    className="hover:bg-gray-700"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {show.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {show.seasonCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {show.episodeCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
