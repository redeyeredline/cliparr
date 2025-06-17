import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import HealthCheckPage from './pages/HealthCheckPage';
import ToastTest from './pages/ToastTest';
import AlphabetSidebarTest from './pages/AlphabetSidebarTest';
import ImportModalTest from './pages/ImportModalTest';
import SettingsPage from './pages/SettingsPage';
import { ToastProvider } from './components/ToastProvider';

function App() {
  return (
    <Router>
      <ToastProvider>
        <div>
          <nav className="bg-gray-800 p-4">
            <div className="container mx-auto flex space-x-4">
              <Link to="/" className="text-white hover:text-gray-300">
                Home
              </Link>
              <Link to="/health" className="text-white hover:text-gray-300">
                Health Check
              </Link>
              <Link to="/settings" className="text-white hover:text-gray-300">
                Settings
              </Link>
              <Link to="/toast-test" className="text-white hover:text-gray-300">
                Toast Test
              </Link>
              <Link to="/alphabet-test" className="text-white hover:text-gray-300">
                Alphabet Test
              </Link>
              <Link to="/import-test" className="text-white hover:text-gray-300">
                Import Test
              </Link>
            </div>
          </nav>

          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/health" element={<HealthCheckPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/toast-test" element={<ToastTest />} />
            <Route path="/alphabet-test" element={<AlphabetSidebarTest />} />
            <Route path="/import-test" element={<ImportModalTest />} />
          </Routes>
        </div>
      </ToastProvider>
    </Router>
  );
}

export default App;
