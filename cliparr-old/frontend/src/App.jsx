import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import LogFiles from './pages/LogFiles';
import AlphabetSidebar from './components/AlphabetSidebar';
import { ToastProvider } from './components/ToastProvider';
import { Spin } from 'antd';
import {
  AppstoreOutlined,
  DownloadOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  SettingOutlined,
  DesktopOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import ImportModal from './components/ImportModal';
import './App.css';
import './style.css';
import ShowDetails from './pages/ShowDetails';
import Settings from './pages/Settings';
import { io } from 'socket.io-client';
import { testWebSocketConnection, diagnoseWebSocketIssues } from './utils/websocket-debug';

const navItems = [
  { label: 'Series', path: '/', icon: <AppstoreOutlined /> },
  { label: 'Import Shows', action: 'import', icon: <DownloadOutlined /> },
  { label: 'Activity', path: '/activity', icon: <ClockCircleOutlined /> },
  { label: 'Wanted', path: '/wanted', icon: <WarningOutlined /> },
  {
    label: 'Settings',
    icon: <SettingOutlined />,
    branch: '/settings',
    subItems: [
      { label: 'General', path: '/settings' },
    ],
  },
  {
    label: 'System',
    icon: <DesktopOutlined />,
    branch: '/system',
    subItems: [
      { label: 'Log Files', path: '/system/logs' },
    ],
  },
];

function Sidebar({ onImportClick, openImportModal }) {
  const location = useLocation();
  const [openBranch, setOpenBranch] = useState('');

  const isActive = (path) => {
    if (path === '/') {
      // Highlight Series for both / and /series/:id
      return location.pathname === '/' || location.pathname.startsWith('/series/');
    }
    return location.pathname === path;
  };
  const isBranchActive = (branch) => location.pathname.startsWith(branch);

  // Determine which main item/branch is currently selected
  let selectedMain = null;
  navItems.forEach((item) => {
    if (item.subItems && item.subItems.length > 0) {
      if (isBranchActive(item.branch)) selectedMain = item.label;
    } else if (isActive(item.path)) {
      selectedMain = item.label;
    }
  });

  return (
    <div style={{ width: 200, background: '#23272b', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20, borderRight: '1px solid #222' }}>
      <div style={{ fontWeight: 'bold', fontSize: 24, marginBottom: 24 }}>Logo</div>
      <div style={{ width: '100%' }}>
        {navItems.map((item) => {
          if (item.subItems && item.subItems.length > 0) {
            const branch = item.branch;
            const branchActive = isBranchActive(branch);
            const subActive = item.subItems.some((sub) => isActive(sub.path));
            // Blue bar for the main branch if it or any of its subitems is active
            const showBar = selectedMain === item.label;
            // Highlight only the selected subitem, or the main branch if no subitem is selected
            let highlightMain = false;
            if (!subActive && branchActive) highlightMain = true;
            return (
              <div key={item.label} style={{ position: 'relative' }}>
                <div
                  style={{
                    padding: '10px 20px',
                    cursor: 'pointer',
                    background: highlightMain ? '#181c20' : '#23272b',
                    fontWeight: highlightMain ? 700 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    borderLeft: showBar ? '4px solid #00bfff' : '4px solid transparent',
                    color: highlightMain ? '#00bfff' : '#fff',
                    height: 40,
                    transition: 'background 0.2s, color 0.2s, height 0.2s',
                  }}
                  onClick={() => setOpenBranch(openBranch === branch ? '' : branch)}
                >
                  <span style={{ marginRight: 10, fontSize: 18 }}>{item.icon}</span> {item.label}
                </div>
                {openBranch === branch && (
                  <div style={{ marginLeft: 18 }}>
                    {item.subItems.map((sub) => (
                      <SidebarLink
                        key={sub.label}
                        to={sub.path}
                        active={isActive(sub.path)}
                        label={sub.label}
                        isSubItem
                        onClick={() => setOpenBranch(branch)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }
          if (item.action === 'import') {
            return (
              <div
                key={item.label}
                style={{
                  padding: '10px 20px',
                  cursor: 'pointer',
                  background: '#23272b',
                  display: 'flex',
                  alignItems: 'center',
                  height: 40,
                }}
                onClick={() => openImportModal()}
              >
                <span style={{ marginRight: 10, fontSize: 18 }}>{item.icon}</span> {item.label}
              </div>
            );
          }
          // Main item highlight if active
          const mainActive = selectedMain === item.label;
          return (
            <SidebarLink
              key={item.label}
              to={item.path}
              active={mainActive}
              label={item.label}
              icon={item.icon}
              onClick={() => setOpenBranch('')}
              showBar={mainActive}
            />
          );
        })}
      </div>
    </div>
  );
}

function SidebarLink({ to, active, label, icon, isSubItem, onClick, showBar }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => { navigate(to); if (onClick) onClick(); }}
      style={{
        padding: isSubItem ? '8px 0 8px 18px' : '10px 20px',
        cursor: 'pointer',
        background: active ? '#181c20' : 'transparent',
        fontWeight: active ? 700 : 400,
        borderLeft: showBar ? '4px solid #00bfff' : isSubItem ? '4px solid transparent' : '4px solid transparent',
        color: active ? '#00bfff' : '#fff',
        transition: 'background 0.2s, color 0.2s',
        height: 36,
        display: 'flex',
        alignItems: 'center',
        marginLeft: isSubItem ? 0 : undefined,
      }}
    >
      {!isSubItem && icon && <span style={{ marginRight: 10, fontSize: 18 }}>{icon}</span>}
      {label}
    </div>
  );
}

function MainApp({ importedShows, setImportedShowsLoaded, openImportModal }) {
  const [activeLetter, setActiveLetter] = useState(null);
  const homeRef = useRef();
  const location = useLocation();

  // Compute available letters from importedShows
  const availableLetters = React.useMemo(() => {
    const alphabet = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
    const showLetters = new Set();
    importedShows.forEach(show => {
      const first = (show.title || '').charAt(0).toUpperCase();
      if (/^[A-Z]$/.test(first)) showLetters.add(first);
      else showLetters.add('#');
    });
    // Only include letters that have at least one show
    return alphabet.filter(l => showLetters.has(l));
  }, [importedShows]);

  const handleLetterClick = (letter) => {
    setActiveLetter(letter);
    if (homeRef.current && homeRef.current.scrollToLetter) {
      homeRef.current.scrollToLetter(letter);
    }
  };

  const handleImportClick = () => {
    if (homeRef.current && homeRef.current.openImportModal) {
      homeRef.current.openImportModal();
    }
  };

  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'row',
      overflow: 'hidden',
      height: '100%',
    }}>
      <Sidebar onImportClick={handleImportClick} openImportModal={openImportModal} />
      <div style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        height: '100%',
      }}>
        <div style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          height: '100%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'row',
        }}>
          <div style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          }}>
            <Routes>
              <Route path="/" element={<Home ref={homeRef} importedShows={importedShows} setImportedShowsLoaded={setImportedShowsLoaded} AlphabetSidebarComponent={
                <AlphabetSidebar onLetterClick={handleLetterClick} activeLetter={activeLetter} letters={availableLetters} />
              } />} />
              <Route path="/system/logs" element={<LogFiles />} />
              <Route path="/series/:id" element={<ShowDetails />} />
              <Route path="/settings" element={<Settings />} />
              {/* Add more routes as needed */}
            </Routes>
          </div>
          {location.pathname === '/' && false /* Remove old sidebar wrapper */}
        </div>
      </div>
    </div>
  );
}

