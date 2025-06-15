import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import HealthCheckPage from './pages/HealthCheckPage';

function App() {
  return (
    <Router>
      <div>
        <nav className="bg-gray-800 p-4">
          <div className="container mx-auto flex space-x-4">
            <Link to="/" className="text-white hover:text-gray-300">Home</Link>
            <Link to="/health" className="text-white hover:text-gray-300">Health Check</Link>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/health" element={<HealthCheckPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
