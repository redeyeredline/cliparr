import { useEffect, useRef, useCallback } from 'react';
import { useShiftSelect } from '../utils/selectionUtils';
import { X, Download, Check, ChevronUp, ChevronDown } from 'lucide-react';

export interface Show {
  id: number;
  title: string;
  path: string;
}

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (selectedIds: number[]) => void;
  shows: Show[];
  loading?: boolean;
  error?: string | null;
}

export default function ImportModal({
  open,
  onClose,
  onImport,
  shows,
  loading = false,
  error = null,
}: ImportModalProps) {
  const {
    selected,
    handleToggle,
    selectAll: selectAllItems,
    deselectAll,
    isSelected,
  } = useShiftSelect({
    items: shows,
    getId: (show) => show.id,
  });
  const modalRef = useRef<HTMLDivElement>(null);

  const handleOk = useCallback(() => {
    onImport(selected as number[]);
  }, [onImport, selected]);

  useEffect(() => {
    deselectAll();
  }, [shows, open, deselectAll]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && selected.length > 0) {
        handleOk();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, selected.length, handleOk]);

  if (!open) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const handleSelectAll = () => {
    if (selected.length === shows.length) {
      deselectAll();
    } else {
      selectAllItems();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseDown={handleOverlayClick}
    >
      <div
        ref={modalRef}
        className="bg-gray-800/95 backdrop-blur-lg border border-gray-700/50 rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50 bg-gray-800/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Import Shows</h2>
              <p className="text-sm text-gray-400">Select shows to import from Sonarr</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-gray-700/50 hover:bg-gray-600/50 rounded-xl flex items-center justify-center transition-all duration-200 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 ml-4"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Table Container */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full bg-gray-800/30 backdrop-blur-sm overflow-hidden">
            <div className="h-full overflow-auto">
              {loading && (
                <div className="absolute inset-0 bg-gray-800/50 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              <table className="w-full" role="grid" aria-label="Shows list">
                <thead className="sticky top-0 bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50">
                  <tr>
                    <th className="w-16 px-6 py-4 text-center">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={shows.length > 0 && selected.length === shows.length}
                          onChange={handleSelectAll}
                          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200"
                          aria-label="Select all shows"
                        />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">
                      <div className="flex items-center space-x-2">
                        <span>Title</span>
                        <div className="flex flex-col">
                          <ChevronUp className="w-3 h-3 text-gray-500" />
                          <ChevronDown className="w-3 h-3 -mt-1 text-gray-500" />
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  {shows.map((show) => (
                    <tr
                      key={show.id}
                      className={`group transition-all duration-200 hover:bg-gray-700/20 ${
                        isSelected(show.id)
                          ? 'bg-blue-500/10 border-l-4 border-blue-500'
                          : ''
                      }`}
                      role="row"
                      aria-selected={isSelected(show.id)}
                    >
                      <td className="w-16 px-6 py-4 text-center">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isSelected(show.id)}
                            onChange={(e) => handleToggle(show.id, e.nativeEvent as unknown as React.MouseEvent)}
                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full mr-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                          <div className="text-white font-medium text-lg">{show.title}</div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Empty State */}
              {shows.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mb-4">
                    <Download className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-medium">No shows available</p>
                  <p className="text-sm">Check your Sonarr connection</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700/50 bg-gray-800/50">
          <div className="text-sm text-gray-400">
            {selected.length > 0 && (
              <span className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-blue-400" />
                <span>{selected.length} shows selected</span>
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500/50"
            >
              Cancel
            </button>
            <button
              onClick={handleOk}
              disabled={selected.length === 0}
              className={`px-6 py-2.5 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                selected.length === 0
                  ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105'
              }`}
            >
              <span className="flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Import Selected ({selected.length})</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
