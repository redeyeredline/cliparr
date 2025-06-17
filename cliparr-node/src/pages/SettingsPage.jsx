import React from 'react';
import ImportModeTest from '../components/ImportModeTest';
import PollingIntervalControl from '../components/PollingIntervalControl';

const SettingsPage = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Import Settings</h2>
          <ImportModeTest />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Task Settings</h2>
          <PollingIntervalControl />
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
