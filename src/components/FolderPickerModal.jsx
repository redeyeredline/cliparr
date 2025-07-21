import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { X, Folder as FolderIcon, ChevronRight } from 'lucide-react';

export default function FolderPickerModal({ isOpen, onClose, onSelect, initialPath = '/' }) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [folders, setFolders] = useState([]);
  const [parent, setParent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCurrentPath(initialPath);
      setError('');
    }
  }, [isOpen, initialPath]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setLoading(true);
    setError('');
    fetch('http://localhost:8485/settings/filesystem/list?path=' + encodeURIComponent(currentPath))
      .then((res) => res.json())
      .then((data) => {
        setFolders(data.folders || []);
        setParent(data.parent);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load folders');
        setFolders([]);
        setParent(null);
        setLoading(false);
      });
  }, [currentPath, isOpen]);

  const handleSelect = () => {
    onSelect(currentPath);
    onClose();
  };

  const handleNavigate = (path) => {
    setCurrentPath(path);
  };

  const renderBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    return (
      <div className="flex items-center gap-1 text-sm text-slate-300 mb-4">
        <button onClick={() => handleNavigate('/')} className="hover:underline">
          /
        </button>
        {parts.map((part, idx) => {
          const segmentPath = '/' + parts.slice(0, idx + 1).join('/');
          return (
            <React.Fragment key={segmentPath}>
              <ChevronRight className="inline w-4 h-4 mx-1 text-slate-500" />
              <button onClick={() => handleNavigate(segmentPath)} className="hover:underline">
                {part}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <Card className="max-w-2xl w-full rounded-2xl shadow-2xl bg-gray-800/95">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-bold text-white">Select Folder</CardTitle>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent>
          {renderBreadcrumbs()}
          {error && <div className="text-red-400 mb-2">{error}</div>}
          {loading ? (
            <div className="text-slate-400 py-8 text-center">Loading folders…</div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-700">
              {parent && (
                <div
                  className="flex items-center gap-2 py-2 cursor-pointer hover:bg-gray-700/40 rounded-lg px-2"
                  onClick={() => handleNavigate(parent)}
                >
                  <FolderIcon className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-300 font-medium">.. (Up)</span>
                </div>
              )}
              {folders.map((folder) => (
                <div
                  key={folder.path}
                  className="flex items-center gap-2 py-2 cursor-pointer hover:bg-blue-700/30 rounded-lg px-2"
                  onClick={() => handleNavigate(folder.path)}
                >
                  <FolderIcon className="w-5 h-5 text-blue-400" />
                  <span className="text-slate-200 font-medium">{folder.name}</span>
                </div>
              ))}
              {folders.length === 0 && !parent && !loading && (
                <div className="text-slate-500 py-8 text-center">No folders found</div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-2 pt-4">
          <button
            onClick={onClose}
            className="bg-gray-700/80 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-xl mr-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            className="bg-blue-500/90 hover:bg-blue-500 text-white font-semibold py-2 px-6 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading || !currentPath}
          >
            Select
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
