import { logger } from '../services/logger.js';
import { getDb, getImportMode, getPollingInterval } from '../database/Db_Operations.js';

class ImportTaskManager {
  constructor(wss) {
    this.wss = wss;
    this.taskInterval = null;
    this.isRunning = false;
  }

  start() {
    if (this.taskInterval) {
      logger.warn('Import task already running');
      return;
    }

    const db = getDb();
    const interval = getPollingInterval(db);
    logger.info(`Starting import task with ${interval}s interval`);

    this.taskInterval = setInterval(() => this.runTask(), interval * 1000);
    this.isRunning = true;
  }

  stop() {
    if (this.taskInterval) {
      clearInterval(this.taskInterval);
      this.taskInterval = null;
      this.isRunning = false;
      logger.info('Import task stopped');
    }
  }

  updateInterval() {
    const db = getDb();
    const newInterval = getPollingInterval(db);

    if (this.taskInterval) {
      clearInterval(this.taskInterval);
      this.taskInterval = setInterval(() => this.runTask(), newInterval * 1000);
      logger.info(`Updated import task interval to ${newInterval}s`);
    }
  }

  broadcastStatus(status) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'import_status',
          data: status,
        }));
      }
    });
  }

  async runTask() {
    if (this.isRunning) {
      logger.debug('Previous task still running, skipping');
      return;
    }

    this.isRunning = true;
    const db = getDb();

    try {
      const mode = getImportMode(db);
      logger.info(`Running import task in ${mode} mode`);

      this.broadcastStatus({
        status: 'running',
        mode,
        timestamp: new Date().toISOString(),
      });

      // TODO: Implement actual import logic based on mode
      // For now, just simulate some work
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.broadcastStatus({
        status: 'completed',
        mode,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Import task failed:', error);
      this.broadcastStatus({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    } finally {
      this.isRunning = false;
    }
  }
}

export default ImportTaskManager;
