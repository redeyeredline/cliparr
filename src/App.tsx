// Main React application component that sets up routing and global providers.
// Defines the application structure with navigation and toast/import modal contexts.
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import SystemPage from './pages/SystemPage';
import ShowDetailsPage from './pages/ShowDetailsPage';
import HardwarePage from './pages/Hardware';
import ProcessingPage from './pages/Processing';
import ReviewPage from './pages/Review';
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
              <Route path="/shows/:id" element={<ShowDetailsPage />} />
              <Route path="/hardware" element={<HardwarePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/system" element={<SystemPage />} />
              <Route path="/processing" element={<ProcessingPage />} />
              <Route path="/review" element={<ReviewPage />} />
            </Routes>
          </NavigationBar>
        </ImportModalProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