function createSocket() {
  const socket = io({
    path: '/socket.io',
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 3,  // Reduced reconnection attempts
    reconnectionDelay: 1000,
    timeout: 5000
  });

  socket.on('connect', () => {
    console.log('WebSocket connected');
    setSocketError(null);
  });

  socket.on('connection_status', (data) => {
    console.log('WebSocket connection status:', data);
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
    setSocketError(`WebSocket connection failed: ${error.message}`);
  });

  socket.on('disconnect', (reason) => {
    console.log('WebSocket disconnected:', reason);
    if (reason === 'io server disconnect') {
      // Reconnect manually
      socket.connect();
    }
  });

  return socket;
}

// Memoize complex components to reduce unnecessary re-renders
const MemoizedSidebar = memo(Sidebar);
const MemoizedMainApp = memo(MainApp);

// Performance tracking decorator
function withPerformanceTracking(WrappedComponent, componentName) {
  return function TrackedComponent(props) {
    const startTime = performance.now();
    const result = <WrappedComponent {...props} />;
    const endTime = performance.now();
    
    // Log render time only in development
    if (import.meta.env.DEV) {
      console.log(`Render time for ${componentName}: ${endTime - startTime}ms`);
    }
    
    return result;
  };
}

// Apply performance tracking to key components
const PerformanceSidebar = withPerformanceTracking(MemoizedSidebar, 'Sidebar');
const PerformanceMainApp = withPerformanceTracking(MemoizedMainApp, 'MainApp');

