// src/routes/sonarr.js
import express from 'express';
import axios from 'axios';
import { logger } from '../services/logger.js';
import dotenv from 'dotenv';
import process from 'process';
import WebSocket from 'ws';

// Load environment variables
dotenv.config();
const router = express.Router();

// Validate environment variables
const SONARR_URL = process.env.SONARR_URL;
const SONARR_API_KEY = process.env.SONARR_API_KEY;

if (SONARR_API_KEY) {
  logger.info(
    `Loaded SONARR_API_KEY from env: ${SONARR_API_KEY.slice(0, 4)}... (masked)`,
  );
} else {
  logger.warn('SONARR_API_KEY is not set in environment variables!');
}

// Configure axios with longer timeout and better error handling
const sonarrClient = axios.create({
  baseURL: SONARR_URL,
  timeout: 15000, // 15 second timeout
  headers: {
    'X-Api-Key': SONARR_API_KEY,
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for better error handling
sonarrClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      logger.error('Sonarr API request timed out');
      throw new Error(
        'Sonarr API request timed out. Please check if Sonarr is running and accessible.',
      );
    }
    if (error.response) {
      if (error.response.status === 401) {
        logger.error('Invalid Sonarr API key');
        throw new Error(
          'Invalid Sonarr API key. Please check your SONARR_API_KEY environment variable.',
        );
      }
      logger.error(
        {
          status: error.response.status,
          data: error.response.data,
        },
        'Sonarr API error response',
      );
      throw new Error(
        'Sonarr API error: ' +
        error.response.status +
        ' - ' +
        JSON.stringify(error.response.data),
      );
    }
    if (error.request) {
      logger.error('No response received from Sonarr API');
      throw new Error(
        'No response from Sonarr API at ' +
        SONARR_URL +
        '. Please check if Sonarr is running and accessible.',
      );
    }
    logger.error({ error: error.message }, 'Sonarr API request failed');
    throw error;
  },
);

// Test Sonarr connection on startup
const testSonarrConnection = async () => {
  try {
    logger.info(`Testing connection to Sonarr at ${SONARR_URL}`);
    const response = await sonarrClient.get('/api/v3/system/status');
    logger.info('Successfully connected to Sonarr API');
  } catch (error) {
    logger.error('Failed to connect to Sonarr API:', error.message);
    throw error;
  }
};

// Test connection immediately
testSonarrConnection().catch((error) => {
  logger.error('Sonarr API connection test failed:', error.message);
});

// Get unimported shows from Sonarr
router.get('/unimported', async (req, res) => {
  try {
    const response = await sonarrClient.get('/api/v3/series');
    const shows = response.data;

    // Filter out shows that are already imported
    const db = req.app.get('db');
    const importedShows = db.prepare('SELECT title, path FROM shows').all();
    const importedSet = new Set(importedShows.map((show) => show.title + '|' + show.path));

    const unimportedShows = shows.filter((show) => !importedSet.has(show.title + '|' + show.path));

    res.json(unimportedShows);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to fetch unimported shows');
    res.status(500).json({
      error: 'Failed to fetch unimported shows',
      details: error.message,
    });
  }
});

// --- REFACTOR: Extract import logic to a function ---
async function importShowById(showId, req, wss, db) {
  try {
    // Send initial progress
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'import_progress',
          showId: null, // will be set after insert
          status: 'started',
          message: 'Starting import process...',
          timestamp: new Date().toISOString(),
        }));
      }
    });

    // Get show details from Sonarr
    const showResponse = await sonarrClient.get(`/api/v3/series/${showId}`);
    const show = showResponse.data;

    // Get episodes for the show
    const episodeResponse = await sonarrClient.get(`/api/v3/episode?seriesId=${showId}`);
    const episodes = episodeResponse.data;

    // Group episodes by season
    const seasons = {};
    episodes.forEach((episode) => {
      if (!seasons[episode.seasonNumber]) {
        seasons[episode.seasonNumber] = {
          seasonNumber: episode.seasonNumber,
          episodes: [],
        };
      }
      seasons[episode.seasonNumber].episodes.push(episode);
    });

    // Use a transaction for data consistency
    let dbShowId = null;
    try {
      db.transaction(() => {
        // Check if show already exists
        const existingShow = db.prepare(`
          SELECT id FROM shows WHERE title = ? AND path = ?
        `).get(show.title, show.path);

        if (existingShow) {
          // Show already exists, use existing ID
          dbShowId = existingShow.id;
        } else {
          // Insert new show
          const showResult = db.prepare(`
            INSERT INTO shows (
              title, path
            ) VALUES (?, ?)
          `).run(
            show.title,
            show.path,
          );
          dbShowId = showResult.lastInsertRowid;
        }

        // Insert seasons and episodes
        Object.values(seasons).forEach((season) => {
          const seasonResult = db.prepare(`
            INSERT OR IGNORE INTO seasons (
              show_id, season_number
            ) VALUES (?, ?)
          `).run(
            dbShowId,
            season.seasonNumber,
          );

          season.episodes.forEach((episode) => {
            db.prepare(`
              INSERT OR REPLACE INTO episodes (
                season_id, episode_number, title
              ) VALUES (?, ?, ?)
            `).run(
              seasonResult.lastInsertRowid,
              episode.episodeNumber,
              episode.title,
            );
          });
        });
      })();

      // Send completion update with local DB show id
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'import_progress',
            showId: dbShowId,
            status: 'completed',
            message: 'Import completed successfully',
            timestamp: new Date().toISOString(),
          }));
        }
      });

      return { success: true, showId: dbShowId };
    } catch (txError) {
      logger.error(
        { txError: txError.stack || txError },
        'Database transaction failed during import',
      );

      // Send error update
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'import_progress',
            showId: dbShowId,
            status: 'error',
            message: 'Import failed: ' + txError.message,
            timestamp: new Date().toISOString(),
          }));
        }
      });

      return { success: false, showId: dbShowId, error: txError.message };
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to import show');
    // Don't throw, just return error object
    return { success: false, showId: null, error: error.message };
  }
}

// --- Single import route ---
router.post('/import/:id', async (req, res) => {
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
    const wss = req.app.get('wss');
    const db = req.app.get('db');
    const result = await importShowById(showId, req, wss, db);
    if (result.success) {
      res.json({ success: true, message: 'Show imported successfully' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Batch import route ---
router.post('/import', async (req, res) => {
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
  const { showIds } = req.body;
  if (!Array.isArray(showIds) || showIds.length === 0) {
    return res.status(400).json({ error: 'showIds must be a non-empty array' });
  }
  const wss = req.app.get('wss');
  const db = req.app.get('db');
  const results = [];
  for (const showId of showIds) {
    const result = await importShowById(showId, req, wss, db);
    results.push(result);
  }
  res.json({
    importedCount: results.filter((r) => r.success).length,
    results,
  });
});

export default router;
