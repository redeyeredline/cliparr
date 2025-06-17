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

const PollingIntervalControl = ({ disabled = false, onValueChange }) => {
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

  const handleChange = (newValue) => {
    if (newValue === currentInterval || disabled) {
      return;
    }
    setCurrentInterval(newValue);
    onValueChange?.(newValue);
  };

  const handleDisabledClick = () => {
    if (disabled) {
      setShowDisabledMsg(true);
      setTimeout(() => setShowDisabledMsg(false), 2000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full relative">
      <label className="font-semibold mb-2 text-lg text-center">Import Refresh Interval</label>
      <p className={`text-sm mb-4 text-center ${disabled ? 'text-gray-600' : 'text-gray-400'}`} style={{ minHeight: 40 }}>
        Defines how often Cliparr checks for new shows to import.
      </p>
      <div className="relative w-full flex flex-col gap-2">
        {INTERVAL_OPTIONS.map((opt) => (
          <div
            key={opt.value}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              currentInterval === opt.value
                ? 'bg-blue-900 text-blue-200 font-semibold'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleChange(opt.value)}
          >
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                currentInterval === opt.value ? 'border-blue-400 bg-blue-400' : 'border-gray-500'
              }`}>
                {currentInterval === opt.value && <div className="w-2 h-2 rounded-full bg-gray-900 m-auto" />}
              </div>
              <span className="font-medium">{opt.label}</span>
            </div>
          </div>
        ))}
        {showDisabledMsg && (
          <div className="absolute left-1/2 -translate-x-1/2 top-14 bg-gray-900 text-yellow-300 px-4 py-2 rounded shadow text-xs z-20 border border-yellow-400">
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