// Add performance monitoring for fetch operations
const measureFetchPerformance = async (fetchFn, label) => {
  const startTime = performance.now();
  try {
    const result = await fetchFn();
    const endTime = performance.now();
    console.log(`Fetch performance for ${label}: ${endTime - startTime}ms`);
    return result;
  } catch (error) {
    console.error(`Fetch error for ${label}:`, error);
    throw error;
  }
};

function App() {
  const [loading, setLoading] = useState(true);
  const [importedShows, setImportedShows] = useState([]);
  const [importedShowsLoaded, setImportedShowsLoaded] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [modalShows, setModalShows] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [socketError, setSocketError] = useState(null);
  const [totalShows, setTotalShows] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [error, setError] = useState(null);
  
  // Use ref to store socket to prevent re-renders
  const socketRef = useRef(null);

  // Memoized socket connection
  useEffect(() => {
    // Diagnose WebSocket issues
    const runDiagnostics = async () => {
      try {
        const diagnosticResults = await diagnoseWebSocketIssues();
        console.log('WebSocket Diagnostic Results:', diagnosticResults);
        
        // Handle specific diagnostic scenarios
        if (diagnosticResults.error) {
          setSocketError(`WebSocket Diagnostic Error: ${diagnosticResults.error}`);
        }
      } catch (error) {
        console.error('WebSocket Diagnostics Failed:', error);
        setSocketError(`WebSocket Diagnostics Failed: ${error.message}`);
      }
    };

    runDiagnostics();

    // Attempt WebSocket connection test
    testWebSocketConnection()
      .catch(error => {
        console.error('WebSocket connection test failed:', error);
        setSocketError(error.message);
      });

    // Create socket only once
    socketRef.current = createSocket();

    // Efficient event handling
    const handleShowImported = () => {
      setImportedShowsLoaded(false);
    };

    socketRef.current.on('show_imported', handleShowImported);

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.off('show_imported', handleShowImported);
        socketRef.current.disconnect();
      }
    };
  }, []); // Empty dependency array ensures this runs only once

  // Memoize fetch logic to prevent unnecessary re-renders
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const startTime = performance.now();
      
      // Enhanced fetch with more detailed error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout
      
      const response = await fetch('/api/imported-shows', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Log full response details
      console.group('API Response Details');
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      console.log('Response type:', response.type);
      console.log('Response URL:', response.url);
      console.groupEnd();

      // Handle non-200 responses
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Non-OK response:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      // Log full response for debugging
      const responseText = await response.text();
      console.log('Raw API response:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', {
          parseError,
          rawResponse: responseText
        });
        throw new Error('Invalid JSON response');
      }

      // Comprehensive error checking
      if (data.error) {
        console.error('API returned an error:', data.error);
        setError(data.error);
        setImportedShows([]);
        return;
      }

      // Validate response structure with detailed logging
      const requiredKeys = ['shows', 'total', 'page', 'page_size', 'total_pages'];
      const missingKeys = requiredKeys.filter(key => !(key in data));
      
      if (missingKeys.length > 0) {
        console.error('Invalid response structure:', {
          data,
          missingKeys
        });
        
        setError(`Unexpected response format. Missing keys: ${missingKeys.join(', ')}`);
        setImportedShows([]);
        return;
      }

      // Validate shows array
      if (!Array.isArray(data.shows)) {
        console.error('Shows is not an array:', {
          shows: data.shows,
          showsType: typeof data.shows
        });
        
        setError('Unexpected shows format');
        setImportedShows([]);
        return;
      }

      // Log performance
      const endTime = performance.now();
      console.log(`Fetch performance:`, {
        duration: `${endTime - startTime}ms`,
        showCount: data.shows.length,
        totalShows: data.total
      });

      // Update state with the new response structure
      setImportedShows(data.shows);
      setTotalShows(data.total);
      setCurrentPage(data.page);
      setPageSize(data.page_size);
      
      setImportedShowsLoaded(true);
      setLoading(false);
      setError(null);  // Clear any previous errors
    } catch (error) {
      console.error('Error fetching imported shows:', {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack
      });
      
      setLoading(false);
      
      // Detailed error handling
      if (error.name === 'AbortError') {
        setError('Request timed out. Please check your network connection.');
      } else if (error.name === 'TypeError') {
        setError('Network error. Unable to connect to the server.');
      } else {
        setError(error.message || 'Failed to fetch shows');
      }
      
      setImportedShows([]);
    }
  }, []);

  // Use effect for fetching shows
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Memoize import modal logic
  const openImportModal = useCallback(() => {
    setShowImportModal(true);
    setModalLoading(true);
    setModalError('');
    fetch('/api/sonarr/unimported')
      .then(res => res.json())
      .then(data => {
        setModalShows(data);
        setModalLoading(false);
      })
      .catch(() => {
        setModalError('Failed to load shows from Sonarr.');
        setModalLoading(false);
      });
  }, []);

  // Memoize import handling
  const handleImport = useCallback(async (selectedIds) => {
    setImporting(true);
    setImportMessage('Importing...');
    try {
      const res = await fetch('/api/sonarr/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showIds: selectedIds })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.importedShows && data.importedShows.length > 0) {
          const importedShowTitles = data.importedShows.map(show => 
            `${show.title} (${show.episodesImported} episodes)`
          ).join(', ');
          setImportMessage(`Successfully imported ${data.importedCount} shows: ${importedShowTitles}`);
        } else {
          setImportMessage(`Successfully imported ${data.importedCount} shows.`);
        }
        setImportedShowsLoaded(false); // refetch imported shows
        setShowImportModal(false);
      } else {
        setImportMessage(data.error || 'Import failed.');
      }
    } catch (e) {
      setImportMessage('Import failed.');
    }
    setImporting(false);
  }, []);

  // Render loading state with enhanced error display
  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: '#181818', zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <img src="/vite.svg" alt="Logo" style={{ width: 80, marginBottom: 24 }} />
        <div style={{ fontSize: 32, marginBottom: 16 }}>Loading...</div>
        {(socketError || error) && (
          <div style={{ 
            color: 'red', 
            marginTop: 16, 
            padding: 16, 
            background: 'rgba(255,0,0,0.1)', 
            borderRadius: 8,
            maxWidth: '80%',
            wordWrap: 'break-word'
          }}>
            {socketError && <div>WebSocket Connection Error: {socketError}</div>}
            {error && <div>API Error: {error}</div>}
          </div>
        )}
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <Router>
        <ImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
          shows={modalShows}
          loading={modalLoading || importing}
          error={modalError || importMessage}
        />
        <PerformanceMainApp
          importedShows={importedShows}
          setImportedShowsLoaded={setImportedShowsLoaded}
          openImportModal={openImportModal}
        />
      </Router>
    </ToastProvider>
  );
}

export default App;
