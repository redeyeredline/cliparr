import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { apiClient } from '../integration/api-client';
import { logger } from '../services/logger.frontend.js';
import { wsClient } from '../services/websocket.frontend.js';
import AlphabetSidebar from '../components/AlphabetSidebar';
import { useToast } from '../components/ToastContext';
import EmptyState from '../components/EmptyState.tsx';
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
  const navigate = useNavigate();
  const [health, setHealth] = useState('checking...');
  const [shows, setShows] = useState<Show[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  // Load sort state from localStorage or use defaults
  const [sortKey, setSortKey] = useState<keyof Show>(() => {
    const saved = localStorage.getItem('cliparr-table-sort-key');
    return (saved as keyof Show) || 'title';
  });
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('cliparr-table-sort-direction');
    return (saved as 'asc' | 'desc') || 'asc';
  });

  const toast = useToast();

  // Refs
  const letterRefs = useRef<{ [letter: string]: HTMLTableRowElement | null }>({});
  const healthCheckRef = useRef<boolean>(false);
  const tableRef = useRef<HTMLTableElement>(null);

  // Filter shows based on search query
  const filteredShows = useMemo(() => {
    if (!searchQuery) {
      return shows;
    }
    return shows.filter((show) =>
      show.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      show.path.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [shows, searchQuery]);

  // Get available letters from shows (using sortable titles)
  const availableLetters = useMemo(() => {
    const letters = filteredShows.map((show) => getDisplayLetter(show.title));
    return [...new Set(letters)].sort();
  }, [filteredShows]);

  // Sort shows
  const sortedShows = useMemo(() => {
    const indexed = filteredShows.map((show, index) => ({ show, index }));
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
  }, [filteredShows, sortKey, sortDirection]);

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

  const handleShowClick = (showId: number) => {
    navigate(`/shows/${showId}`);
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
      logger.info('Fetching shows from API...');
      const data = await apiClient.getShows();
      logger.info({ showsCount: data.shows?.length, total: data.total }, 'Received shows data from API');
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

  const handleSelectAll = useCallback(() => {
    if (selected.length === sortedShows.length) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [selected.length, sortedShows.length, deselectAll, selectAll]);

  const handleSort = (key: keyof Show) => {
    if (sortKey === key) {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
      localStorage.setItem('cliparr-table-sort-direction', newDirection);
    } else {
      setSortKey(key);
      setSortDirection('asc');
      localStorage.setItem('cliparr-table-sort-key', key);
      localStorage.setItem('cliparr-table-sort-direction', 'asc');
    }
    handleSelectAll();
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

  const handleDelete = useCallback(async () => {
    try {
      const result = await apiClient.deleteShows(selected);
      toast({ type: 'success', message: `${result.deleted} shows deleted` });
      handleSelectAll();
      fetchShows();
    } catch {
      toast({ type: 'error', message: 'Failed to delete shows' });
    }
  }, [selected, toast, handleSelectAll, fetchShows]);

  // Global Enter key handler for delete
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selected.length > 0) {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement) {
          const tagName = activeElement.tagName.toUpperCase();
          // Prevent delete only when focused on elements where the user can type.
          const isTypingElement =
            (tagName === 'INPUT' && (activeElement as HTMLInputElement).type === 'text') ||
            tagName === 'TEXTAREA' ||
            activeElement.isContentEditable;

          if (!isTypingElement) {
            e.preventDefault();
            handleDelete();
          }
        } else {
          // If no element is focused, allow delete.
          e.preventDefault();
          handleDelete();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selected, handleDelete]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="flex-1 overflow-auto p-6">
        <div className="h-full flex flex-col">

          {/* Search Bar */}
          <div className="mb-5">
            <div className="relative">
              <Search
                className={`
                  absolute left-4 top-1/2 transform -translate-y-1/2
                  text-gray-400 w-5 h-5
                `}
              />
              <input
                type="text"
                placeholder="Search shows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`
                  w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl
                  text-white placeholder-gray-400 focus:outline-none focus:ring-2 
                  focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 
                  backdrop-blur-sm
                `}
              />
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="text-sm text-gray-400">
                <span className="text-white font-medium">{sortedShows.length}</span> shows
                {searchQuery && (
                  <span className="ml-2">
                    (filtered from {shows.length})
                  </span>
                )}
              </div>
              {selected.length > 0 && (
                <div className="text-sm text-blue-400">
                  <span className="font-medium">{selected.length}</span> selected
                </div>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-hidden">
            {shows.length === 0 ? (
              <EmptyState />
            ) : (
              <div
                className={`
                  h-full bg-gray-800/30 backdrop-blur-sm rounded-2xl 
                  border border-gray-700/30 shadow-2xl overflow-hidden
                `}
              >
                <div className="h-full overflow-auto">
                  <table
                    ref={tableRef}
                    className="w-full"
                    role="grid"
                    aria-label="Shows list"
                    onKeyDown={handleTableKeyDown}
                  >
                    <thead
                      className={`
                        sticky top-0 bg-gray-800/80 backdrop-blur-sm 
                        border-b border-gray-700/50
                      `}
                    >
                      <tr>
                        <th className="w-16 px-6 py-1 text-center">
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={
                                selected.length === sortedShows.length &&
                                sortedShows.length > 0
                              }
                              onChange={handleSelectAll}
                              className={`
                                w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded
                                focus:ring-blue-500 focus:ring-2 transition-all duration-200
                              `}
                              aria-label="Select all shows"
                            />
                          </div>
                        </th>
                        <th
                          className={`
                            px-6 py-1 text-left text-sm font-semibold text-gray-300 uppercase 
                            tracking-wider cursor-pointer hover:bg-gray-700/30 
                            transition-all duration-200 group
                          `}
                          onClick={() => handleSort('title')}
                          role="columnheader"
                          aria-sort={
                            sortKey === 'title'
                              ? (sortDirection === 'asc' ? 'ascending' : 'descending')
                              : 'none'
                          }
                        >
                          <div className="flex items-center space-x-2">
                            <span>Title</span>
                            <div className="flex flex-col">
                              <ChevronUp
                                className={`
                                  w-3 h-3 transition-colors duration-200 
                                  ${sortKey === 'title' && sortDirection === 'asc'
                ? 'text-blue-400'
                : 'text-gray-500 group-hover:text-gray-400'}
                                `}
                              />
                              <ChevronDown
                                className={`w-3 h-3 -mt-1 transition-colors duration-200 ${
                                  sortKey === 'title' && sortDirection === 'desc'
                                    ? 'text-blue-400'
                                    : 'text-gray-500 group-hover:text-gray-400'
                                }`}
                              />
                            </div>
                          </div>
                        </th>
                        <th
                          className={`
                            px-6 py-1 text-left text-sm font-semibold text-gray-300 uppercase 
                            tracking-wider cursor-pointer hover:bg-gray-700/30 
                            transition-all duration-200 group
                          `}
                          onClick={() => handleSort('path')}
                          role="columnheader"
                          aria-sort={
                            sortKey === 'path'
                              ? (sortDirection === 'asc' ? 'ascending' : 'descending')
                              : 'none'
                          }
                        >
                          <div className="flex items-center space-x-2">
                            <span>Path</span>
                            <div className="flex flex-col">
                              <ChevronUp
                                className={`w-3 h-3 transition-colors duration-200 ${
                                  sortKey === 'path' && sortDirection === 'asc'
                                    ? 'text-blue-400'
                                    : 'text-gray-500 group-hover:text-gray-400'
                                }`}
                              />
                              <ChevronDown
                                className={`w-3 h-3 -mt-1 transition-colors duration-200 ${
                                  sortKey === 'path' && sortDirection === 'desc'
                                    ? 'text-blue-400'
                                    : 'text-gray-500 group-hover:text-gray-400'
                                }`}
                              />
                            </div>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/30">
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
                          className={`group transition-all duration-200 hover:bg-gray-700/20 ${
                            isSelected(show.id)
                              ? 'bg-blue-500/10 border-l-4 border-blue-500'
                              : ''
                          }`}
                          role="row"
                          aria-selected={isSelected(show.id)}
                          tabIndex={0}
                          onKeyDown={(e) => handleKeyDown(e, show.id, idx)}
                        >
                          <td className="w-16 px-6 py-1 text-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isSelected(show.id)}
                                onChange={(e) => handleSelect(show.id, e)}
                                className={`
                                  w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded
                                  focus:ring-blue-500 focus:ring-2 transition-all duration-200
                                `}
                              />
                            </div>
                          </td>
                          <td className="px-1 py-1 whitespace-nowrap">
                            <div className="flex items-center">
                              <div
                                className={`
                                  w-2 h-8 bg-gradient-to-b from-blue-500 to-purple-600 
                                  rounded-full mr-4 opacity-0 group-hover:opacity-100 
                                  transition-opacity duration-200
                                `}
                              ></div>
                              <button
                                onClick={() => handleShowClick(show.id)}
                                className="text-white text-lg hover:text-blue-400 transition-colors duration-200 cursor-pointer text-left"
                              >
                                {show.title}
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-1 whitespace-nowrap">
                            <div
                              className={`
                                text-gray-300 font-mono text-sm bg-gray-800/50 
                                py-1 rounded-lg inline-block
                              `}
                            >
                              {show.path}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Empty State */}
                  {sortedShows.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                      <div className={`
                        w-16 h-16 bg-gray-700/50 rounded-full flex items-center 
                        justify-center mb-4
                      `}>
                        <Search className="w-8 h-8" />
                      </div>
                      <p className="text-lg font-medium">No shows found</p>
                      <p className="text-sm">Try adjusting your search criteria</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alphabet Sidebar */}
      {sortedShows.length > 0 && (
        <AlphabetSidebar
          letters={availableLetters}
          activeLetter={activeLetter}
          onLetterClick={handleLetterClick}
        />
      )}

      {/* Fixed bottom bar for deletion */}
      {selected.length > 0 && (
        <div
          className={`
            fixed bottom-6 right-6 z-50
          `}
        >
          <div
            className={`
              bg-gray-800/90 backdrop-blur-lg border border-gray-700/50 
              rounded-2xl shadow-2xl p-4 flex items-center space-x-4
            `}
          >
            <div className="flex items-center space-x-2 text-gray-300">
              <Check className="w-5 h-5 text-blue-400" />
              <span className="font-medium">{selected.length} selected</span>
            </div>
            <button
              onClick={handleDelete}
              className={`
                bg-red-500/90 hover:bg-red-500 text-white font-semibold py-2 px-6 rounded-xl
                shadow-lg shadow-red-500/25 transition-all duration-200 hover:shadow-red-500/40
                hover:scale-105 flex items-center space-x-2
              `}
              aria-label={`Delete ${selected.length} selected shows`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
