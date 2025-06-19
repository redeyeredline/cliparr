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
    <div className="w-full flex flex-col gap-1.5">
      {modeDescriptions.map((mode) => (
        <div
          key={mode.key}
          className="flex whitespace-nowrap items-center cursor-pointer"
          onClick={() => handleClick(mode.key)}
          onKeyDown={(e) => handleKeyDown(e, mode.key)}
          role="radio"
          aria-checked={value === mode.key}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
        >
          <div className="flex items-center w-[100px]">
            <div
              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all duration-200 ${
                value === mode.key
                  ? 'border-blue-400 bg-blue-400 ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-800'
                  : 'border-gray-500 hover:border-gray-400'
              }`}
              aria-hidden="true"
            >
              {value === mode.key && (
                <div className="w-1.5 h-1.5 rounded-full bg-gray-900 m-auto" />
              )}
            </div>
            <span className={`ml-2 font-medium ${
              value === mode.key ? 'text-blue-200' : 'text-gray-400'
            }`}>{mode.label}</span>
          </div>
          <span className={`text-sm ${
            value === mode.key ? 'text-blue-200/90' : 'text-gray-500'
          }`}>{mode.desc}</span>
        </div>
      ))}
    </div>
  );
}

export default ImportModeControl;
