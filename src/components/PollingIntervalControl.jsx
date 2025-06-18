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

const PollingIntervalControl = ({ disabled = false, onValueChange, hideHeader = false }) => {
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

  const handleKeyDown = (e, optionValue) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleChange(optionValue);
    }
  };

  const handleClick = (optionValue) => {
    if (disabled) {
      handleDisabledClick();
    } else {
      handleChange(optionValue);
    }
  };

  return (
    <div className="flex flex-col w-full relative">
      <div className="w-full flex flex-col gap-2" role="radiogroup" aria-label="Import refresh interval options">
        {INTERVAL_OPTIONS.map((opt) => (
          <div
            key={opt.value}
            className={`flex items-center transition-all duration-200 cursor-pointer ${
              currentInterval === opt.value
                ? 'text-blue-200'
                : 'text-gray-400 hover:text-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleClick(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, opt.value)}
            role="radio"
            aria-checked={currentInterval === opt.value}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            aria-label={`${opt.label} refresh interval`}
          >
            <div 
              className={`w-4 h-4 rounded-full border-2 mr-3 flex-shrink-0 transition-all duration-200 ${
                currentInterval === opt.value 
                  ? 'border-blue-400 bg-blue-400 ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-800' 
                  : 'border-gray-500 hover:border-gray-400'
              }`}
              aria-hidden="true"
            >
              {currentInterval === opt.value && (
                <div className="w-1.5 h-1.5 rounded-full bg-gray-900 m-auto" />
              )}
            </div>
            <span className="font-medium">{opt.label}</span>
          </div>
        ))}
      </div>
      {error && (
        <div 
          className="mt-2 p-2 bg-red-100 text-red-800 rounded text-xs text-center w-full"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default PollingIntervalControl;
