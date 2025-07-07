// Background import task manager that periodically syncs shows from Sonarr to local database.
// Handles automatic import scheduling, episode mapping, and WebSocket status broadcasting.
import { appLogger } from '../services/logger.js';
import {
  getDb,
  getImportMode,
  getPollingInterval,
  getImportedShows,
  processShowData,
  getSetting,
} from '../database/Db_Operations.js';
import { mapSonarrPath } from '../utils/pathMap.js';
import WebSocket from 'ws';

export class ImportTaskManager {
  constructor(wss) {
    this.wss = wss;
    this.taskInterval = null;
    this.isRunning = false;
    this.shutdownRequested = false;
  }

  async start() {
    if (this.taskInterval) {
      appLogger.warn('Import task already running');
      return;
    }

    const db = await getDb();
    const mode = getImportMode(db);
    appLogger.info(`Import mode from database: ${mode}`);

    // Don't start the task if mode is 'none'
    if (mode === 'none') {
      appLogger.info('Import mode is "none"; not starting import task');
      return;
    }

    // Check if Sonarr is configured before starting
    const sonarrUrl = getSetting(db, 'sonarr_url', '');
    const sonarrApiKey = getSetting(db, 'sonarr_api_key', '');
    appLogger.info(
      `Sonarr URL configured: ${sonarrUrl ? 'yes' : 'no'}, API key configured: ${sonarrApiKey ? 'yes' : 'no'}`,
    );

    if (!sonarrUrl || !sonarrApiKey) {
      appLogger.info('Sonarr not configured; not starting import task');
      return;
    }

    // Test Sonarr connectivity before starting import task
    let connectivityTestPassed = false;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        appLogger.info(`Testing Sonarr connectivity (attempt ${attempt}/${maxRetries})...`);
        const testResponse = await fetch(`${sonarrUrl.replace(/\/$/, '')}/api/v3/system/status`, {
          headers: {
            'X-Api-Key': sonarrApiKey,
            'Content-Type': 'application/json',
          },
          timeout: 5000, // 5 second timeout
        });

        if (testResponse.ok) {
          appLogger.info('Sonarr API connectivity test successful');
          connectivityTestPassed = true;
          break;
        } else {
          appLogger.warn(`Sonarr API test failed with status ${testResponse.status} (attempt ${attempt}/${maxRetries})`);
        }
      } catch (error) {
        appLogger.warn(`Sonarr API connectivity test failed: ${error.message} (attempt ${attempt}/${maxRetries})`);
      }

