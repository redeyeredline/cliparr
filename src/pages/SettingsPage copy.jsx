import React, { useState, useEffect, useCallback } from 'react';
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
  const handleSave = useCallback(async () => {
    const hasChanges = (pendingMode !== importMode) ||
                      (pendingInterval !== currentInterval);

    if (!hasChanges) {
      return;
    }

    setSaving(true);
    try {
      let autoScanTriggered = false;

      // Handle import mode change separately to check for auto scan
      if (pendingMode !== importMode) {
        const modeResult = await apiClient.setImportMode(pendingMode);
        if (modeResult && modeResult.autoScanTriggered) {
          autoScanTriggered = true;
        }
      }

      // Handle polling interval change
      if (pendingInterval !== currentInterval) {
        await apiClient.setPollingInterval(pendingInterval);
      }

      setImportMode(pendingMode);
      setCurrentInterval(pendingInterval);

      if (autoScanTriggered) {
        toast({ type: 'success', message: 'Auto import mode enabled! Scanning for shows to import...' });
      } else {
        toast({ type: 'success', message: 'Settings saved successfully' });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({ type: 'error', message: 'Failed to save some settings' });
    } finally {
      setSaving(false);
    }
  }, [pendingMode, importMode, pendingInterval, currentInterval, toast]);

  const hasChanges = (pendingMode !== importMode) ||
                    (pendingInterval !== currentInterval);

  // Add keyboard event handler for Enter key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && hasChanges && !saving) {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, saving, handleSave]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full flex flex-col items-center justify-center">
          <div className="w-full max-w-2xl mx-auto h-full flex flex-col justify-center">
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/30 shadow-2xl p-8 w-full">
              <h2 className="text-2xl font-bold text-white mb-8">Import Settings</h2>
              <div className="space-y-10">
                <div>
                  <div className="flex items-baseline justify-between mb-3">
                    <label className="block font-semibold text-gray-200 text-lg">Import Mode</label>
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
                    <label className="block font-semibold text-gray-200 text-lg">Import Refresh Interval</label>
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
                <div className="flex justify-end mt-10">
                  <button
                    className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-50 text-base shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105"
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
      </div>
    </div>
  );
};

export default SettingsPage;
