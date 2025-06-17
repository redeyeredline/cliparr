import React from 'react';
import ImportModeControl from '../components/ImportModeControl';
import PollingIntervalControl from '../components/PollingIntervalControl';

const SettingsPage = () => {
  return (
    <div className="py-8 px-4 bg-gray-900 min-h-full text-gray-100">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <div className="flex justify-center">
        <div className="bg-gray-800 rounded-2xl shadow-xl border border-gray-700 p-8 w-full max-w-3xl">
          <h2 className="text-2xl font-bold mb-8 tracking-tight">Automatic Import Settings</h2>
          <div className="flex flex-col md:flex-row md:space-x-12 gap-4 md:gap-0 items-stretch">
            {/* Import Mode Control */}
            <div className="flex-1 flex flex-col items-center justify-center h-full">
              <ImportModeControl />
            </div>
            {/* Divider */}
            <div className="hidden md:block w-px bg-gray-700 mx-2" />
            {/* Polling Interval Control */}
            <div className="flex-1 flex flex-col items-center justify-center h-full">
              <PollingIntervalControl />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
