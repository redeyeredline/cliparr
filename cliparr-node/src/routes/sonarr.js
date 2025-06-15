// src/routes/sonarr.js
import express from 'express';
import axios from 'axios';
import { logger } from '../services/logger.js';
import dotenv from 'dotenv';
import process from 'process';

// Load environment variables
dotenv.config();
const router = express.Router();

// Validate environment variables
const SONARR_URL = process.env.SONARR_URL;
const SONARR_API_KEY = process.env.SONARR_API_KEY;

logger.info(`Loaded SONARR_URL from env: ${SONARR_URL}`);
if (SONARR_API_KEY) {
  logger.info(`Loaded SONARR_API_KEY from env: ${SONARR_API_KEY.slice(0, 4)}... (masked)`);
} else {
  logger.warn('SONARR_API_KEY is not set in environment variables!');
}

// Configure axios with longer timeout and better error handling
const sonarrClient = axios.create({
  baseURL: SONARR_URL,
  timeout: 15000, // 15 second timeout
  headers: {
    'X-Api-Key': SONARR_API_KEY,
    'Content-Type': 'application/json'
  }
});

// Add response interceptor for better error handling
sonarrClient.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ECONNABORTED') {
      logger.error('Sonarr API request timed out');
      throw new Error('Sonarr API request timed out. Please check if Sonarr is running and accessible.');
    }
    if (error.response) {
      if (error.response.status === 401) {
        logger.error('Invalid Sonarr API key');
        throw new Error('Invalid Sonarr API key. Please check your SONARR_API_KEY environment variable.');
      }
      logger.error({ 
        status: error.response.status,
        data: error.response.data 
      }, 'Sonarr API error response');
      throw new Error(`Sonarr API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    if (error.request) {
      logger.error('No response received from Sonarr API');
      throw new Error(`No response from Sonarr API at ${SONARR_URL}. Please check if Sonarr is running and accessible.`);
    }
    logger.error({ error: error.message }, 'Sonarr API request failed');
    throw error;
  }
);

// Test Sonarr connection on startup
const testSonarrConnection = async () => {
  try {
    logger.info(`Testing connection to Sonarr at ${SONARR_URL}`);
    const response = await sonarrClient.get('/api/v3/system/status');
    logger.info('Successfully connected to Sonarr API');
    logger.debug({ version: response.data.version }, 'Sonarr version');
  } catch (error) {
    logger.error('Failed to connect to Sonarr API:', error.message);
    throw error;
  }
};

// Test connection immediately
testSonarrConnection().catch(error => {
  logger.error('Sonarr API connection test failed:', error.message);
});

// Get unimported shows from Sonarr
router.get('/unimported', async (req, res) => {
  try {
    logger.info('Fetching unimported shows from Sonarr');
    const response = await sonarrClient.get('/api/v3/series');
    const shows = response.data;
    
    // Filter out shows that are already imported
    const db = req.app.get('db');
    const importedShows = db.prepare('SELECT sonarr_id FROM shows').all();
    const importedIds = new Set(importedShows.map(show => show.sonarr_id));
    
    const unimportedShows = shows.filter(show => !importedIds.has(show.id));
    
    logger.info(`Found ${unimportedShows.length} unimported shows`);
    res.json(unimportedShows);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to fetch unimported shows');
    res.status(500).json({ 
      error: 'Failed to fetch unimported shows',
      details: error.message 
    });
  }
});

// Import a show from Sonarr
router.post('/import/:id', async (req, res) => { 
  logger.info('Importing show from Sonarr');

  if (!req.app.get('db')) {
    logger.error('Database instance is not set on app');
    return res.status(500).json({ success: false, message: 'Database not initialized' });
  }
  if (!logger) {
    logger.error('Logger is not set on app');
    return res.status(500).json({ success: false, message: 'Logger not initialized' });
  }
  if (!sonarrClient) {
    logger.error('Sonarr client is not set on app');
    return res.status(500).json({ success: false, message: 'Sonarr client not initialized' });
  }
  
  try {
    const showId = req.params.id;
    logger.info(`Starting import for show ID: ${showId}`);
    
    // Get show details from Sonarr
    const showResponse = await sonarrClient.get(`/api/v3/series/${showId}`);
    const show = showResponse.data;
    logger.info({ show }, 'Fetched show details from Sonarr');
    
    // Get episodes for the show
    const episodeResponse = await sonarrClient.get(`/api/v3/episode?seriesId=${showId}`);
    const episodes = episodeResponse.data;
    logger.info({ episodeCount: episodes.length, episodes: episodes.slice(0, 3) }, 'Fetched episodes from Sonarr (showing first 3)');
    
    // Group episodes by season
    const seasons = {};
    episodes.forEach(episode => {
      if (!seasons[episode.seasonNumber]) {
        seasons[episode.seasonNumber] = {
          seasonNumber: episode.seasonNumber,
          episodes: []
        };
      }
      seasons[episode.seasonNumber].episodes.push(episode);
    });

    logger.info({ seasonCount: Object.keys(seasons).length }, 'Prepared seasons grouping');

    // Use a transaction for data consistency
    try {
      logger.info('Beginning database transaction for import');
      req.app.get('db').transaction(() => {
        // Insert the show
        logger.info({ showInsert: { sonarr_id: show.id, title: show.title, overview: show.overview, path: show.path } }, 'Inserting show');
        const showResult = req.app.get('db').prepare(`
          INSERT OR REPLACE INTO shows (
            sonarr_id, title, overview, path
          ) VALUES (?, ?, ?, ?)
        `).run(
          show.id,
          show.title,
          show.overview,
          show.path
        );

        // Insert seasons and episodes
        Object.values(seasons).forEach(season => {
          logger.info({ seasonInsert: { show_id: showResult.lastInsertRowid, season_number: season.seasonNumber } }, 'Inserting season');
          const seasonResult = req.app.get('db').prepare(`
            INSERT OR IGNORE INTO seasons (
              show_id, season_number
            ) VALUES (?, ?)
          `).run(
            showResult.lastInsertRowid,
            season.seasonNumber
          );

          season.episodes.forEach(episode => {
            logger.info({ episodeInsert: { season_id: seasonResult.lastInsertRowid, episode_number: episode.episodeNumber, title: episode.title, sonarr_episode_id: episode.id } }, 'Inserting episode');
            req.app.get('db').prepare(`
              INSERT OR REPLACE INTO episodes (
                season_id, episode_number, title, sonarr_episode_id
              ) VALUES (?, ?, ?, ?)
            `).run(
              seasonResult.lastInsertRowid,
              episode.episodeNumber,
              episode.title,
              episode.id
            );
          });
        });
      })();
      logger.info('Database transaction for import completed successfully');
    } catch (txError) {
      logger.error({ txError: txError.stack || txError }, 'Database transaction failed during import');
      throw txError;
    }

    res.json({ success: true, message: 'Show imported successfully' });
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to import show');
    res.status(500).json({ 
      error: 'Failed to import show',
      details: error.message 
    });
  }
});

export default router;
