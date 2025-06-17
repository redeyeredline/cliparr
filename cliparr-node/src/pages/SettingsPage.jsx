import React, { useState } from 'react';
import ImportModeControl from '../components/ImportModeControl';
import PollingIntervalControl from '../components/PollingIntervalControl';
import { useToast } from '../components/ToastContext';

const SettingsPage = () => {
  const [importMode, setImportMode] = useState('loading...');
  const [pendingMode, setPendingMode] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Handler to update pending mode from ImportModeControl
  const handlePendingMode = (mode) => {
    setPendingMode(mode);
  };

  // Handler to save import mode
  const handleSave = async () => {
    if (!pendingMode || pendingMode === importMode) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('http://localhost:8485/settings/import-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: pendingMode }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportMode(data.mode);
        setPendingMode(null);
        toast({ type: 'success', message: `Import mode set to ${data.mode}` });
      } else {
        toast({ type: 'error', message: data.error || data.details || 'Failed to set import mode' });
      }
    } catch (err) {
      toast({ type: 'error', message: err.message || 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-8 px-4 bg-gray-900 min-h-full text-gray-100">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <div className="flex justify-center">
        <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 p-8 w-full max-w-3xl relative">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Import Settings</h2>
            {pendingMode && pendingMode !== importMode && (
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                onClick={handleSave}
                disabled={saving}
              >
                Save
              </button>
            )}
          </div>
          <div className="flex flex-col md:flex-row md:space-x-12 gap-4 md:gap-0 items-stretch">
            {/* Import Mode Control */}
            <div className="flex-1 flex flex-col items-center justify-center h-full">
              <ImportModeControl
                value={pendingMode !== null ? pendingMode : importMode}
                onValueChange={handlePendingMode}
                disabled={saving}
              />
              {pendingMode && pendingMode !== importMode && (
                <span className="mt-2 text-xs text-yellow-400">Pending: {pendingMode}</span>
              )}
            </div>
            {/* Divider */}
            <div className="hidden md:block w-px bg-gray-700 mx-2" />
            {/* Polling Interval Control */}
            <div className="flex-1 flex flex-col items-center justify-center h-full">
              <PollingIntervalControl disabled={pendingMode === 'none' || importMode === 'none'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
