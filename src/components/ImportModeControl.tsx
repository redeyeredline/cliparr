import React, { useEffect } from 'react';

interface ImportModeControlProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

function ImportModeControl({ value, onValueChange, disabled = false }: ImportModeControlProps) {
  // Descriptions for each mode
  const modeDescriptions: { key: string; label: string; desc: string }[] = [
    {
      key: 'auto',
      label: 'Auto',
      desc: 'Automatically import all shows from Sonarr and schedule audio fingerprinting.',
    },
    {
      key: 'import',
      label: 'Import',
      desc: 'Only schedule fingerprinting for shows you import manually.',
    },
    {
      key: 'none',
      label: 'None',
      desc: 'No automatic imports; you must import shows manually.',
    },
  ];

  useEffect(() => {
    // No-op, just for consistency if you want to add effects later
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent, modeKey: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) {
        onValueChange(modeKey);
      }
    }
  };

  const handleClick = (modeKey: string) => {
    if (!disabled) {
      onValueChange(modeKey);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <label className="font-semibold mb-2 text-lg text-center">Import Mode</label>
      <div className="mb-4 w-full max-w-xs text-sm">
        {modeDescriptions.map((mode) => (
          <div
            key={mode.key}
            className={`mb-2 p-3 rounded-lg transition-all duration-200 cursor-pointer ${
              value === mode.key
                ? 'bg-blue-900 text-blue-200 font-semibold ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-800'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300 focus-within:bg-gray-700 focus-within:text-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleClick(mode.key)}
            onKeyDown={(e) => handleKeyDown(e, mode.key)}
            role="radio"
            aria-checked={value === mode.key}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            aria-label={`${mode.label}: ${mode.desc}`}
          >
            <div className="flex items-start">
              <div 
                className={`w-5 h-5 rounded-full border-2 mr-3 mt-0.5 flex-shrink-0 transition-all duration-200 ${
                  value === mode.key 
                    ? 'border-blue-400 bg-blue-400 ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-800' 
                    : 'border-gray-500 hover:border-gray-400 focus-within:border-blue-400'
                }`}
                aria-hidden="true"
              >
                {value === mode.key && (
                  <div className="w-2 h-2 rounded-full bg-gray-900 m-auto" />
                )}
              </div>
              <div className="flex-1">
                <span className="font-bold block">{mode.label}</span>
                <p className="text-xs mt-1 leading-relaxed">{mode.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ImportModeControl;
