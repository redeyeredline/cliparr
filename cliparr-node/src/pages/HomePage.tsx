import { useState, useEffect } from 'react';
import { apiClient } from '../integration/api-client';
import SonarrTest from '../components/SonarrTest';

interface DbStatus {
  success: boolean;
  message: string;
  testValue?: string;
}

function HomePage() {
  const [health, setHealth] = useState('checking...');
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;

    const checkHealth = async () => {
      try {
        const data = await apiClient.checkHealth();
        setHealth(data.status);
        // Only connect WebSocket if health check passes
        if (data.status === 'healthy') {
          connectWebSocket();
          testDatabase();
        }
      } catch (err) {
        setHealth('error');
        setError('Failed to connect to server');
      }
    };

    const testDatabase = async () => {
      try {
        const data = await apiClient.testDatabase();
        setDbStatus(data);
        if (!data.success) {
          setError('Database test failed');
        }
      } catch (err) {
        setDbStatus({ success: false, message: 'Database test failed' });
        setError('Failed to test database');
      }
    };

    const connectWebSocket = () => {
      try {
        ws = new WebSocket(`ws://${window.location.host}/ws`);

        ws.onopen = () => {
          setWsStatus('connected');
          setError(null);
        };

        ws.onclose = () => {
          setWsStatus('disconnected');
          // Attempt to reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = () => {
          setWsStatus('error');
          setError('WebSocket connection failed');
        };
      } catch (err) {
        setWsStatus('error');
        setError('Failed to create WebSocket connection');
      }
    };

    checkHealth();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h1 className="text-3xl font-bold text-center mb-8">Cliparr</h1>
                <p className="text-center text-gray-600 mb-8">
                  Welcome to asfsadfsafdis is a placeholder page to verify the server is running correctly.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">Health Status:</span>
                    <span className={`px-2 py-1 rounded ${
                      health === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {health}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">WebSocket Status:</span>
                    <span className={`px-2 py-1 rounded ${
                      wsStatus === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {wsStatus}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold">Database Status:</span>
                    <span className={`px-2 py-1 rounded ${
                      dbStatus?.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {dbStatus ? (dbStatus.success ? 'Connected' : 'Error') : 'Checking...'}
                    </span>
                  </div>
                  {dbStatus?.testValue && (
                    <div className="mt-2 text-sm text-gray-600">
                      Test Value: {dbStatus.testValue}
                    </div>
                  )}
                  {error && (
                    <div className="mt-4 p-2 bg-red-100 text-red-800 rounded">
                      {error}
                    </div>
                  )}
                </div>
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-500 text-center">
                    Server is running and ready to accept connections.
                    <br />
                    WebSocket connection will be established automatically.
                  </p>
                </div>

                {/* Add Sonarr Test Component */}
                <SonarrTest />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
