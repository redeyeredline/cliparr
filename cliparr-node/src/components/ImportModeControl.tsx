import { useEffect } from 'react';

interface ImportModeControlProps {
  value: string;
  onValueChange: (mode: string) => void;
  disabled?: boolean;
}

function ImportModeControl({ value, onValueChange, disabled = false }: ImportModeControlProps) {
  // Descriptions for each mode
  const modeDescriptions: Record<string, string> = {
    auto: 'Automatically import all shows from Sonarr and schedule audio fingerprinting.',
    import: 'Only schedule fingerprinting for shows you import manually.',
    none: 'No automatic imports; you must import shows manually.',
  };

  useEffect(() => {
    // No-op, just for consistency if you want to add effects later
  }, [value]);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <label htmlFor="import-mode-select" className="font-semibold mb-2 text-lg text-center">Import Mode</label>
      <p className="text-gray-400 text-sm mb-4 text-center" style={{ minHeight: 40 }}>
        {modeDescriptions[value] || ''}
      </p>
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
