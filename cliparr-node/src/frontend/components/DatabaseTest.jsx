import React, { useState } from 'react';
import axios from 'axios';

const DatabaseTest = () => {
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/db/test');
      setTestResult(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to test database operations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Database Operations Test</h2>
      
      <button
        onClick={runTest}
        disabled={loading}
        className={`px-4 py-2 rounded ${
          loading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {loading ? 'Testing...' : 'Test Database Operations'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          <h3 className="font-bold">Error</h3>
          <p>{error}</p>
        </div>
      )}

      {testResult && (
        <div className="mt-4">
          <div className="p-4 bg-green-100 text-green-700 rounded">
            <h3 className="font-bold">Success!</h3>
            <p>{testResult.message}</p>
          </div>
          
          <div className="mt-4">
            <h3 className="font-bold">Test Data:</h3>
            <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto">
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseTest; 