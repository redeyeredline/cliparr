import { logger } from '../services/logger.js';
import {
  getDb,
  getImportMode,
  getPollingInterval,
  getImportedShows,
  processShowData,
  // You might need more functions here depending on the logic for new episodes
} from '../database/Db_Operations.js';
import fs from 'fs';
import { mapSonarrPath } from '../utils/pathMap.js';

export class ImportTaskManager {
  constructor(wss) {
    this.wss = wss;
    this.taskInterval = null;
    this.isRunning = false;
    this.shutdownRequested = false;
  }

  start() {
    if (this.taskInterval) {
      logger.warn('Import task already running');
      return;
    }

    const db = getDb();
    const mode = getImportMode(db);

    // Don't start the task if mode is 'none'
    if (mode === 'none') {
      return;
    }

    const interval = getPollingInterval(db);
    logger.info(`Starting import task with ${interval}s interval`);

    // Run initial import immediately
    this.runTask(true);

    // Then set up periodic task
    this.taskInterval = setInterval(() => this.runTask(false), interval * 1000);
    this.isRunning = true;
  }

  async stop() {
    logger.info('Stopping import task...');
    this.shutdownRequested = true;

    // Clear the interval immediately
    if (this.taskInterval) {
      clearInterval(this.taskInterval);
      this.taskInterval = null;
    }

    // Wait for any running task to complete
    while (this.isRunning) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.isRunning = false;
    this.shutdownRequested = false;
    logger.info('Import task stopped');
  }

  updateInterval() {
    const db = getDb();
    const mode = getImportMode(db);
    const newInterval = getPollingInterval(db);

    // If mode is 'none', stop the task
    if (mode === 'none') {
      if (this.taskInterval) {
        clearInterval(this.taskInterval);
        this.taskInterval = null;
      }
      return;
    }

    // Otherwise update the interval
    if (this.taskInterval) {
      clearInterval(this.taskInterval);
      this.taskInterval = setInterval(() => this.runTask(false), newInterval * 1000);
    } else {
      // If task was stopped (e.g. due to none mode), restart it
      this.start();
    }
  }

  broadcastStatus(status) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'import_status',
          ...status,
          timestamp: new Date().toISOString(),
        }));
      }
    });
  }

  async fetchFromSonarr(endpoint) {
    const response = await fetch(`${process.env.SONARR_URL}/api/v3/${endpoint}`, {
      headers: {
        'X-Api-Key': process.env.SONARR_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Sonarr API error: ${response.status}`);
    }

    return response.json();
  }

  async importShow(show, db) {
    try {
      const [showDetails, episodes, episodeFiles] = await Promise.all([
        this.fetchFromSonarr(`series/${show.id}`),
        this.fetchFromSonarr(`episode?seriesId=${show.id}`),
        this.fetchFromSonarr(`episodefile?seriesId=${show.id}`),
      ]);

      // We'll gather episodes that truly have a file after path mapping below.
      // Start with the Sonarr-supplied hasFile flag but correct it after we map files.
      let episodesWithFile = episodes.filter((ep) => ep.hasFile);

      // Map Sonarr episodeFile objects to our simplified file rows
      const files = episodeFiles
        .map((file) => {
          // Try to get episodeId directly (v4). If not present, derive via SxxEyy in relativePath.
          let epId = null;
          if (Array.isArray(file.episodeIds) && file.episodeIds.length) {
            epId = file.episodeIds[0];
          } else if (file.episodeId) {
            epId = file.episodeId;
          } else {
            // Fallback: parse SxxEyy pattern
            const searchStr = file.relativePath || file.path || '';
            const match = searchStr.match(/S(\d{2})E(\d{2})/i);
            if (match) {
              const seasonNum = parseInt(match[1], 10);
              const episodeNum = parseInt(match[2], 10);
              const epMatch = episodesWithFile.find(
                (e) => e.seasonNumber === seasonNum && e.episodeNumber === episodeNum,
              );
              if (epMatch) {
                epId = epMatch.id;
              }
            }
            // NEW: Fallback for daily shows using date-based filenames (e.g. 2023-12-01)
            if (!epId) {
              const dateMatch = searchStr.match(/(\d{4})[.\-_ ]?(\d{2})[.\-_ ]?(\d{2})/);
              if (dateMatch) {
                const dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
                const epMatch = episodes.find(
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

      // Ensure episodesWithFile contains every episode we ultimately mapped a file to.
      if (files.length) {
        const idsWithFiles = new Set(files.map((f) => f.episodeId));
        episodesWithFile = episodes.filter((ep) => idsWithFiles.has(ep.id));
      }

      logger.info({ count: episodesWithFile.length }, 'episodesWithFile');
      logger.info({ count: files.length, sample: files.slice(0, 3) }, 'files');

      // Insert into DB (episodesWithFile guarantees only real episodes)
      processShowData(db, showDetails, episodesWithFile, files);
      return true;
    } catch (error) {
      logger.error(`Failed to import show ${show.title}:`, error);
      return false;
    }
  }

  async runTask(isInitialRun = false) {
    if (this.isRunning) {
      return;
    }

    try {
      this.isRunning = true;
      const db = getDb();

      const mode = getImportMode(db);

      this.broadcastStatus({
        status: 'running',
        mode,
        isInitialRun,
        timestamp: new Date().toISOString(),
      });

      if (this.shutdownRequested) {
        return;
      }

      if (mode === 'auto' || (mode === 'import' && isInitialRun)) {
        const sonarrShows = await this.fetchFromSonarr('series');

        // Use the centralized DB function
        const { shows: importedShows } = getImportedShows(db, 1, 10000);
        const importedSet = new Set(importedShows.map((show) => show.title + '|' + show.path));

        const showsToProcess = sonarrShows.filter((show) => !importedSet.has(show.title + '|' + show.path));

        for (const show of showsToProcess) {
          if (this.shutdownRequested) {
            break;
          }
          await this.importShow(show, db);
        }
      } else if (mode === 'import' && !isInitialRun) {
        // This part needs more complex logic to check for new episodes.
        // For now, let's ensure the main import path is logged.
        // We can refactor this episode check later if needed.
        logger.info('Skipping new episode check in background task for now.');
      }

      this.broadcastStatus({
        status: 'completed',
        mode,
        isInitialRun,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error in import task:', error);
      this.broadcastStatus({
        status: 'error',
        error: error.message,
        mode: getImportMode(db),
        isInitialRun,
        timestamp: new Date().toISOString(),
      });
    } finally {
      this.isRunning = false;
    }
  }
}
