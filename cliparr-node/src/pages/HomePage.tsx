import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../integration/api-client';
import SonarrTest from '../components/SonarrTest';
import ImportModeTest from '../components/ImportModeTest';
import { logger } from '../services/logger.frontend.js';
import { wsClient } from '../services/websocket.frontend.js';

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [healthCheckMsg, setHealthCheckMsg] = useState<string | null>(null);

  useEffect(() => {
    // Set up WebSocket event listeners
    const handleConnection = (data: { status: string }) => {
      setWsStatus(data.status);
      if (data.status === 'error') {
        setError('WebSocket connection failed');
      } else {
        setError(null);
      }
    };

    const handleError = () => {
      setWsStatus('error');
      setError('WebSocket connection failed');
    };

    // Add event listeners
    wsClient.addEventListener('connection', handleConnection);
    wsClient.addEventListener('error', handleError);

    // Cleanup
    return () => {
      wsClient.removeEventListener('connection', handleConnection);
      wsClient.removeEventListener('error', handleError);
    };
  }, []);

  const testDatabase = useCallback(async () => {
    try {
      const data = await apiClient.testDatabase();
      setDbStatus(data);
      if (!data.success) {
        setError('Database test failed');
      }
    } catch {
      setDbStatus({ success: false, message: 'Database test failed' });
      setError('Failed to check database status');
    }
  }, []);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setHealthCheckMsg(null);
    try {
      const data = await apiClient.checkHealth();
      setHealth(data.status);
      if (data.status === 'healthy') {
        wsClient.connect();
        testDatabase();
        setHealthCheckMsg('✅ Server health check successful!');
        logger.info('Health check result:', data);
      } else {
        setHealthCheckMsg('❌ Server health check failed.');
        logger.error('Health check failed:', data);
      }
    } catch (err) {
      setHealth('error');
      setHealthCheckMsg('❌ Failed to connect to server.');
      logger.error('Health check error:', err);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, [testDatabase]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* TEST: Tailwind color check */}
      <div className="bg-pink-600 text-white text-center py-4 text-2xl font-bold">
        If you see a pink bar, Tailwind is working!
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Cliparr</h1>
          <p className="text-xl text-gray-600 mb-8">
            Media Management System
          </p>
        </div>
        {/* System Status Card */}
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${
              health === 'healthy' ? 'bg-green-500' :
                health === 'unhealthy' ? 'bg-red-500' :
                  'bg-yellow-500'
            }`} />
            <span className="text-lg font-medium">
              {health === 'healthy' ? 'System Healthy' :
                health === 'unhealthy' ? 'System Unhealthy' :
                  'Checking System Status...'}
            </span>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>
        <div className="relative py-3 sm:max-w-xl sm:mx-auto">
          <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
            <div className="max-w-md mx-auto">
              <div className="divide-y divide-gray-200">
                <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                  <h1 className="text-3xl font-bold text-center mb-8">Cliparr</h1>
                  <p className="text-center text-gray-600 mb-8">
                    Welcome to Cliparr - a placeholder page to verify the server is running
                    correctly.
                  </p>
                  {/* Health Check Button */}
                  <div className="flex flex-col items-center mb-4">
                    <button
                      onClick={checkHealth}
                      disabled={isLoading}
                      className={
                        'px-4 py-2 rounded-md text-white font-medium ' +
                        (isLoading
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600')
                      }
                    >
                      {isLoading ? 'Checking...' : 'Check Server Health'}
                    </button>
                    {healthCheckMsg && (
                      <div
                        className={`mt-2 text-sm font-semibold ${
                          healthCheckMsg.startsWith('✅')
                            ? 'text-green-700'
                            : 'text-red-700'
                        }`}
                      >
                        {healthCheckMsg}
                      </div>
                    )}
                  </div>
                  {/* Status blocks */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold">Health Status:</span>
                      <span
                        className={`px-2 py-1 rounded ${
                          health === 'healthy'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {health}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold">WebSocket Status:</span>
                      <span
                        className={`px-2 py-1 rounded ${
                          wsStatus === 'connected'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {wsStatus}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold">Database Status:</span>
                      <span
                        className={`px-2 py-1 rounded ${
                          dbStatus?.success
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {dbStatus ? (dbStatus.success ? 'Connected' : 'Error') : 'Checking...'}
                      </span>
                    </div>
                    {dbStatus?.testValue && (
                      <div className="mt-2 text-sm text-gray-600">
                        Test Value: {dbStatus.testValue}
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
                  <SonarrTest backendReady={health === 'healthy'} />
                  {/* Add Import Mode Test Component */}
                  <ImportModeTest />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
