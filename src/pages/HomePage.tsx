import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiClient } from '../integration/api-client';
import { logger } from '../services/logger.frontend.js';
import { wsClient } from '../services/websocket.frontend.js';
import AlphabetSidebar from '../components/AlphabetSidebar';
import { useToast } from '../components/ToastContext';
import EmptyState from '../components/EmptyState';
import { useShiftSelect } from '../utils/selectionUtils';

interface Show {
  id: number;
  title: string;
  path: string;
}

interface ImportProgressEvent {
  type: string;
  status: string;
  showId?: number;
}

// Helper function to get the sortable title (removes leading articles)
const getSortableTitle = (title: string): string => {
  const articles = ['the ', 'a ', 'an '];
  const lowerTitle = title.toLowerCase();

  for (const article of articles) {
    if (lowerTitle.startsWith(article)) {
      return title.substring(article.length).trim();
    }
  }

  return title;
};

// Helper function to get the display letter for alphabet navigation
const getDisplayLetter = (title: string): string => {
  const sortableTitle = getSortableTitle(title);
  return sortableTitle.charAt(0).toUpperCase();
};

function HomePage() {
  // State hooks
  const [health, setHealth] = useState('checking...');
  const [shows, setShows] = useState<Show[]>([]);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<keyof Show>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const toast = useToast();

  // Refs
  const letterRefs = useRef<{ [letter: string]: HTMLTableRowElement | null }>({});
  const healthCheckRef = useRef<boolean>(false);
  const tableRef = useRef<HTMLTableElement>(null);

  // Get available letters from shows (using sortable titles)
  const availableLetters = useMemo(() => {
    const letters = shows.map((show) => getDisplayLetter(show.title));
    return [...new Set(letters)].sort();
  }, [shows]);

  // Sort shows
  const sortedShows = useMemo(() => {
    const indexed = shows.map((show, index) => ({ show, index }));
    indexed.sort((a, b) => {
      let aVal: string;
      let bVal: string;

      if (sortKey === 'title') {
        aVal = getSortableTitle(a.show.title);
        bVal = getSortableTitle(b.show.title);
      } else {
        aVal = String(a.show[sortKey]);
        bVal = String(b.show[sortKey]);
      }

      const compareResult = aVal.localeCompare(bVal, undefined, {
        numeric: true,
        sensitivity: 'base',
      });

      if (compareResult === 0) {
        return a.index - b.index;
      }

      return sortDirection === 'asc' ? compareResult : -compareResult;
    });

    return indexed.map(({ show }) => show);
  }, [shows, sortKey, sortDirection]);

  // Find the first index for each letter based on sorted shows
  const firstIndexForLetter = useMemo(() => {
    const indices: { [letter: string]: number } = {};
    sortedShows.forEach((show, idx) => {
      const letter = getDisplayLetter(show.title);
      if (indices[letter] === undefined) {
        indices[letter] = idx;
      }
    });
    return indices;
  }, [sortedShows]);

  // Initialize shift-select
  const shiftSelect = useShiftSelect({
    items: sortedShows,
    getId: (show) => show.id,
  });

  const { selected, handleToggle, selectAll, deselectAll, isSelected } = shiftSelect;

  // Event handlers
  const handleSelect = (
    showId: number,
    event: React.MouseEvent | React.ChangeEvent<HTMLInputElement>,
  ) => {
    const isNativeEvent = event instanceof MouseEvent;
    const shiftKey = isNativeEvent ? event.shiftKey : (event.nativeEvent as MouseEvent).shiftKey;
    handleToggle(showId, {
      shiftKey,
      preventDefault: () => event.preventDefault(),
      stopPropagation: () => event.stopPropagation(),
      nativeEvent: isNativeEvent ? event : event.nativeEvent,
    } as React.MouseEvent);
  };

  const testDatabase = useCallback(async () => {
    try {
      const data = await apiClient.testDatabase();
      if (!data.success) {
        logger.error('Health check failed:', data);
      }
    } catch {
      logger.error('Failed to check database status');
    }
  }, []);

  const checkHealth = useCallback(async () => {
    if (healthCheckRef.current) {
      return;
    }
    healthCheckRef.current = true;

    try {
      const data = await apiClient.checkHealth();
      setHealth(data.status);
      if (data.status === 'healthy') {
        wsClient.connect();
        await testDatabase();
        logger.info('Health check result:', data);
      } else {
        logger.error('Health check failed:', data);
      }
    } catch (err) {
      setHealth('error');
      logger.error('Health check error:', err);
    } finally {
      healthCheckRef.current = false;
    }
  }, [testDatabase]);

  const fetchShows = useCallback(async () => {
    try {
      const data = await apiClient.getShows();
      setShows(data.shows);
    } catch (err) {
      logger.error('Failed to fetch shows:', err);
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
      if (data.status === 'error') {
        logger.error('WebSocket connection failed');
      }
    };

    const handleError = () => {
      if (!mounted) {
        return;
      }
      logger.error('WebSocket connection failed');
    };

    // Add import_progress listener for real-time show updates
    const handleImportProgress = async (data: ImportProgressEvent) => {
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

  // Reset selection when shows change (e.g., after import)
  useEffect(() => {
    deselectAll();
  }, [shows, deselectAll]);

  const handleSelectAll = () => {
    if (selected.length === sortedShows.length) {
      deselectAll();
    } else {
      selectAll();
    }
  };

  const handleSort = (key: keyof Show) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleLetterClick = (letter: string) => {
    setActiveLetter(letter);
    const ref = letterRefs.current[letter];
    if (ref) {
      ref.focus();
      ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, showId: number, index: number) => {
    switch (e.key) {
      case 'Enter':
      case ' ': {
        e.preventDefault();
        handleSelect(showId, e.nativeEvent as unknown as React.MouseEvent);
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        const nextRow = tableRef.current?.querySelector(
          `tr[data-index="${index + 1}"]`,
        ) as HTMLTableRowElement;
        if (nextRow) {
          nextRow.focus();
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prevRow = tableRef.current?.querySelector(
          `tr[data-index="${index - 1}"]`,
        ) as HTMLTableRowElement;
        if (prevRow) {
          prevRow.focus();
        }
        break;
      }
      case 'Home': {
        e.preventDefault();
        const firstRow = tableRef.current?.querySelector(
          'tr[data-index="0"]',
        ) as HTMLTableRowElement;
        if (firstRow) {
          firstRow.focus();
        }
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastRow = tableRef.current?.querySelector(
          `tr[data-index="${sortedShows.length - 1}"]`,
        ) as HTMLTableRowElement;
        if (lastRow) {
          lastRow.focus();
        }
        break;
      }
    }
  };

  const handleTableKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSelectAll();
    }
  };

  const handleDelete = async () => {
    try {
      const result = await apiClient.deleteShows(selected);
      toast({ type: 'success', message: `${result.deleted} shows deleted` });
      handleSelectAll();
      fetchShows();
    } catch {
      toast({ type: 'error', message: 'Failed to delete shows' });
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6">
        {shows.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Shows Table */}
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              <table
                ref={tableRef}
                className="min-w-full divide-y divide-gray-700"
                onKeyDown={handleTableKeyDown}
                role="grid"
                aria-label="Shows list"
              >
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 w-12 text-center align-middle">
                      <input
                        type="checkbox"
                        checked={selected.length === sortedShows.length}
                        onChange={handleSelectAll}
                        aria-label="Select all shows"
                        className="align-middle focus:ring-2 focus:ring-blue-500 \
                          focus:ring-offset-2 focus:ring-offset-gray-700"
                      />
                    </th>
                    <th
                      className="px-4 py-2 text-left text-xs font-medium text-gray-300 \
                        uppercase tracking-wider cursor-pointer hover:bg-gray-600 \
                        focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 \
                        focus:ring-offset-2 focus:ring-offset-gray-700"
                      onClick={() => handleSort('title')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSort('title');
                        }
                      }}
                      tabIndex={0}
                      role="columnheader"
                      aria-sort={
                        sortKey === 'title'
                          ? (sortDirection === 'asc' ? 'ascending' : 'descending')
                          : 'none'
                      }
                    >
                      Title {sortKey === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-4 py-2 text-left text-xs font-medium text-gray-300 \
                        uppercase tracking-wider cursor-pointer hover:bg-gray-600 \
                        focus:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 \
                        focus:ring-offset-2 focus:ring-offset-gray-700"
                      onClick={() => handleSort('path')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSort('path');
                        }
                      }}
                      tabIndex={0}
                      role="columnheader"
                      aria-sort={
                        sortKey === 'path'
                          ? (sortDirection === 'asc' ? 'ascending' : 'descending')
                          : 'none'
                      }
                    >
                      Path {sortKey === 'path' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {sortedShows.map((show, idx) => (
                    <tr
                      key={show.id}
                      ref={(el) => {
                        const letter = getDisplayLetter(show.title);
                        if (firstIndexForLetter[letter] === idx) {
                          letterRefs.current[letter] = el;
                        }
                      }}
                      data-index={idx}
                      className="hover:bg-gray-700 focus-within:bg-gray-700 \
                        transition-all duration-200 focus:outline-none \
                        focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 \
                        focus:ring-offset-gray-800"
                      tabIndex={0}
                      role="row"
                      aria-selected={selected.includes(show.id)}
                      onKeyDown={(e) => handleKeyDown(e, show.id, idx)}
                    >
                      <td className="w-12 text-center">
                        <div className="px-3 py-1.5 flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isSelected(show.id)}
                            onChange={(e) => handleSelect(show.id, e)}
                            onKeyDown={(e) => handleKeyDown(e, show.id, idx)}
                            className="rounded border-gray-300 text-blue-600 \
                              focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 \
                              focus:ring-offset-gray-800"
                          />
                        </div>
                      </td>
                      <td
                        className="px-4 py-1.5 whitespace-nowrap cursor-pointer"
                        role="cell"
                        onClick={(e) => handleSelect(show.id, e as React.MouseEvent)}
                      >
                        {show.title}
                      </td>
                      <td
                        className="px-4 py-1.5 whitespace-nowrap cursor-pointer"
                        role="cell"
                        onClick={(e) => handleSelect(show.id, e as React.MouseEvent)}
                      >
                        {show.path}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fixed bottom bar for deletion */}
            {selected.length > 0 && (
              <div
                className="fixed bottom-0 left-0 w-full bg-gray-900 border-t \
                  border-gray-700 flex justify-end items-center p-4 z-50"
                style={{ boxShadow: '0 -2px 8px rgba(0,0,0,0.3)' }}
                role="status"
                aria-live="polite"
              >
                <span className="text-gray-300 mr-4">{selected.length} series selected</span>
                <button
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-8 \
                    rounded shadow text-lg transition-all duration-200 \
                    focus:outline-none focus:ring-2 focus:ring-red-500 \
                    focus:ring-offset-2 focus:ring-offset-gray-900"
                  aria-label={`Delete ${selected.length} selected shows`}
                >
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {shows.length > 0 && (
        <AlphabetSidebar
          letters={availableLetters}
          activeLetter={activeLetter}
          onLetterClick={handleLetterClick}
        />
      )}
    </div>
  );
}

export default HomePage;
