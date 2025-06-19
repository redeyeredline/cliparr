import React from 'react';
import { useImportModal } from './ImportModalProvider';

const EmptyState: React.FC = () => {
  const { openImportModal } = useImportModal();

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* SVG Illustration */}
      <svg
        className="w-48 h-48 text-gray-600 mb-8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={
            'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
          }
        />
      </svg>

      {/* Text and CTA */}
      <h3 className="text-xl font-semibold text-gray-300 mb-4">
        No shows imported yet
      </h3>
      <p className="text-gray-400 mb-8 text-center max-w-md">
        Start by importing your shows from Sonarr to manage them here.
      </p>
      <button
        onClick={openImportModal}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg \
          transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 \
          focus:ring-offset-2 focus:ring-offset-gray-800"
      >
        Import Shows
      </button>
    </div>
  );
};

export default EmptyState;
