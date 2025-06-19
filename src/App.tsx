import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import NavigationBar from './components/layout/NavigationBar';
import { ToastProvider } from './components/ToastProvider';
import { ImportModalProvider } from './components/ImportModalProvider';

function App() {
  return (
    <Router>
      <ToastProvider>
        <ImportModalProvider>
          <NavigationBar>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </NavigationBar>
        </ImportModalProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
