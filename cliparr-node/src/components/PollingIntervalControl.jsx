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

const PollingIntervalControl = ({ disabled = false }) => {
  const [currentInterval, setCurrentInterval] = useState(900);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDisabledMsg, setShowDisabledMsg] = useState(false);
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

  const handleDisabledClick = () => {
    if (disabled) {
      setShowDisabledMsg(true);
      setTimeout(() => setShowDisabledMsg(false), 2000);
    }
  };

  const currentLabel = INTERVAL_OPTIONS.find((opt) => opt.value === currentInterval)?.label || '';

  return (
    <div className="flex flex-col items-center justify-center w-full relative">
      <label htmlFor="interval-select" className="font-semibold mb-2 text-lg text-center">Import Refresh Interval</label>
      <p className={`text-sm mb-4 text-center ${disabled ? 'text-gray-600' : 'text-gray-400'}`} style={{ minHeight: 40 }}>
        Defines how often Cliparr checks for new shows to import.
      </p>
      <div className="relative w-full flex justify-center">
        <select
          id="interval-select"
          value={currentInterval}
          onChange={handleChange}
          disabled={loading || disabled}
          className="text-sm px-3 py-2 rounded-md border border-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition w-48 bg-gray-800 text-gray-100 placeholder-gray-400 text-center"
          onClick={handleDisabledClick}
        >
          {INTERVAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {showDisabledMsg && (
          <div className="absolute left-1/2 -translate-x-1/2 top-14 bg-gray-900 text-yellow-300 px-4 py-2 rounded shadow text-xs z-10 border border-yellow-400">
            Disabled: Set Import Mode to Auto or Import to enable
          </div>
        )}
      </div>
      {error && (
        <div className="mt-2 p-2 bg-red-100 text-red-800 rounded text-xs text-center w-full max-w-xs">
          {error}
        </div>
      )}
    </div>
  );
};

export default PollingIntervalControl;
