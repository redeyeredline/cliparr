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
import './App.css';

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

function Sidebar({ onImportClick }) {
  const location = useLocation();
  const [openBranch, setOpenBranch] = useState('');

  const isActive = (path) => location.pathname === path;
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
                onClick={onImportClick}
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

function MainApp() {
  const [activeLetter, setActiveLetter] = useState(null);
  const homeRef = useRef();
  const location = useLocation();

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
    <div style={{ display: 'flex', height: '100vh', background: '#181818' }}>
      <Sidebar onImportClick={handleImportClick} />
      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Top Bar */}
        <div style={{ height: 56, background: '#23272b', color: '#fff', display: 'flex', alignItems: 'center', padding: '0 32px', borderBottom: '1px solid #222', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ fontWeight: 'bold', fontSize: 20 }}>Search</div>
          {/* Add search input, actions, user menu here */}
        </div>
        {/* Main Page Content */}
        <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Routes>
              <Route path="/" element={<Home ref={homeRef} />} />
              <Route path="/system/logs" element={<LogFiles />} />
              {/* Add more routes as needed */}
            </Routes>
          </div>
          {/* Alphabet Sidebar only on Home */}
          {location.pathname === '/' && (
            <AlphabetSidebar onLetterClick={handleLetterClick} activeLetter={activeLetter} />
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate main app loading (fetch main data)
    fetch('/api/imported-shows')
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, []);

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
        <MainApp />
      </Router>
    </ToastProvider>
  );
}

export default App;
