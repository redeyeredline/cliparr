import React, { useRef, useEffect } from 'react';
import { useImportModal } from '../hooks/useImportModal';
import { Database, Plus } from 'lucide-react';

const EmptyState: React.FC = () => {
  const { openImportModal, isOpen } = useImportModal();
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const prevIsOpen = useRef(isOpen);

  useEffect(() => {
    // If modal just closed, blur the button
    if (prevIsOpen.current && !isOpen && plusButtonRef.current) {
      plusButtonRef.current.blur();
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      {/* Animated Icon Container */}
      <div className="relative mb-8">
        <div className={`
          w-32 h-32 bg-gradient-to-br from-gray-700/30 to-gray-800/30 rounded-3xl 
          flex items-center justify-center backdrop-blur-sm border border-gray-700/20 
          shadow-2xl
        `}>
          <Database className="w-16 h-16 text-gray-400" />
        </div>
        {/* Floating accent as a button, no focus border */}
        <button
          ref={plusButtonRef}
          onClick={openImportModal}
          className={`
            absolute -top-2 -right-2 w-8 h-8 
            bg-gradient-to-br from-blue-500 to-purple-600 
            rounded-full flex items-center justify-center 
            shadow-lg shadow-blue-500/25 
            transition-all duration-200 hover:scale-110 
            focus:outline-none
          `}
          aria-label="Import Shows"
          tabIndex={0}
          type="button"
        >
          <Plus className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="text-center max-w-md">
        <h3 className={`
          text-2xl font-bold text-white mb-3 bg-gradient-to-r from-white to-gray-300 
          bg-clip-text text-transparent
        `}>
          No shows imported yet
        </h3>
        <p className="text-gray-400 mb-8 leading-relaxed">
          Start clipping your media library by importing shows from Sonarr.
          Analyze, clip, and free yourself from hearing the same shit over and over.
        </p>

        {/* CTA Button */}
        <button
          onClick={openImportModal}
          className={`
            group relative bg-gradient-to-r from-blue-600 to-purple-600 
            hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-4 px-8 
            rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-300 
            hover:shadow-blue-500/40 hover:scale-105 focus:outline-none focus:ring-2 
            focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-gray-900
          `}
        >
          <span className="flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>Import Shows</span>
          </span>

          {/* Button shine effect */}
          <div className={`
            absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 
            to-transparent opacity-0 group-hover:opacity-100 transition-opacity 
            duration-300 transform -skew-x-12
          `}></div>
        </button>
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`
          absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/5 
          rounded-full blur-3xl
        `}></div>
        <div className={`
          absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/5 
          rounded-full blur-3xl
        `}></div>
      </div>
    </div>
  );
};

export default EmptyState;
