import React, { useState, useEffect } from 'react';
import { apiClient } from '../integration/api-client';
import { useToast } from './ToastContext';

const INTERVAL_OPTIONS = [
  { label: '15 minutes', value: 900 },
  { label: '30 minutes', value: 1800 },
  { label: '1 hour', value: 3600 },
  { label: '12 hours', value: 43200 },
  { label: '24 hours', value: 86400 },
];

const PollingIntervalControl = () => {
  const [currentInterval, setCurrentInterval] = useState(900);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  // Fetch current interval on mount
  useEffect(() => {
    const fetchInterval = async () => {
      try {
        const data = await apiClient.getPollingInterval();
        setCurrentInterval(Number(data.interval));
      } catch (err) {
        setError(err.message);
      }
    };
    fetchInterval();
  }, []);

  const handleChange = async (event) => {
    const newValue = Number(event.target.value);
    if (newValue === currentInterval) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.setPollingInterval(newValue);
      setCurrentInterval(Number(data.interval));
      toast({
        type: 'success',
        message: 'Interval updated successfully',
      });
    } catch (err) {
      setError(err.message);
      toast({
        type: 'error',
        message: 'Failed to update interval',
      });
    } finally {
      setLoading(false);
    }
  };

  const currentLabel = INTERVAL_OPTIONS.find(opt => opt.value === currentInterval)?.label || '';

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <label htmlFor="interval-select" className="font-semibold mb-2 text-lg text-center">Import Refresh Interval</label>
      <select
        id="interval-select"
        value={currentInterval}
        onChange={handleChange}
        disabled={loading}
        className="text-sm px-3 py-2 rounded-md border border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition w-48 bg-gray-800 text-gray-100 placeholder-gray-400 text-center"
      >
        {INTERVAL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <div className="mt-2 p-2 bg-red-100 text-red-800 rounded text-xs text-center w-full max-w-xs">
          {error}
        </div>
      )}
    </div>
  );
};

export default PollingIntervalControl;
