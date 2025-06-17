import React, { useState, useEffect } from 'react';
import ImportModeControl from '../components/ImportModeControl';
import PollingIntervalControl from '../components/PollingIntervalControl';
import { useToast } from '../components/ToastContext';
import { apiClient } from '../integration/api-client';

const SettingsPage = () => {
  const [importMode, setImportMode] = useState('loading...');
  const [currentInterval, setCurrentInterval] = useState(null);
  const [pendingMode, setPendingMode] = useState(null);
  const [pendingInterval, setPendingInterval] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Fetch initial settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [modeData, intervalData] = await Promise.all([
          apiClient.getImportMode(),
          apiClient.getPollingInterval(),
        ]);
        setImportMode(modeData.mode);
        setPendingMode(modeData.mode);
        setCurrentInterval(intervalData.interval);
        setPendingInterval(intervalData.interval);
      } catch (err) {
        toast({ type: 'error', message: 'Failed to load settings' });
      }
    };
    fetchSettings();
  }, [toast]);

  // Handler to update pending mode from ImportModeControl
  const handlePendingMode = (mode) => {
    setPendingMode(mode);
    // If switching to 'none', clear the pending interval
    if (mode === 'none') {
      setPendingInterval(null);
    }
  };

  // Handler to update pending interval
  const handlePendingInterval = (interval) => {
    setPendingInterval(interval);
  };

  // Handler to save all settings
  const handleSave = async () => {
    const hasChanges = (pendingMode !== importMode) ||
                      (pendingInterval !== currentInterval);

    if (!hasChanges) {
      return;
    }

    setSaving(true);
    try {
      const promises = [];

      if (pendingMode !== importMode) {
        promises.push(
          fetch('http://localhost:8485/settings/import-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: pendingMode }),
          }),
        );
      }

      if (pendingInterval !== currentInterval) {
        promises.push(
          fetch('http://localhost:8485/settings/polling-interval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interval: pendingInterval }),
          }),
        );
      }

      const results = await Promise.all(promises);
      const errors = results.filter((res) => !res.ok);

      if (errors.length === 0) {
        setImportMode(pendingMode);
        setCurrentInterval(pendingInterval);
        toast({ type: 'success', message: 'Settings saved successfully' });
      } else {
        toast({ type: 'error', message: 'Failed to save some settings' });
      }
    } catch (err) {
      toast({ type: 'error', message: err.message || 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = (pendingMode !== importMode) ||
                    (pendingInterval !== currentInterval);

  return (
    <div className="py-8 px-4 bg-gray-900 min-h-full text-gray-100">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <div className="flex justify-center">
        <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 p-12 w-full max-w-4xl relative">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Import Settings</h2>
            {hasChanges && (
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
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
            </div>
            {/* Divider */}
            <div className="hidden md:block w-px bg-gray-700 mx-2" />
            {/* Polling Interval Control */}
            <div className="flex-1 flex flex-col items-center justify-center h-full">
              <PollingIntervalControl
                value={pendingInterval}
                disabled={pendingMode === 'none'}
                onValueChange={handlePendingInterval}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
