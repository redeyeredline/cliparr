import React from 'react';
import ImportModeControl from '../components/ImportModeControl';
import PollingIntervalControl from '../components/PollingIntervalControl';

const SettingsPage = () => {
  return (
    <div className="py-8 px-4 bg-gray-900 min-h-full text-gray-100">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <div className="space-y-6">
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Import Settings</h2>
          <div className="mb-4 flex flex-col gap-6 md:flex-row md:gap-12">
            <ImportModeControl />
            <PollingIntervalControl />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
