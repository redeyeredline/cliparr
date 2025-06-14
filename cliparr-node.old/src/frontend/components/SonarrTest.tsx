import React, { useState } from 'react';
import axios from 'axios';

interface TestData {
  message?: string;
  data?: Record<string, unknown>;
}

const SonarrTest: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'testing' | 'importing' | 'success' | 'error'>(
    'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TestData | null>(null);

  const testConnection = async () => {
    setStatus('testing');
    setError(null);
    try {
      const response = await axios.get('/api/sonarr/test');
      setData(response.data);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Sonarr');
      setStatus('error');
    }
  };

  const importShows = async () => {
    setStatus('importing');
    setError(null);
    try {
      const response = await axios.post('/api/sonarr/import');
      setData(response.data);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import shows');
      setStatus('error');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Sonarr Integration Test</h2>
      <div className="space-y-4">
        <div className="flex space-x-4">
          <button
            onClick={testConnection}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={status === 'testing' || status === 'importing'}
          >
            Test Connection
          </button>
          <button
            onClick={importShows}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            disabled={status === 'testing' || status === 'importing'}
          >
            Import Shows
          </button>
        </div>

        {status !== 'idle' && (
          <div className="mt-4">
            <p className="font-semibold">Status: {status}</p>
            {error && <p className="text-red-500">{error}</p>}
            {data && (
              <pre className="mt-2 p-2 bg-gray-100 rounded">{JSON.stringify(data, null, 2)}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SonarrTest;
