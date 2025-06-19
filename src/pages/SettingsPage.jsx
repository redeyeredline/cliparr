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
        console.error('Failed to load settings:', err);
        toast({ type: 'error', message: 'Failed to load settings' });
      }
    };
    fetchSettings();
  }, [toast]);

  // Handler to update pending mode from ImportModeControl
  const handlePendingMode = (mode) => {
    setPendingMode(mode);
    // If switching to 'none', keep the current interval but disable the control
    // The interval will be ignored when mode is 'none' anyway
    if (mode === 'none') {
      setPendingInterval(currentInterval);
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
          apiClient.setImportMode(pendingMode),
        );
      }

      if (pendingInterval !== currentInterval) {
        promises.push(
          apiClient.setPollingInterval(pendingInterval),
        );
      }

      try {
        await Promise.all(promises);
        setImportMode(pendingMode);
        setCurrentInterval(pendingInterval);
        toast({ type: 'success', message: 'Settings saved successfully' });
      } catch (error) {
        console.error('Failed to save settings:', error);
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
    <div className="py-8 px-8 bg-gray-900 min-h-full text-gray-100 flex">
      <div className="w-full max-w-2xl ml-0">
        <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700 p-6 w-full">
          <h2 className="text-xl font-semibold mb-4">Import Settings</h2>
          <div className="space-y-8">
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="block font-medium">Import Mode</label>
                <span className="text-sm text-gray-400">Choose how Cliparr handles show imports from Sonarr.</span>
              </div>
              <ImportModeControl
                value={pendingMode !== null ? pendingMode : importMode}
                onValueChange={handlePendingMode}
                disabled={saving}
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="block font-medium">Import Refresh Interval</label>
                <span className="text-sm text-gray-400">Defines how often Cliparr checks for new shows to import.</span>
              </div>
              <PollingIntervalControl
                value={pendingInterval}
                disabled={pendingMode === 'none'}
                onValueChange={handlePendingInterval}
                hideHeader={true}
              />
            </div>
          </div>
          {hasChanges && (
            <div className="flex justify-end mt-6">
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50 text-sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
