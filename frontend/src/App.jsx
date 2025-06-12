import React, { useState, useRef, useEffect } from 'react';
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

const navItems = [
  { label: 'Series', path: '/', icon: <AppstoreOutlined /> },
  { label: 'Import Shows', action: 'import', icon: <DownloadOutlined /> },
  { label: 'Activity', path: '/activity', icon: <ClockCircleOutlined /> },
  { label: 'Wanted', path: '/wanted', icon: <WarningOutlined /> },
  {
    label: 'Settings',
    icon: <SettingOutlined />,
    branch: '/settings',
    subItems: [],
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
              {/* Add more routes as needed */}
            </Routes>
          </div>
          {location.pathname === '/' && false /* Remove old sidebar wrapper */}
        </div>
      </div>
    </div>
  );
}

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

  useEffect(() => {
    if (!importedShowsLoaded) {
      fetch('/api/imported-shows')
        .then(res => res.json())
        .then(data => {
          setImportedShows(data);
          setImportedShowsLoaded(true);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [importedShowsLoaded]);

  // Global import modal logic
  const openImportModal = () => {
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
  };

  const handleImport = async (selectedIds) => {
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
        setImportMessage(`Successfully imported ${data.importedCount} shows.`);
        setImportedShowsLoaded(false); // refetch imported shows
        setShowImportModal(false);
      } else {
        setImportMessage(data.error || 'Import failed.');
      }
    } catch (e) {
      setImportMessage('Import failed.');
    }
    setImporting(false);
  };

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
        <MainApp
          importedShows={importedShows}
          setImportedShowsLoaded={setImportedShowsLoaded}
          openImportModal={openImportModal}
        />
      </Router>
    </ToastProvider>
  );
}

export default App;
