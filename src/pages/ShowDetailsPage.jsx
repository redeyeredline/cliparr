// Detailed view page for individual shows displaying seasons, episodes, and file information.
// Provides expandable season navigation and episode listing with file details.
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, ArrowLeft, Folder, FileText } from 'lucide-react';
import { apiClient } from '../integration/api-client';
import { useToast } from '../components/ToastContext';

const ShowDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSeasons, setExpandedSeasons] = useState(new Set());

  const sortedSeasons = useMemo(() => {
    return show?.seasons ?
      [...show.seasons].sort((a, b) => a.season_number - b.season_number) :
      [];
  }, [show?.seasons]);

  useEffect(() => {
    const fetchShowDetails = async () => {
      if (!id) {
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const showData = await apiClient.getShowWithDetails(parseInt(id));
        setShow(showData);
      } catch (err) {
        console.error('Failed to fetch show details:', err);
        setError('Failed to load show details. Please try again.');
        toast.error('Failed to load show details');
      } finally {
        setLoading(false);
      }
    };

    fetchShowDetails();
  }, [id, toast]);

  const toggleSeason = (seasonId) => {
    const newExpanded = new Set(expandedSeasons);
    if (newExpanded.has(seasonId)) {
      newExpanded.delete(seasonId);
    } else {
      newExpanded.add(seasonId);
    }
    setExpandedSeasons(newExpanded);
  };

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className={`
            w-12 h-12 border-4 border-blue-500 border-t-transparent 
            rounded-full animate-spin mx-auto mb-4
          `}></div>
          <p className="text-gray-400">Loading show details...</p>
        </div>
      </div>
    );
  }

  if (error || !show) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md">
          <div className={`
            w-16 h-16 bg-red-500/10 rounded-full flex items-center 
            justify-center mx-auto mb-4
          `}>
            <FileText className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Show Not Found</h2>
          <p className="text-gray-400 mb-6">
            {error || 'The requested show could not be found.'}
          </p>
          <button
            onClick={handleBack}
            className={`
              bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl 
              font-medium transition-all duration-200
            `}
          >
            Back to Shows
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-900 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-gray-800/50 border-b border-gray-700/50 p-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="w-10 h-10 bg-gray-700/50 hover:bg-gray-600/50 rounded-xl flex items-center justify-center transition-all duration-200 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              aria-label="Back to shows"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-1">{show.title}</h1>
              <div className="flex items-center space-x-2 text-gray-400">
                <Folder className="w-4 h-4" />
                <span className="font-mono text-sm">{show.path}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">
                {sortedSeasons.length} season{sortedSeasons.length !== 1 ? 's' : ''}
              </div>
              <div className="text-sm text-gray-400">
                {sortedSeasons.reduce((total, season) => total + season.episode_count, 0)} episodes
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-4">
            {sortedSeasons.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Folder className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">No Seasons Found</h3>
                <p className="text-gray-500">This show doesn't have any seasons imported yet.</p>
              </div>
            ) : (
              sortedSeasons.map((season) => {
                const isExpanded = expandedSeasons.has(season.id);

                return (
                  <div
                    key={season.id}
                    className="bg-gray-800/30 backdrop-blur-sm border border-gray-700/50 rounded-2xl overflow-hidden"
                  >
                    {/* Season Header - Top Collapse/Expand */}
                    <button
                      onClick={() => toggleSeason(season.id)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-700/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                          <span className="text-white font-bold text-sm">{season.season_number}</span>
                        </div>
                        <div className="text-left">
                          <h3 className="text-lg font-semibold text-white">
                            Season {season.season_number}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {season.episode_count} episode{season.episode_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-400">
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Season Content */}
                    {isExpanded && (
                      <>
                        <div className="border-t border-gray-700/50">
                          {season.episodes && season.episodes.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead className="bg-gray-800/50">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                      Episode
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                      Title
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                      Files
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/30">
                                  {season.episodes
                                    .sort((a, b) => a.episode_number - b.episode_number)
                                    .map((episode) => (
                                      <tr
                                        key={episode.id}
                                        className="hover:bg-gray-700/20 transition-all duration-200"
                                      >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="flex items-center">
                                            <div className="w-8 h-8 bg-gray-700/50 rounded-lg flex items-center justify-center">
                                              <span className="text-sm font-medium text-gray-300">
                                                {episode.episode_number}
                                              </span>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-6 py-4">
                                          <div className="text-white font-medium">
                                            {episode.title || `Episode ${episode.episode_number}`}
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="flex items-center space-x-2">
                                            <FileText className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-300">
                                              {episode.file_count} file{episode.file_count !== 1 ? 's' : ''}
                                            </span>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="px-6 py-8 text-center">
                              <div className="w-12 h-12 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <FileText className="w-6 h-6 text-gray-400" />
                              </div>
                              <p className="text-gray-400">No episodes found for this season</p>
                            </div>
                          )}
                        </div>

                        {/* Season Footer - Bottom Collapse */}
                        <div className="border-t border-gray-700/50">
                          <button
                            onClick={() => toggleSeason(season.id)}
                            className="w-full px-6 py-3 flex items-center justify-center space-x-2 hover:bg-gray-700/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            <span className="text-sm text-gray-400">Collapse Season {season.season_number}</span>
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShowDetailsPage;
