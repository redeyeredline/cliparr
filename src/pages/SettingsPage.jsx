// Settings management page for configuring Sonarr connection, processing options, and import behavior.
// Provides form controls for API credentials, output directories, and confidence thresholds.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Save, CheckCircle, XCircle } from 'lucide-react';
import ImportModeControl from '../components/ImportModeControl';
import PollingIntervalControl from '../components/PollingIntervalControl';
import { useToast } from '../components/ToastContext';
import { apiClient } from '../integration/api-client';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import FolderPickerModal from '../components/FolderPickerModal';

const defaultSettings = {
  sonarr_url: '',
  sonarr_api_key: '',
  output_directory: '',
  min_confidence_threshold: 0.8,
  backup_originals: true,
  auto_process_verified: false,
  auto_process_detections: false,
  import_mode: 'none',
  polling_interval: 900,
  temp_dir: '',
  cpu_worker_limit: 2,
  gpu_worker_limit: 1,
};

const maskApiKey = (key) => {
  if (!key) {
    return '';
  }
  if (key.length <= 10) {
    return '*'.repeat(key.length);
  }
  return key.slice(0, 6) + '*'.repeat(key.length - 10) + key.slice(-4);
};

const Settings2Page = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [pending, setPending] = useState(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [testingSonarr, setTestingSonarr] = useState(false);
  const [sonarrTestResult, setSonarrTestResult] = useState(null);
  const toast = useToast();
  const [apiKeyFocused, setApiKeyFocused] = useState(false);
  const [apiKeyEdited, setApiKeyEdited] = useState(false);
  const [showTempDirPicker, setShowTempDirPicker] = useState(false);
  const [showOutputDirPicker, setShowOutputDirPicker] = useState(false);
  const [tempDirValid, setTempDirValid] = useState(true);
  const [tempDirError, setTempDirError] = useState('');

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
          auto_process_detections:
            data.auto_process_detections === '1' || data.auto_process_detections === true,
          min_confidence_threshold: parseFloat(data.min_confidence_threshold) || 0.8,
          polling_interval: parseInt(data.polling_interval, 10) || 900,
          temp_dir: data.temp_dir || '',
          cpu_worker_limit: parseInt(data.cpu_worker_limit, 10) || 2,
          gpu_worker_limit: parseInt(data.gpu_worker_limit, 10) || 1,
        });
        setPending({
          ...defaultSettings,
          ...data,
          backup_originals: data.backup_originals === '1' || data.backup_originals === true,
          auto_process_verified:
            data.auto_process_verified === '1' || data.auto_process_verified === true,
          auto_process_detections:
            data.auto_process_detections === '1' || data.auto_process_detections === true,
          min_confidence_threshold: parseFloat(data.min_confidence_threshold) || 0.8,
          polling_interval: parseInt(data.polling_interval, 10) || 900,
          temp_dir: data.temp_dir || '',
          cpu_worker_limit: parseInt(data.cpu_worker_limit, 10) || 2,
          gpu_worker_limit: parseInt(data.gpu_worker_limit, 10) || 1,
        });
      } catch (err) {
        toast({ type: 'error', message: 'Failed to load settings' });
      }
    };
    fetch();
  }, [toast]);

  // Validate temp_dir automatically when it changes
  useEffect(() => {
    if (!pending.temp_dir) {
      setTempDirValid(true);
      setTempDirError('');
      return;
    }
    let cancelled = false;
    apiClient.validateTempDir(pending.temp_dir).then((result) => {
      if (cancelled) {
        return;
      }
      setTempDirValid(result.valid);
      setTempDirError(result.valid ? '' : result.error || 'Invalid temp directory');
    });
    return () => {
      cancelled = true;
    };
  }, [pending.temp_dir]);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(pending);

  const handleChange = (key, value) => {
    setPending((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!tempDirValid) {
      toast({ type: 'error', message: 'Please fix the temp directory before saving.' });
      return;
    }
    setSaving(true);
    try {
      // Only send the real API key if it is not masked
      const settingsToSave = { ...pending };
      if (!settingsToSave.sonarr_api_key || settingsToSave.sonarr_api_key.includes('*')) {
        delete settingsToSave.sonarr_api_key;
      }
      await apiClient.setAllSettings({
        ...settingsToSave,
        backup_originals: pending.backup_originals ? 1 : 0,
        auto_process_verified: pending.auto_process_verified ? 1 : 0,
        auto_process_detections: pending.auto_process_detections ? 1 : 0,
      });
      setSettings({ ...pending });
      setApiKeyEdited(false);
      toast({ type: 'success', message: 'Settings saved successfully' });
    } catch (err) {
      toast({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }, [pending, toast, tempDirValid]);

  const handleApiKeyFocus = () => setApiKeyFocused(true);
  const handleApiKeyBlur = () => {
    if (pending.sonarr_api_key === settings.sonarr_api_key || !pending.sonarr_api_key) {
      setApiKeyEdited(false);
    }
  };
  const handleApiKeyChange = (e) => {
    setApiKeyEdited(true);
    handleChange('sonarr_api_key', e.target.value);
  };

  const handleTestSonarr = async () => {
    setTestingSonarr(true);
    setSonarrTestResult(null);
    // Always use the raw, currently visible values from the input fields
    const url = (pending.sonarr_url || 'http://localhost:8989').replace(/\/$/, '');
    const apiKey = pending.sonarr_api_key;
    // If the API key is masked (contains *), fail immediately
    if (!apiKey || apiKey.includes('*')) {
      setSonarrTestResult('fail');
      toast({ type: 'error', message: 'Please enter your real Sonarr API key to test connection.' });
      setTestingSonarr(false);
      return;
    }
    try {
      const res = await fetch(`${url}/api/v3/system/status`, {
        headers: { 'X-Api-Key': apiKey },
      });
      if (res.ok) {
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
        (document.activeElement.tagName !== 'TEXTAREA')
      ) {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, saving]);

  const apiKeyInputValue = (
    apiKeyEdited
      ? pending.sonarr_api_key
      : (settings.sonarr_api_key && (!pending.sonarr_api_key || pending.sonarr_api_key === settings.sonarr_api_key)
        ? maskApiKey(settings.sonarr_api_key)
        : (pending.sonarr_api_key || ''))
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Media Sources */}
          <Card className="mb-8 max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-white">Media Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <div className="font-semibold text-gray-200 mb-2">Sonarr Configuration</div>
                <div className="flex flex-row items-start justify-between">
                  <div className="flex flex-col gap-2">
                    <input
                      className="rounded-lg px-3 py-2 bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-[210px]"
                      type="text"
                      placeholder="http://localhost:8989"
                      value={pending.sonarr_url || 'http://localhost:8989'}
                      onChange={(e) => handleChange('sonarr_url', e.target.value)}
                      maxLength={100}
                    />
                    <input
                      className="rounded-lg px-3 py-2 bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-[340px]"
                      type="text"
                      placeholder="Your Sonarr API key"
                      value={apiKeyInputValue}
                      onFocus={() => {}}
                      onBlur={handleApiKeyBlur}
                      onChange={handleApiKeyChange}
                      maxLength={100}
                      autoComplete="off"
                      inputMode="none"
                    />
                  </div>
                  <button
                    className="px-4 h-[68px] text-base rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex flex-col items-center justify-center text-center"
                    onClick={handleTestSonarr}
                    disabled={testingSonarr}
                    type="button"
                  >
                    <span className="block leading-tight">Test</span>
                    <span className="block leading-tight">Connection</span>
                    {sonarrTestResult === 'success' && (
                      <CheckCircle className="mt-1 text-green-400 w-4 h-4" />
                    )}
                    {sonarrTestResult === 'fail' && (
                      <XCircle className="mt-1 text-red-400 w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Processing Settings */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-white">Processing Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <label className="block font-semibold text-gray-200 mb-1">Output Directory</label>
                <div className="flex items-center gap-2">
                  <input
                    className="w-full rounded-lg px-3 py-2 bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    type="text"
                    placeholder="/media/processed"
                    value={pending.output_directory}
                    onChange={(e) => handleChange('output_directory', e.target.value)}
                    maxLength={100}
                  />
                  <button
                    type="button"
                    className="bg-blue-500/90 hover:bg-blue-500 text-white rounded-lg px-3 py-2"
                    onClick={() => setShowOutputDirPicker(true)}
                    tabIndex={-1}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h3.172a2 2 0 011.414.586l1.828 1.828A2 2 0 0012.828 8H19a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                  </button>
                </div>
                <span className="text-sm text-gray-400">
                  Directory where processed files will be saved
                </span>
                <FolderPickerModal
                  isOpen={showOutputDirPicker}
                  onClose={() => setShowOutputDirPicker(false)}
                  onSelect={(folder) => handleChange('output_directory', folder)}
                  initialPath={pending.output_directory || '/'}
                />
              </div>
              <div className="mb-2">
                <label className="block font-semibold text-gray-200 mb-1">Temporary Directory</label>
                <div className="flex items-center gap-2">
                  <input
                    className="w-full rounded-lg px-3 py-2 bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    type="text"
                    placeholder="/tmp/cliprr"
                    value={pending.temp_dir}
                    onChange={(e) => handleChange('temp_dir', e.target.value)}
                    maxLength={100}
                  />
                  <button
                    type="button"
                    className="bg-blue-500/90 hover:bg-blue-500 text-white rounded-lg px-3 py-2"
                    onClick={() => setShowTempDirPicker(true)}
                    tabIndex={-1}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h3.172a2 2 0 011.414.586l1.828 1.828A2 2 0 0012.828 8H19a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                  </button>
                </div>
                <span className="text-sm text-gray-400">
                  Directory for temporary files (default: system temp dir, e.g. /tmp/cliprr). Change only if you want to use a custom location.
                </span>
                {!tempDirValid && (
                  <div className="text-sm text-red-400 mt-1">{tempDirError || 'Invalid temp directory'}</div>
                )}
                <FolderPickerModal
                  isOpen={showTempDirPicker}
                  onClose={() => setShowTempDirPicker(false)}
                  onSelect={(folder) => handleChange('temp_dir', folder)}
                  initialPath={pending.temp_dir || '/'}
                />
              </div>
              <div className="mb-2">
                <label className="block font-semibold text-gray-200 mb-1">Minimum Confidence Threshold</label>
                <div className="flex items-center">
                  <input
                    className="w-16 rounded-lg px-3 py-2 bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    type="text"
                    value={pending.min_confidence_threshold}
                    onChange={(e) => handleChange('min_confidence_threshold', e.target.value)}
                  />
                  <span className="text-sm text-gray-400 ml-2">
                    Minimum AI confidence score (0-1) for automatic processing
                  </span>
                </div>
              </div>
              <div className="flex items-center mb-1">
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
              <div className="flex items-center">
                <input
                  id="auto_process_detections"
                  type="checkbox"
                  checked={pending.auto_process_detections}
                  onChange={(e) => handleChange('auto_process_detections', e.target.checked)}
                  className="mr-2 rounded focus:ring-blue-500"
                />
                <label htmlFor="auto_process_detections" className="font-semibold text-gray-200">
                  Auto-Process High Confidence Detections
                </label>
              </div>
              <span className="text-sm text-gray-400 mb-4 block">
                Automatically approve and process files when confidence score meets threshold
              </span>
            </CardContent>
          </Card>
          {/* Import Settings */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-white">Import Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
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
              <div className="mb-2">
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
            </CardContent>
          </Card>
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
