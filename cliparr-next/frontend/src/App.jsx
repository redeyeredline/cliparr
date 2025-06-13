import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Spin, message } from 'antd';
import { HomeOutlined, SettingOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { ToastProvider } from './components/ToastProvider';
import ImportModal from './components/ImportModal';
import AlphabetSidebar from './components/AlphabetSidebar';
import Home from './pages/Home';
import ShowDetails from './pages/ShowDetails';
import LogFiles from './pages/LogFiles';
import Settings from './pages/Settings';
import './App.css';
import './style.css';

const { Header, Sider, Content } = Layout;

const navItems = [
  { label: 'Series', path: '/', icon: <HomeOutlined /> },
  { label: 'Import Shows', action: 'import', icon: <PlusOutlined /> },
  { label: 'Logs', path: '/logs', icon: <FileTextOutlined /> },
  { label: 'Settings', path: '/settings', icon: <SettingOutlined /> }
];

function SidebarLink({ to, active, label, icon, onClick }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => { navigate(to); if (onClick) onClick(); }}
      style={{
        padding: '10px 20px',
        cursor: 'pointer',
        background: active ? '#23272b' : 'transparent',
        fontWeight: active ? 700 : 400,
        borderLeft: active ? '4px solid #00bfff' : '4px solid transparent',
        color: active ? '#00bfff' : '#fff',
        transition: 'background 0.2s, color 0.2s',
        height: 40,
        display: 'flex',
        alignItems: 'center'
      }}
    >
      {icon && <span style={{ marginRight: 10, fontSize: 18 }}>{icon}</span>}
      {label}
    </div>
  );
}

function Sidebar({ onImportClick }) {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/show/');
    }
    return location.pathname === path;
  };

  return (
    <div style={{ width: 200, background: '#181818', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20, borderRight: '1px solid #23272b' }}>
      <div style={{ fontWeight: 'bold', fontSize: 24, marginBottom: 24, color: '#00bfff' }}>Cliparr</div>
      <div style={{ width: '100%' }}>
        {navItems.map((item) => {
          if (item.action === 'import') {
            return (
              <div
                key={item.label}
                style={{
                  padding: '10px 20px',
                  cursor: 'pointer',
                  background: '#181818',
                  display: 'flex',
                  alignItems: 'center',
                  height: 40,
                  transition: 'background 0.2s, color 0.2s',
                  ':hover': {
                    background: '#23272b',
                    color: '#00bfff'
                  }
                }}
                onClick={onImportClick}
              >
                <span style={{ marginRight: 10, fontSize: 18 }}>{item.icon}</span> {item.label}
              </div>
            );
          }
          return (
            <SidebarLink
              key={item.label}
              to={item.path}
              active={isActive(item.path)}
              label={item.label}
              icon={item.icon}
            />
          );
        })}
      </div>
    </div>
  );
}

function MainApp() {
  const [importedShows, setImportedShows] = useState([]);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeLetter, setActiveLetter] = useState(null);
  const homeRef = useRef();
  const location = useLocation();

  const availableLetters = useMemo(() => {
    const alphabet = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
    const showLetters = new Set();
    importedShows.forEach(show => {
      const first = (show.title || '').charAt(0).toUpperCase();
      if (/^[A-Z]$/.test(first)) showLetters.add(first);
      else showLetters.add('#');
    });
    return alphabet.filter(l => showLetters.has(l));
  }, [importedShows]);

  const handleLetterClick = useCallback((letter) => {
    setActiveLetter(letter);
    if (homeRef.current) {
      homeRef.current.scrollToLetter(letter);
    }
  }, []);

  const handleImportSuccess = (shows) => {
    setImportedShows(shows);
    message.success('Shows imported successfully');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#181818' }}>
      <Sidebar onImportClick={() => setIsImportModalVisible(true)} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          <Spin spinning={loading}>
            <Routes>
              <Route path="/" element={<Home ref={homeRef} importedShows={importedShows} activeLetter={activeLetter} />} />
              <Route path="/show/:id" element={<ShowDetails />} />
              <Route path="/logs" element={<LogFiles />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Spin>
        </div>
        {location.pathname === '/' && (
          <AlphabetSidebar
            letters={availableLetters}
            activeLetter={activeLetter}
            onLetterClick={handleLetterClick}
          />
        )}
      </div>
      <ImportModal
        visible={isImportModalVisible}
        onClose={() => setIsImportModalVisible(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}

const App = () => {
  return (
    <Router>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </Router>
  );
};

export default App; 