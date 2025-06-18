import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiClient } from '../integration/api-client';
import { logger } from '../services/logger.frontend.js';
import { wsClient } from '../services/websocket.frontend.js';
import AlphabetSidebar from '../components/AlphabetSidebar';
import { useToast } from '../components/ToastContext';
import { FaTrash, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface Show {
  id: number;
  title: string;
  path: string;
}

interface DbStatus {
  success: boolean;
  message: string;
  testValue?: string;
}

interface PaginatedResponse {
  shows: Show[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
  const [sortKey, setSortKey] = useState<keyof Show>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<number[]>([]);
  const toast = useToast();

  // Map to store refs for the first show of each letter
  const letterRefs = useRef<{ [letter: string]: HTMLTableRowElement | null }>({});
  const healthCheckRef = useRef<boolean>(false);

  // Get available letters from shows
  const availableLetters = useMemo(() => {
    const letters = shows.map((show) => show.title.charAt(0).toUpperCase());
    return [...new Set(letters)].sort();
  }, [shows]);

  // Sort shows
  const sortedShows = useMemo(() => {
    // Create array of indices for stable sort
    const indexed = shows.map((show, index) => ({ show, index }));

    // Debug log the current shows and sort config
    console.log('Current sort config:', { sortKey, sortDirection });
    console.log('Shows before sort:', indexed.map(({ show }) => ({
      id: show.id,
      title: show.title,
      path: show.path,
    })));

    // Sort with index as tiebreaker for stability
    indexed.sort((a, b) => {
      const aVal = String(a.show[sortKey]);
      const bVal = String(b.show[sortKey]);

      // Debug log comparison values for Bill Burr shows
      if (aVal.includes('Bill Burr') || bVal.includes('Bill Burr')) {
        console.log('Comparing Bill Burr shows:', {
          a: { id: a.show.id, title: a.show.title, path: a.show.path, index: a.index },
          b: { id: b.show.id, title: b.show.title, path: b.show.path, index: b.index },
          sortKey,
          aVal,
          bVal,
        });
      }

      const compareResult = aVal.localeCompare(bVal, undefined, {
        numeric: true,
        sensitivity: 'base',
      });

      // If values are equal, use original index for stable sort
      if (compareResult === 0) {
        return a.index - b.index;
      }

      return sortDirection === 'asc' ? compareResult : -compareResult;
    });

    const sorted = indexed.map(({ show }) => show);

    // Debug log the final sorted result
    console.log('Shows after sort:', sorted.map((show) => ({
      id: show.id,
      title: show.title,
      path: show.path,
    })));

    return sorted;
  }, [shows, sortKey, sortDirection]);

  // Find the first index for each letter based on sorted shows for letter navigation
  const firstIndexForLetter = useMemo(() => {
    const indices: { [letter: string]: number } = {};
    sortedShows.forEach((show, idx) => {
      const letter = show.title.charAt(0).toUpperCase();
      if (indices[letter] === undefined) {
        indices[letter] = idx;
      }
    });
    return indices;
  }, [sortedShows]);

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
    if (healthCheckRef.current) {
      return;
    }
    healthCheckRef.current = true;

    setIsLoading(true);
    setError(null);
    setHealthCheckMsg(null);
    try {
      const data = await apiClient.checkHealth();
      setHealth(data.status);
      if (data.status === 'healthy') {
        wsClient.connect();
        await testDatabase();
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
      healthCheckRef.current = false;
    }
  }, [testDatabase]);

  const fetchShows = useCallback(async () => {
    try {
      const data = await apiClient.getShows();
      setShows(data.shows);
    } catch (err) {
      logger.error('Failed to fetch shows:', err);
      setError('Failed to fetch shows');
    }
  }, []);

  // Combined useEffect for initialization and cleanup
  useEffect(() => {
    let mounted = true;

    // Set up WebSocket event listeners
    const handleConnection = (data: { status: string }) => {
      if (!mounted) {
        return;
      }
      setWsStatus(data.status);
      if (data.status === 'error') {
        setError('WebSocket connection failed');
      } else {
        setError(null);
      }
    };

    const handleError = () => {
      if (!mounted) {
        return;
      }
      setWsStatus('error');
      setError('WebSocket connection failed');
    };

    // Add import_progress listener for real-time show updates
    const handleImportProgress = async (data: any) => {
      if (!mounted) {
        return;
      }
      if (data.type === 'import_progress' && data.status === 'completed' && data.showId) {
        try {
          const newShow = await apiClient.getShow(data.showId);
          setShows((prevShows) => {
            const filtered = prevShows.filter((s) => s.id !== newShow.id);
            return [...filtered, newShow];
          });
        } catch (err) {
          logger.error('Failed to fetch new show:', err);
        }
      }
    };

    // Add event listeners
    wsClient.addEventListener('connection', handleConnection);
    wsClient.addEventListener('error', handleError);
    wsClient.addEventListener('message', handleImportProgress);

    // Initial setup
    checkHealth();

    // Cleanup
    return () => {
      mounted = false;
      wsClient.removeEventListener('connection', handleConnection);
      wsClient.removeEventListener('error', handleError);
      wsClient.removeEventListener('message', handleImportProgress);
    };
  }, [checkHealth]);

  // Fetch shows when health is good
  useEffect(() => {
    if (health === 'healthy') {
      fetchShows();
    }
  }, [health, fetchShows]);

  // Scroll to the first show with the selected letter
  const handleLetterClick = (letter: string) => {
    setActiveLetter(letter);
    const ref = letterRefs.current[letter];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSort = (key: keyof Show) => {
    setSortDirection((current) => {
      if (key === sortKey) {
        return current === 'asc' ? 'desc' : 'asc';
      }
      return 'asc';
    });
    setSortKey(key);
  };

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
                    checked={selected.length === sortedShows.length && sortedShows.length > 0}
                    onChange={() => setSelected(selected.length === sortedShows.length ? [] : sortedShows.map((s) => s.id))}
                    aria-label="Select all shows"
                    className="align-middle"
                  />
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('title')}
                >
                  Title {sortKey === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('path')}
                >
                  Path {sortKey === 'path' && (sortDirection === 'asc' ? '↑' : '↓')}
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
                  <td className="px-6 py-2 whitespace-nowrap">{show.path}</td>
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
