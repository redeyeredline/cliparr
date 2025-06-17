import { useEffect } from 'react';

interface ImportModeControlProps {
  value: string;
  onValueChange: (mode: string) => void;
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

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <label className="font-semibold mb-2 text-lg text-center">Import Mode</label>
      <div className="mb-4 w-full max-w-xs text-sm">
        {modeDescriptions.map((mode) => (
          <div
            key={mode.key}
            className={`mb-2 p-2 rounded-lg transition-colors cursor-pointer ${
              value === mode.key
                ? 'bg-blue-900 text-blue-200 font-semibold'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !disabled && onValueChange(mode.key)}
          >
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                value === mode.key ? 'border-blue-400 bg-blue-400' : 'border-gray-500'
              }`}>
                {value === mode.key && <div className="w-2 h-2 rounded-full bg-gray-900 m-auto" />}
              </div>
              <div>
                <span className="font-bold">{mode.label}</span>
                <p className="text-xs mt-1">{mode.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ImportModeControl;
