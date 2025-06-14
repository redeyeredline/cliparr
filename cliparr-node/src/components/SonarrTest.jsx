import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SonarrTest = () => {
    const [series, setSeries] = useState([]);
    const [sampleEpisode, setSampleEpisode] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('Not Connected');

    const testConnection = async () => {
        setLoading(true);
        setError(null);
        try {
            // First test the series endpoint
            const seriesResponse = await axios.get('/api/sonarr/series');
            setSeries(seriesResponse.data);
            setConnectionStatus('Connected to Sonarr API');
            
            // If we have series, get a sample episode from the first show
            if (seriesResponse.data.length > 0) {
                const firstShow = seriesResponse.data[0];
                const episodesResponse = await axios.get(`/api/sonarr/series/${firstShow.id}/episodes`);
                if (episodesResponse.data.length > 0) {
                    setSampleEpisode({
                        show: firstShow.title,
                        ...episodesResponse.data[0]
                    });
                }
            }
        } catch (err) {
            setError(err.message);
            setConnectionStatus('Connection Failed');
            console.error('Error testing Sonarr connection:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Sonarr API Test</h2>
            
            <div className="mb-4">
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                        connectionStatus === 'Connected to Sonarr API' ? 'bg-green-500' : 
                        connectionStatus === 'Connection Failed' ? 'bg-red-500' : 'bg-gray-500'
                    }`}></div>
                    <span className="font-medium">{connectionStatus}</span>
                </div>
            </div>

            <button
                onClick={testConnection}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
            >
                {loading ? 'Testing Connection...' : 'Test Sonarr Connection'}
            </button>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    Error: {error}
                </div>
            )}

            {sampleEpisode && (
                <div className="mt-4 bg-white rounded-lg shadow p-4">
                    <h3 className="text-xl font-semibold mb-2">Sample Episode Data:</h3>
                    <div className="bg-gray-50 p-4 rounded">
                        <p><span className="font-medium">Show:</span> {sampleEpisode.show}</p>
                        <p><span className="font-medium">Episode:</span> {sampleEpisode.title}</p>
                        <p><span className="font-medium">Season:</span> {sampleEpisode.seasonNumber}</p>
                        <p><span className="font-medium">Episode Number:</span> {sampleEpisode.episodeNumber}</p>
                        <p><span className="font-medium">Air Date:</span> {new Date(sampleEpisode.airDate).toLocaleDateString()}</p>
                        <p><span className="font-medium">Has File:</span> {sampleEpisode.hasFile ? 'Yes' : 'No'}</p>
                    </div>
                </div>
            )}

            {series.length > 0 && (
                <div className="mt-4">
                    <h3 className="text-xl font-semibold mb-2">Series List ({series.length} shows):</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {series.map((show) => (
                            <div
                                key={show.id}
                                className="border rounded p-4 shadow hover:shadow-md transition-shadow"
                            >
                                <h4 className="font-bold">{show.title}</h4>
                                <p className="text-sm text-gray-600">TVDB ID: {show.tvdbId}</p>
                                <p className="text-sm text-gray-600">Status: {show.status}</p>
                                {show.images && show.images[0] && (
                                    <img
                                        src={show.images[0].url}
                                        alt={show.title}
                                        className="mt-2 w-full h-48 object-cover rounded"
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SonarrTest; 