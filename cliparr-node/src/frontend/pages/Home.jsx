import React, { useState, useEffect } from 'react';
import AlphabetSidebar from '../components/AlphabetSidebar';
import ImportModal from '../components/ImportModal';
import { useToast } from '../components/ToastProvider';

function Home() {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLetter, setActiveLetter] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    fetchShows();
  }, []);

  const fetchShows = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/shows');
      const data = await response.json();
      setShows(data);
    } catch (error) {
      addToast('Failed to fetch shows', 'error');
      console.error('Error fetching shows:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableLetters = () => {
    const letters = new Set();
    shows.forEach(show => {
      const firstLetter = show.title.charAt(0).toUpperCase();
      letters.add(/[A-Z]/.test(firstLetter) ? firstLetter : '#');
    });
    return Array.from(letters).sort();
  };

  const filteredShows = activeLetter
    ? shows.filter(show => {
        const firstLetter = show.title.charAt(0).toUpperCase();
        return activeLetter === '#' 
          ? !/[A-Z]/.test(firstLetter)
          : firstLetter === activeLetter;
      })
    : shows;

  const handleImportComplete = () => {
    fetchShows();
  };

  if (loading) {
    return <div className="text-center py-4">Loading shows...</div>;
  }

  return (
    <div className="flex h-screen">
      <AlphabetSidebar
        availableLetters={getAvailableLetters()}
        activeLetter={activeLetter}
        onLetterClick={setActiveLetter}
      />
      
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Shows</h1>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Import Shows
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShows.map(show => (
            <div
              key={show.id}
              className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
            >
              <h3 className="font-medium text-lg mb-2">{show.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-3">{show.overview}</p>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {show.episodeCount} episodes
                </span>
                <button
                  onClick={() => {/* TODO: Implement show details view */}}
                  className="text-blue-500 hover:text-blue-600"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredShows.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No shows found
          </div>
        )}
      </div>

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportComplete}
      />
    </div>
  );
}

export default Home; 