      if (attempt < maxRetries) {
        appLogger.info(`Retrying Sonarr connectivity test in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    if (!connectivityTestPassed) {
      appLogger.warn('Sonarr API connectivity test failed after all retries; not starting import task');
      return;
    }

    const interval = getPollingInterval(db);
    appLogger.info(`Starting import task with ${interval}s interval`);

    // Run initial import immediately (but it will handle errors gracefully now)
    try {
      await this.runTask(true);
    } catch (error) {
      appLogger.info('Initial import task failed, but continuing with scheduled tasks:', error.message);
    }

    // Then set up periodic task
    this.taskInterval = setInterval(() => this.runTask(false), interval * 1000);
    this.isRunning = true;
  }

  async stop() {
    appLogger.info('Stopping import task...');
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
    appLogger.info('Import task stopped');
  }

  async updateInterval() {
    const db = await getDb();
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
      await this.start();
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

  async fetchFromSonarr(endpoint, db) {
    const sonarrUrl = getSetting(db, 'sonarr_url', '');
    const sonarrApiKey = getSetting(db, 'sonarr_api_key', '');
    if (!sonarrUrl || !sonarrApiKey) {
      appLogger.info('Sonarr URL or API key not set in DB; skipping Sonarr API call.');
      return null;
    }
    const url = `${sonarrUrl.replace(/\/$/, '')}/api/v3/${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'X-Api-Key': sonarrApiKey,
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
      // Use DB settings for Sonarr URL/API key
      const sonarrUrl = getSetting(db, 'sonarr_url', '');
      const sonarrApiKey = getSetting(db, 'sonarr_api_key', '');
      if (!sonarrUrl || !sonarrApiKey) {
        // Only log if Sonarr is not configured
        appLogger.info(`Sonarr URL or API key not set in DB; skipping import for show: ${show.title}`);
        return true;
      }

      const [showDetails, episodes, episodeFiles] = await Promise.all([
        this.fetchFromSonarr(`series/${show.id}`, db),
        this.fetchFromSonarr(`episode?seriesId=${show.id}`, db),
        this.fetchFromSonarr(`episodefile?seriesId=${show.id}`, db),
      ]);

      if (!showDetails || !episodes || !episodeFiles) {
        // Only log if Sonarr API is not configured
        appLogger.info(`Sonarr API not configured; skipping import for show: ${show.title}`);
        return true;
      }

      let episodesWithFile = episodes.filter((ep) => ep.hasFile);

      const files = episodeFiles
        .map((file) => {
          let epId = null;
          if (Array.isArray(file.episodeIds) && file.episodeIds.length) {
            epId = file.episodeIds[0];
          } else if (file.episodeId) {
            epId = file.episodeId;
          } else {
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

      if (files.length) {
        const idsWithFiles = new Set(files.map((f) => f.episodeId));
        episodesWithFile = episodes.filter((ep) => idsWithFiles.has(ep.id));
      }

      // If there are no files to import, skip silently
      if (!files.length) {
        return true;
      }

      processShowData(db, showDetails, episodesWithFile, files);
      return true;
    } catch (error) {
      const msg = String(error);
      if (msg.includes('UNIQUE constraint failed') || msg.toLowerCase().includes('constraint')) {
        // Only log constraint errors
        appLogger.info(`No new data to import for show: ${show.title} (constraint)`);
        return true;
      }
      if (msg.includes('404')) {
        appLogger.info(`Show not found in Sonarr: ${show.title} (404)`);
        return true;
      }
      appLogger.error(`Failed to import show ${show.title}:`, error);
      return false;
    }
  }

  async runTask(isInitialRun = false) {
    if (this.isRunning) {
      return;
    }

    try {
      this.isRunning = true;
      const db = await getDb();

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

      // Check if Sonarr is configured before attempting any API calls
      const sonarrUrl = getSetting(db, 'sonarr_url', '');
      const sonarrApiKey = getSetting(db, 'sonarr_api_key', '');

      if (!sonarrUrl || !sonarrApiKey) {
        appLogger.info('Sonarr not configured; skipping import task');
        this.broadcastStatus({
          status: 'completed',
          mode,
          isInitialRun,
          message: 'Sonarr not configured',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Test Sonarr connectivity before proceeding
      try {
        const testResponse = await fetch(`${sonarrUrl.replace(/\/$/, '')}/api/v3/system/status`, {
          headers: {
            'X-Api-Key': sonarrApiKey,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        });

        if (!testResponse.ok) {
          appLogger.warn(`Sonarr API not available (status ${testResponse.status}); skipping import task`);
          this.broadcastStatus({
            status: 'completed',
            mode,
            isInitialRun,
            message: `Sonarr API not available (${testResponse.status})`,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      } catch (error) {
        appLogger.warn(`Sonarr API connectivity failed: ${error.message}; skipping import task`);
        this.broadcastStatus({
          status: 'completed',
          mode,
          isInitialRun,
          message: `Sonarr API connectivity failed: ${error.message}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (mode === 'auto') {
        // AUTO: Import all unimported shows
        try {
          const sonarrShows = await this.fetchFromSonarr('series', db);
          if (!sonarrShows) {
            appLogger.info('Sonarr API not available; skipping auto import');
            return;
          }
          const { shows: importedShows } = getImportedShows(db, 1, 10000);
          const importedSet = new Set(importedShows.map((show) => show.title + '|' + show.path));
          const showsToProcess = sonarrShows.filter((show) => !importedSet.has(show.title + '|' + show.path));

          for (const show of showsToProcess) {
            if (this.shutdownRequested) {
              break;
            }
            await this.importShow(show, db);
          }
        } catch (error) {
          appLogger.info('Sonarr API error during auto import; skipping:', error.message);
          return;
        }
      } else if (mode === 'import') {
        // IMPORT: Only check for new episodes for already imported shows
        const { shows: importedShows } = getImportedShows(db, 1, 10000);
        if (importedShows.length === 0) {
          appLogger.info('No shows imported; nothing to do in import mode.');
        } else {
          for (const show of importedShows) {
            if (this.shutdownRequested) {
              break;
            }
            await this.importShow(show, db);
          }
        }
      }

      this.broadcastStatus({
        status: 'completed',
        mode,
        isInitialRun,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      appLogger.error('Error in import task:', error);
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
