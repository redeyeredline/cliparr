import { useState } from 'react';
import { apiClient } from '../integration/api-client';

const HealthCheckPage: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const checkHealth = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.checkHealth();
      setHealthStatus(data.status);
    } catch (err) {
      setError('Failed to check server health');
      setHealthStatus(null);
    } finally {
      setIsLoading(false);
    }
  };
 

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h1 className="text-3xl font-bold text-center mb-8">Server Health Check</h1>

                <div className="flex justify-center mb-8">
                  <button
                    onClick={checkHealth}
                    disabled={isLoading}
                    className={`px-4 py-2 rounded-md text-white font-medium ${
                      isLoading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                  >
                    {isLoading ? 'Checking...' : 'Check Server Health'}
                  </button>
                </div>

                {healthStatus && (
                  <div className="mt-4 p-4 rounded-md bg-green-100 text-green-800">
                    <p className="font-semibold">Server Status:</p>
                    <p>{healthStatus}</p>
                  </div>
                )}

                {error && (
                  <div className="mt-4 p-4 rounded-md bg-red-100 text-red-800">
                    <p className="font-semibold">Error:</p>
                    <p>{error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthCheckPage;
