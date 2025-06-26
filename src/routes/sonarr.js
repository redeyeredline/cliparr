// Sonarr API integration routes for importing shows and syncing with external Sonarr instance.
// Handles show import process, episode mapping, and WebSocket progress notifications.

import express from 'express';
import axios from 'axios';
import { logger } from '../services/logger.js';
import dotenv from 'dotenv';
import process from 'process';
import WebSocket from 'ws';
import {
  getImportedShows,
  findShowByTitleAndPath,
  processShowData,
  getSetting,
} from '../database/Db_Operations.js';
import { mapSonarrPath } from '../utils/pathMap.js';

// Load environment variables
dotenv.config();
const router = express.Router();

// Get unimported shows from Sonarr
router.get('/unimported', async (req, res) => {
  try {
    const db = req.app.get('db');
    const sonarrClient = await getSonarrClient(db);
    const { data: allSonarrShows } = await sonarrClient.get('/api/v3/series');

    // Filter out shows that are already imported
    const { shows: importedShows } = getImportedShows(db, 1, 10000);
    const importedSet = new Set(importedShows.map((show) => show.title + '|' + show.path));

    const unimportedShows = allSonarrShows.filter((show) => !importedSet.has(show.title + '|' + show.path));

    // Fetch episode counts for each unimported show
    const showsWithEpisodeCounts = await Promise.all(
      unimportedShows.map(async (show) => {
        let episodeCount = 0;
        let episodeFileCount = 0;
        try {
          const { data: episodes } = await sonarrClient.get(`/api/v3/episode?seriesId=${show.id}`);
          episodeCount = Array.isArray(episodes) ? episodes.length : 0;
        } catch (err) {
          episodeCount = 0;
        }
        // Use statistics.episodeFileCount if available
        if (show.statistics && typeof show.statistics.episodeFileCount === 'number') {
          episodeFileCount = show.statistics.episodeFileCount;
        }
        return { ...show, episodeCount, episodeFileCount };
      }),
    );

    res.json(showsWithEpisodeCounts);
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to fetch unimported shows');
    res.status(500).json({ error: 'Failed to fetch unimported shows', details: error.message });
  }
});

async function getSonarrClient(db) {
  const sonarr_url = getSetting(db, 'sonarr_url', 'http://localhost:8989');
  const sonarr_api_key = getSetting(db, 'sonarr_api_key', '');
  return axios.create({
    baseURL: sonarr_url,
    timeout: 15000,
    headers: {
      'X-Api-Key': sonarr_api_key,
      'Content-Type': 'application/json',
    },
  });
}

// --- REFACTOR: Extract import logic to a function ---
async function importShowById(showId, req, wss, db) {
  let dbShowId = null;
  try {
    const sonarrClient = await getSonarrClient(db);
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

    const showResponse = await sonarrClient.get(`/api/v3/series/${showId}`);
    const show = showResponse.data;

    const episodeResponse = await sonarrClient.get(`/api/v3/episode?seriesId=${showId}`);
    const allEpisodes = episodeResponse.data;

    const fileResponse = await sonarrClient.get(`/api/v3/episodefile?seriesId=${showId}`);
    const episodeFiles = fileResponse.data;

    // Start with Sonarr's hasFile flag but we'll correct it after mapping
    let episodes = allEpisodes.filter((ep) => ep.hasFile);

    // Build episodeId -> episodeNumber map
    const idToNumber = new Map();
    episodes.forEach((ep) => idToNumber.set(ep.id, ep.episodeNumber));

    // Map files
    const files = episodeFiles
      .map((file) => {
        let epId = null;
        if (Array.isArray(file.episodeIds) && file.episodeIds.length) {
          epId = file.episodeIds[0];
        } else if (file.episodeId) {
          epId = file.episodeId;
        } else {
          // Fallback 1: parse SxxEyy pattern
          const searchStr = file.relativePath || file.path || '';
          const m = searchStr.match(/S(\d{2})E(\d{2})/i);
          if (m) {
            const sNum = parseInt(m[1], 10);
            const eNum = parseInt(m[2], 10);
            const epMatch = episodes.find((e) => e.seasonNumber === sNum && e.episodeNumber === eNum);
            if (epMatch) {
              epId = epMatch.id;
            }
          }
          // Fallback 2: date-based filenames (YYYY-MM-DD, YYYY.MM.DD, etc.)
          if (!epId) {
            const dMatch = searchStr.match(/(\d{4})[.\-_ ]?(\d{2})[.\-_ ]?(\d{2})/);
            if (dMatch) {
              const dateStr = `${dMatch[1]}-${dMatch[2]}-${dMatch[3]}`;
              const epMatch = allEpisodes.find(
                (e) =>
                  (e.airDate && e.airDate.startsWith(dateStr)) ||
                  (e.airDateUtc && e.airDateUtc.startsWith(dateStr)),
              );
              if (epMatch) {
                epId = epMatch.id;
              }
            }
          }
        }
        if (!epId) {
          return null;
        }
        const hostPath = mapSonarrPath(file.path || file.relativePath || '');
        return {
          episodeId: epId,
          path: hostPath,
          size: file.size || 0,
        };
      })
      .filter((v) => v !== null);

    // Ensure episode list contains every episode we matched files against
    if (files.length) {
      const idsWithFiles = new Set(files.map((f) => f.episodeId));
      episodes = allEpisodes.filter((ep) => idsWithFiles.has(ep.id));
    }

    // All DB logic is now in one performance-logged function call
    processShowData(db, show, episodes, files);

    // Get the ID of the show we just processed for websocket reporting
    const newShow = findShowByTitleAndPath(db, show.title, show.path);
    dbShowId = newShow ? newShow.id : null;

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
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Failed to import show');
    // Send error update
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'import_progress',
          showId: dbShowId,
          status: 'error',
          message: 'Import failed: ' + error.message,
          timestamp: new Date().toISOString(),
        }));
      }
    });
    return { success: false, showId: dbShowId, error: error.message };
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
