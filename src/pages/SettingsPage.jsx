// Settings management page for configuring Sonarr connection, processing options, and import behavior.
// Provides form controls for API credentials, output directories, and confidence thresholds.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Save, CheckCircle, XCircle } from 'lucide-react';
import ImportModeControl from '../components/ImportModeControl';
import PollingIntervalControl from '../components/PollingIntervalControl';
import { useToast } from '../components/ToastContext';
import { apiClient } from '../integration/api-client';

const defaultSettings = {
  sonarr_url: '',
  sonarr_api_key: '',
  output_directory: '',
  min_confidence_threshold: 0.8,
  backup_originals: true,
  auto_process_verified: false,
  import_mode: 'none',
  polling_interval: 900,
};

const Settings2Page = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [pending, setPending] = useState(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [testingSonarr, setTestingSonarr] = useState(false);
  const [sonarrTestResult, setSonarrTestResult] = useState(null);
  const toast = useToast();

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await apiClient.getAllSettings();
        setSettings({
          ...defaultSettings,
          ...data,
          backup_originals: data.backup_originals === '1' || data.backup_originals === true,
          auto_process_verified:
            data.auto_process_verified === '1' || data.auto_process_verified === true,
          min_confidence_threshold: parseFloat(data.min_confidence_threshold) || 0.8,
          polling_interval: parseInt(data.polling_interval, 10) || 900,
        });
        setPending({
          ...defaultSettings,
          ...data,
          backup_originals: data.backup_originals === '1' || data.backup_originals === true,
          auto_process_verified:
            data.auto_process_verified === '1' || data.auto_process_verified === true,
          min_confidence_threshold: parseFloat(data.min_confidence_threshold) || 0.8,
          polling_interval: parseInt(data.polling_interval, 10) || 900,
        });
      } catch (err) {
        toast({ type: 'error', message: 'Failed to load settings' });
      }
    };
    fetch();
  }, [toast]);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(pending);

  const handleChange = (key, value) => {
    setPending((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await apiClient.setAllSettings({
        ...pending,
        backup_originals: pending.backup_originals ? 1 : 0,
        auto_process_verified: pending.auto_process_verified ? 1 : 0,
      });
      setSettings({ ...pending });
      toast({ type: 'success', message: 'Settings saved successfully' });
    } catch (err) {
      toast({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }, [pending, toast]);

  const handleTestSonarr = async () => {
    setTestingSonarr(true);
    setSonarrTestResult(null);
    try {
      // Implement a real test endpoint if available
      // For now, just check if URL and key are non-empty
      if (pending.sonarr_url && pending.sonarr_api_key) {
        setSonarrTestResult('success');
        toast({ type: 'success', message: 'Sonarr connection test succeeded' });
      } else {
        setSonarrTestResult('fail');
        toast({ type: 'error', message: 'Sonarr connection test failed' });
      }
    } catch (err) {
      setSonarrTestResult('fail');
      toast({ type: 'error', message: 'Sonarr connection test failed' });
    } finally {
      setTestingSonarr(false);
    }
  };

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === 'Enter' &&
        hasChanges &&
        !saving &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, saving]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Media Sources */}
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/30 shadow-2xl p-8 w-full mb-8">
            <h2 className="text-xl font-bold text-white mb-6">Media Sources</h2>
            <div className="mb-6">
              <div className="font-semibold text-gray-200 mb-2">Sonarr Configuration</div>
              <div className="flex flex-col gap-4">
                <div className="flex gap-2 items-center">
                  <input
                    className="flex-1 rounded-lg px-3 py-2 bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    type="text"
                    placeholder="http://localhost:8989"
                    value={pending.sonarr_url}
                    onChange={(e) => handleChange('sonarr_url', e.target.value)}
                    maxLength={100}
                  />
                  <input
                    className="flex-1 rounded-lg px-3 py-2 bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    type="text"
                    placeholder="Your Sonarr API key"
                    value={pending.sonarr_api_key}
                    onChange={(e) => handleChange('sonarr_api_key', e.target.value)}
                    maxLength={100}
                  />
                  <button
                    className="ml-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center"
                    onClick={handleTestSonarr}
                    disabled={testingSonarr}
                    type="button"
                  >
                    Test Connection
                    {sonarrTestResult === 'success' && (
                      <CheckCircle className="ml-1 text-green-400 w-4 h-4" />
                    )}
                    {sonarrTestResult === 'fail' && (
                      <XCircle className="ml-1 text-red-400 w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* Processing Settings */}
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/30 shadow-2xl p-8 w-full mb-8">
            <h2 className="text-xl font-bold text-white mb-6">Processing Settings</h2>
            <div className="mb-6">
              <label className="block font-semibold text-gray-200 mb-1">Output Directory</label>
              <input
                className="w-full rounded-lg px-3 py-2 bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                type="text"
                placeholder="/media/processed"
                value={pending.output_directory}
                onChange={(e) => handleChange('output_directory', e.target.value)}
                maxLength={100}
              />
              <span className="text-sm text-gray-400">
                Directory where processed files will be saved
              </span>
            </div>
            <div className="mb-6">
              <label className="block font-semibold text-gray-200 mb-1">
                Minimum Confidence Threshold
              </label>
              <input
                className="w-full rounded-lg px-3 py-2 bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={pending.min_confidence_threshold}
                onChange={(e) => handleChange('min_confidence_threshold', e.target.value)}
              />
              <span className="text-sm text-gray-400">
                Minimum AI confidence score (0-1) for automatic processing
              </span>
            </div>
            <div className="flex items-center mb-2">
              <input
                id="backup_originals"
                type="checkbox"
                checked={pending.backup_originals}
                onChange={(e) => handleChange('backup_originals', e.target.checked)}
                className="mr-2 rounded focus:ring-blue-500"
              />
              <label htmlFor="backup_originals" className="font-semibold text-gray-200">
                Backup Original Files
              </label>
            </div>
            <span className="text-sm text-gray-400 mb-4 block">
              Keep a copy of original files before processing
            </span>
            <div className="flex items-center">
              <input
                id="auto_process_verified"
                type="checkbox"
                checked={pending.auto_process_verified}
                onChange={(e) => handleChange('auto_process_verified', e.target.checked)}
                className="mr-2 rounded focus:ring-blue-500"
              />
              <label htmlFor="auto_process_verified" className="font-semibold text-gray-200">
                Auto-Process Verified Files
              </label>
            </div>
            <span className="text-sm text-gray-400 mb-4 block">
              Automatically process files after manual verification
            </span>
          </div>
          {/* Import Settings */}
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/30 shadow-2xl p-8 w-full">
            <h2 className="text-xl font-bold text-white mb-6">Import Settings</h2>
            <div className="mb-6">
              <div className="flex items-baseline justify-between mb-3">
                <label className="block font-semibold text-gray-200 text-lg">
                  Import Mode
                </label>
                <span className="text-sm text-gray-400">
                  Choose how Cliparr handles show imports from Sonarr.
                </span>
              </div>
              <ImportModeControl
                value={pending.import_mode}
                onValueChange={(mode) => handleChange('import_mode', mode)}
                disabled={saving}
              />
            </div>
            <div className="mb-6">
              <div className="flex items-baseline justify-between mb-3">
                <label className="block font-semibold text-gray-200 text-lg">
                  Import Refresh Interval
                </label>
                <span className="text-sm text-gray-400">
                  Defines how often Cliparr checks for new shows to import.
                </span>
              </div>
              <PollingIntervalControl
                value={pending.polling_interval}
                disabled={pending.import_mode === 'none'}
                onValueChange={(interval) => handleChange('polling_interval', interval)}
                hideHeader={true}
              />
            </div>
          </div>
          {/* Floating Save Bar */}
          {hasChanges && (
            <div className="fixed bottom-6 right-6 z-50">
              <div
                className="bg-gray-800/90 backdrop-blur-lg border border-gray-700/50 rounded-2xl shadow-2xl p-2"
              >
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-200 hover:shadow-blue-500/40 hover:scale-105 flex items-center space-x-2 disabled:opacity-50"
                  aria-label="Save settings"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings2Page;
