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
      <label htmlFor="import-mode-select" className="font-semibold mb-2 text-lg text-center">Import Mode</label>
      <ul className="mb-4 w-full max-w-xs text-sm">
        {modeDescriptions.map((mode) => (
          <li
            key={mode.key}
            className={`mb-1 px-2 py-1 rounded transition-colors ${
              value === mode.key
                ? 'bg-blue-900 text-blue-200 font-semibold'
                : 'text-gray-400'
            }`}
          >
            <span className="font-bold mr-2">{mode.label}:</span>
            <span>{mode.desc}</span>
          </li>
        ))}
      </ul>
      <select
        id="import-mode-select"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={disabled}
        className="border border-gray-700 rounded px-2 py-2 bg-gray-800 text-gray-100 w-48 focus:ring-2 focus:ring-blue-400 text-center"
      >
        <option value="auto">Auto</option>
        <option value="import">Import</option>
        <option value="none">None</option>
      </select>
    </div>
  );
}

export default ImportModeControl;
