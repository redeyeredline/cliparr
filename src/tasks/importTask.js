import { logger } from '../services/logger.js';
import {
  getDb,
  getImportMode,
  getPollingInterval,
  getImportedShows,
  processShowData,
  // You might need more functions here depending on the logic for new episodes
} from '../database/Db_Operations.js';

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
      const [showDetails, episodes] = await Promise.all([
        this.fetchFromSonarr(`series/${show.id}`),
        this.fetchFromSonarr(`episode?seriesId=${show.id}`),
      ]);

      // All DB logic is now in one performance-logged function call
      processShowData(db, showDetails, episodes, []);
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
