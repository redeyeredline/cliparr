// BullMQ-based job queue system for processing shows
// Handles job orchestration, scaling, and progress tracking
import { workerLogger } from './logger.js';
import { broadcastJobUpdate, broadcastQueueStatus } from './websocket.js';
// Import from new modules
import * as QueueManager from './queueManager.js';
import * as JobProcessor from './jobProcessor.js';
import * as QueueOperations from './queueOperations.js';
import * as DataCleanup from './dataCleanup.js';

// Get references to queues and workers from queueManager
let queues = {};
let workers = {};

// Initialize queues and workers
async function initializeQueueSystem() {
  try {
    await QueueManager.initializeQueues();
    await QueueManager.startQueues();
    // Get references to queues and workers
    queues = QueueManager.getQueues();
    workers = QueueManager.getWorkers();
    // Set references in queueOperations
    QueueOperations.setQueueReferences(queues, workers);
    workerLogger.info('Queue system initialized successfully');
  } catch (error) {
    workerLogger.error('Failed to initialize queue system:', error);
    throw error;
  }
}

// Initialize the queue system when this module is loaded
initializeQueueSystem().catch((error) => {
  workerLogger.error('Failed to initialize queue system on module load:', error);
});

// Re-export all functions from the new modules
export const {
  getWorkerLimits,
  updateQueueConfig,
  initializeQueues,
  startQueues,
  stopQueues,
  updateWorkerLimits,
  ensureQueuesInitialized,
  pauseCpuWorkers,
  resumeCpuWorkers,
  pauseGpuWorkers,
  resumeGpuWorkers,
  getQueue,
  debugQueueState,
} = QueueManager;

export const {
  processJob,
  processAudioExtraction,
  processFingerprinting,
  processDetection,
  processTrimming,
  killJobProcesses,
} = JobProcessor;

export const {
  enqueueEpisodeProcessing,
  enqueueAudioExtraction,
  enqueueFingerprinting,
  enqueueDetection,
  enqueueTrimming,
  enqueueCleanupJob,
  getQueueStatus,
  cleanAllQueues,
  removeJobFromAllQueues,
  clearAllQueues,
} = QueueOperations;

export const {
  removeFingerprintData,
  removeDetectionData,
} = DataCleanup;

// Export queues for backward compatibility
export { queues };
