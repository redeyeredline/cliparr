import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ProcessingJob,
  ProcessingJobEntity,
  MediaFile,
  MediaFileEntity,
  AudioAnalysis,
  AudioAnalysisEntity,
} from '@/components/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProcessingQueue from '../components/processing/ProcessingQueue';
import AudioAnalyzer from '../components/processing/AudioAnalyzer';
import ProcessingMonitor from '../components/processing/ProcessingMonitor';
import BatchProcessor from '../components/processing/BatchProcessor';
import QueueStatus from '../components/processing/QueueStatus';
import { wsClient } from '../services/websocket.frontend.js';
import { useToast } from '../components/ToastContext';
import { Trash2 } from 'lucide-react';
import { apiClient } from '../integration/api-client';
import { Button } from '@/components/ui/button';
import { filterJobsByCategory, JobCategory } from '@/utils/jobFilters.tsx';

type ProcessingJobStatus =
  | 'detected'
  | 'verified'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'scanning';

interface CurrentFile {
  fileId: string | number;
  filePath: string;
  episode?: string;
  season?: number;
  show?: string;
}

// Rename the interface to 'QueueStatusType' to avoid conflict with the QueueStatus component.
interface QueueStatusType {
  name: string;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
}

export default function Processing() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [audioAnalyses, setAudioAnalyses] = useState<AudioAnalysis[]>([]);
  // Remove activeProcesses state, use derived values instead
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Update the state type
  const [queueStatus, setQueueStatus] = useState<QueueStatusType[]>([]);
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const toast = useToast();
  const [jobProgress, setJobProgress] = useState<
    Record<string, { progress: number; fps: number; currentFile: CurrentFile; updated: number }>
  >({});

  // Optimized job updates to prevent excessive re-renders
  const jobUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingJobUpdates = useRef<Map<string, any>>(new Map());
  const animationFrameRef = useRef<number | null>(null);

  const debouncedUpdateJobs = useCallback(() => {
    if (jobUpdateTimeoutRef.current) {
      clearTimeout(jobUpdateTimeoutRef.current);
    }
    
    jobUpdateTimeoutRef.current = setTimeout(() => {
      if (pendingJobUpdates.current.size > 0) {
        // Use requestAnimationFrame for optimal rendering performance
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        animationFrameRef.current = requestAnimationFrame(() => {
          setJobs((prevJobs) => {
            const updated = [...prevJobs];
            pendingJobUpdates.current.forEach((update, jobId) => {
              const index = updated.findIndex(job => normalizeId(job.id) === jobId);
              if (index !== -1) {
                // Only update if there are actual changes to prevent unnecessary re-renders
                const currentJob = updated[index];
                const hasChanges = Object.keys(update).some(key => 
                  currentJob[key as keyof ProcessingJob] !== update[key]
                );
                if (hasChanges) {
                  updated[index] = { ...currentJob, ...update };
                }
              }
            });
            pendingJobUpdates.current.clear();
            return updated;
          });
        });
      }
    }, 2000); // Increased debounce to 2 seconds to prevent excessive re-renders
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [jobsData, filesData, audioData] = await Promise.all([
        ProcessingJobEntity.list('-created_date'),
        MediaFileEntity.list('-created_date'),
        AudioAnalysisEntity.list('-created_date', 20),
      ]);
      setJobs(jobsData);
      setMediaFiles(filesData);
      setAudioAnalyses(audioData);
    } catch {
      console.error('Error loading processing data:');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derive job lists for each tab/category
  const now = Date.now();
  // Determine jobs that are truly "running" based on recent progress heartbeat
  const activeProcesses = jobs.filter(
    (j) =>
      j.status === 'processing' &&
      (!jobProgress[j.id as string | number] ||
        now - jobProgress[j.id as string | number].updated < 20000)
  );
  const queuedJobs = filterJobsByCategory(jobs, 'queued');
  const completedJobs = filterJobsByCategory(jobs, 'completed');
  const failedJobs = filterJobsByCategory(jobs, 'failed');

  // Limit displayed active processes to the number of concurrently running workers
  const episodeQueueStatus = queueStatus.find((q) => q.name === 'episode-processing');
  const activeWorkerLimit = episodeQueueStatus?.active ?? 1; // default to 1 worker if unknown
  const displayedActiveProcesses = activeProcesses.slice(0, Math.max(activeWorkerLimit, 1));

  // Helper to normalize job IDs (strip 'epjob-' prefix)
  const normalizeId = useCallback((id: string | number | undefined) =>
    id ? id.toString().replace(/^epjob-/, '') : '', []);

  // WebSocket event handlers
  useEffect(() => {
    // Throttle WebSocket updates to prevent excessive re-renders
    let lastUpdateTime = 0;
    const UPDATE_THROTTLE_MS = 5000; // Only update once per 5 seconds to reduce re-renders
    
    // Add a simple message logger to debug all incoming messages
    const handleAllMessages = (_data: unknown) => {
      /* intentionally left blank */
    };

    const handleJobUpdate = (data: unknown) => {
      // Throttle updates to prevent excessive re-renders
      const now = Date.now();
      if (now - lastUpdateTime < UPDATE_THROTTLE_MS) {
        return; // Skip this update if too soon
      }
      lastUpdateTime = now;
      
      // Handle job updates - these come directly without a 'type' field
      if (data && typeof data === 'object' && 'dbJobId' in data && 'status' in data) {
        const jobData = data as {
          dbJobId: string | number;
          status: ProcessingJobStatus;
          progress?: number;
          fps?: number;
          currentFile?: CurrentFile;
          error?: string;
          result?: { message?: string };
        };

        if (jobData.dbJobId && jobData.status) {
          // Check if this job exists in our current jobs array (normalize IDs)
          const existingJob = jobs.find((j) => normalizeId(j.id) === normalizeId(jobData.dbJobId));

          // If job doesn't exist in our array, add it to the jobs array instead of reloading
          if (!existingJob) {
            // Create a minimal job object for the new job
            const newJob = {
              id: jobData.dbJobId,
              status: jobData.status,
              processing_notes: jobData.error || jobData.result?.message || '',
              updated_date: new Date().toISOString(),
              created_date: new Date().toISOString(),
              media_file_id: 0, // Will be updated when we get more data
            } as ProcessingJob;
            
            setJobs(prevJobs => [newJob, ...prevJobs]);
            return; // Exit early, the new job is now in the array
          }

          // Track real-time progress/fps for processing jobs with immediate updates
          if (jobData.status === 'processing' && jobData.progress !== undefined) {
            setJobProgress((prev) => {
              const jobId = normalizeId(jobData.dbJobId) || '';
              const existingProgress = prev[jobId];
              
              // Only update if progress has actually changed to prevent unnecessary re-renders
              if (!existingProgress || 
                  existingProgress.progress !== jobData.progress ||
                  existingProgress.fps !== jobData.fps) {
                return {
                  ...prev,
                  [jobId]: {
                    progress: jobData.progress,
                    fps: jobData.fps,
                    currentFile: jobData.currentFile,
                    updated: Date.now(),
                  },
                };
              }
              return prev;
            });
          }
          // Remove progress for jobs that are completed/failed
          if (['completed', 'failed'].includes(jobData.status)) {
            setJobProgress((prev) => {
              const copy = { ...prev };
              delete copy[normalizeId(jobData.dbJobId) || ''];
              return copy;
            });
          }
          // Use debounced job updates to prevent excessive re-renders
          const jobId = normalizeId(jobData.dbJobId);
          pendingJobUpdates.current.set(jobId, {
            status: jobData.status,
            processing_notes: jobData.error || jobData.result?.message || '',
            updated_date: new Date().toISOString(),
          });
          debouncedUpdateJobs();

          // Show toast notification for important updates
          if (jobData.status === 'completed') {
            toast({
              type: 'success',
              message: `Job ${jobData.dbJobId} completed successfully`,
            });
          } else if (jobData.status === 'failed') {
            toast({
              type: 'error',
              message: `Job ${jobData.dbJobId} failed: ${jobData.error || jobData.result?.message || (jobData as Record<string, unknown>).message}`,
            });
          } else if (String(jobData.status) === 'active') {
            toast({
              type: 'info',
              message: `Job ${jobData.dbJobId} started processing`,
            });
          }
        }

        // Handle legacy job_update type messages (for backward compatibility)
        if (
          data &&
          typeof data === 'object' &&
          'type' in data &&
          'dbJobId' in data &&
          'status' in data
        ) {
          const legacyJobData = data as {
            type: string;
            dbJobId: string | number;
            status: ProcessingJobStatus;
            progress?: number;
            fps?: number;
            currentFile?: CurrentFile;
            error?: string;
            result?: { message?: string };
          };

          if (legacyJobData.type === 'job_update') {
            // Check if this job exists in our current jobs array (normalize IDs)
            const existingJob = jobs.find(
              (j) => normalizeId(j.id) === normalizeId(legacyJobData.dbJobId),
            );

            // If job doesn't exist in our array, add it to the jobs array instead of reloading
            if (!existingJob) {
              // Create a minimal job object for the new job
              const newJob = {
                id: legacyJobData.dbJobId,
                status: legacyJobData.status,
                processing_notes: legacyJobData.error || legacyJobData.result?.message || '',
                updated_date: new Date().toISOString(),
                created_date: new Date().toISOString(),
                media_file_id: 0, // Will be updated when we get more data
              } as ProcessingJob;
              
              setJobs(prevJobs => [newJob, ...prevJobs]);
              return; // Exit early, the new job is now in the array
            }

            // Track real-time progress/fps for processing jobs
            if (legacyJobData.status === 'processing' && legacyJobData.progress !== undefined) {
              setJobProgress((prev) => {
                const jobId = normalizeId(legacyJobData.dbJobId) || '';
                const existingProgress = prev[jobId];
                
                // Only update if progress has actually changed to prevent unnecessary re-renders
                if (!existingProgress || 
                    existingProgress.progress !== legacyJobData.progress ||
                    existingProgress.fps !== legacyJobData.fps) {
                  return {
                    ...prev,
                    [jobId]: {
                      progress: legacyJobData.progress,
                      fps: legacyJobData.fps,
                      currentFile: legacyJobData.currentFile,
                      updated: Date.now(),
                    },
                  };
                }
                return prev;
              });
            }
            // Remove progress for jobs that are completed/failed
            if (['completed', 'failed'].includes(legacyJobData.status)) {
              setJobProgress((prev) => {
                const copy = { ...prev };
                delete copy[normalizeId(legacyJobData.dbJobId) || ''];
                return copy;
              });
            }
            // Use debounced job updates to prevent excessive re-renders
            const jobId = normalizeId(legacyJobData.dbJobId);
            pendingJobUpdates.current.set(jobId, {
              status: legacyJobData.status,
              processing_notes: legacyJobData.error || legacyJobData.result?.message || '',
              updated_date: new Date().toISOString(),
            });
            debouncedUpdateJobs();

            // Show toast notification for important updates
            if (legacyJobData.status === 'completed') {
              toast({
                type: 'success',
                message: `Job ${legacyJobData.dbJobId} completed successfully`,
              });
            } else if (legacyJobData.status === 'failed') {
              toast({
                type: 'error',
                message: `Job ${legacyJobData.dbJobId} failed: ${legacyJobData.error}`,
              });
            } else if (String(legacyJobData.status) === 'active') {
              toast({
                type: 'info',
                message: `Job ${legacyJobData.dbJobId} started processing`,
              });
            }
          }
        }
      }
    };

    const handleQueueStatus = (data: unknown) => {
      // Throttle queue status updates
      const now = Date.now();
      if (now - lastUpdateTime < UPDATE_THROTTLE_MS) {
        return; // Skip this update if too soon
      }
      lastUpdateTime = now;
      
      if (data && typeof data === 'object' && 'type' in data && 'queues' in data) {
        const queueData = data as { type: string; queues: QueueStatusType[] };
        if (queueData.type === 'queue_status') {
          setQueueStatus(queueData.queues);
        }
      }
    };

    const handleProcessingStatus = (data: unknown) => {
      // Throttle processing status updates
      const now = Date.now();
      if (now - lastUpdateTime < UPDATE_THROTTLE_MS) {
        return; // Skip this update if too soon
      }
      lastUpdateTime = now;
      
      if (data && typeof data === 'object' && 'type' in data && 'processing_status' in data) {
        const processingData = data as { type: string; processing_status: QueueStatusType[] };
        if (processingData.type === 'processing_status') {
          // Update processing status
          setQueueStatus(processingData.processing_status);
        }
      }
    };

    // Add WebSocket event listeners
    wsClient.addEventListener('message', handleAllMessages);
    wsClient.addEventListener('message', handleJobUpdate);
    wsClient.addEventListener('message', handleQueueStatus);
    wsClient.addEventListener('message', handleProcessingStatus);
    wsClient.addEventListener('open', () => {
      // intentionally left blank
    });
    wsClient.addEventListener('close', () => {
      // intentionally left blank
    });
    wsClient.addEventListener('error', (_e: Event) => {
      /* intentionally left blank */
    });

    // Ensure WebSocket is connected
    wsClient.connect();

    return () => {
      // Clean up event listeners
      wsClient.removeEventListener('message', handleAllMessages);
      wsClient.removeEventListener('message', handleJobUpdate);
      wsClient.removeEventListener('message', handleQueueStatus);
      wsClient.removeEventListener('message', handleProcessingStatus);
      
      // Clean up timeout
      if (jobUpdateTimeoutRef.current) {
        clearTimeout(jobUpdateTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [toast, jobs, loadData]);

  // useEffect(() => {
  //   loadData();
  //   const intervalId = setInterval(loadData, 10000); // Poll every 10 seconds for updates
  //   return () => clearInterval(intervalId);
  // }, []);

  const startBatchProcessing = async (jobIds: (string | number)[], profileId: string | number) => {
    try {
      await Promise.all(
        jobIds.map((id) =>
          ProcessingJobEntity.update(id, {
            status: 'processing',
            processing_notes: `Batch processing started with profile ${profileId}`,
          }),
        ),
      );
      // Update the jobs in the local array instead of reloading
      setJobs(prevJobs => 
        prevJobs.map(job => 
          jobIds.includes(job.id)
            ? { ...job, status: 'processing', processing_notes: `Batch processing started with profile ${profileId}` }
            : job
        )
      );
    } catch {
      console.error('Error starting batch processing:');
    }
  };

  const stopProcessing = async (jobId: string | number) => {
    try {
      await ProcessingJobEntity.update(jobId, {
        status: 'detected',
        processing_notes: 'Processing stopped by user',
      });
      // Update the job in the local array instead of reloading
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === jobId 
            ? { ...job, status: 'detected', processing_notes: 'Processing stopped by user' }
            : job
        )
      );
    } catch {
      console.error('Error stopping processing:');
    }
  };

  // Update handleDeleteJob to use selected
  const handleDeleteJob = async (jobId: string | number) => {
    try {
      await ProcessingJobEntity.delete(jobId);
      setSelected((ids) => ids.filter((id) => id !== jobId));
      // Remove the job from the local array instead of reloading
      setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
      toast({ type: 'success', message: 'Job deleted' });
    } catch {
      toast({ type: 'error', message: 'Failed to delete job' });
    }
  };

  // Bulk delete for selected jobs
  const handleBulkDelete = async () => {
    setBulkDeleteLoading(true);
    try {
      let cleanupJobId = null;
      if (selected.length === jobs.length && jobs.length > 0) {
        const result = await ProcessingJobEntity.bulkDelete({ all: true });
        if (typeof result === 'string') {
          cleanupJobId = result;
        }
      } else {
        const result = await ProcessingJobEntity.bulkDelete({ jobIds: selected });
        if (typeof result === 'string') {
          cleanupJobId = result;
        }
      }
      setSelected([]);
      if (cleanupJobId) {
        // Poll for cleanup job status
        let done = false;
        let lastState = '';
        while (!done) {
          try {
            const status = await apiClient.getCleanupJobStatus(cleanupJobId);
            if (status.state === 'completed') {
              done = true;
              toast({ type: 'success', message: 'Bulk delete completed!' });
              break;
            } else if (status.state === 'failed') {
              done = true;
              toast({
                type: 'error',
                message: `Bulk delete failed: ${status.failedReason || 'Unknown error'}`,
              });
              break;
            } else {
              if (status.state !== lastState) {
                lastState = status.state;
                toast({ type: 'info', message: `Bulk delete status: ${status.state}` });
              }
            }
          } catch (err) {
            // If 404, treat as completed and stop polling (do not log or toast)
            if (
              err &&
              typeof err === 'object' &&
              'response' in err &&
              err.response &&
              typeof err.response === 'object' &&
              'status' in err.response &&
              typeof err.response.status === 'number' &&
              err.response.status === 404
            ) {
              done = true;
              // No toast, no log for 404
              break;
            } else if (
              err &&
              typeof err === 'object' &&
              'response' in err &&
              err.response &&
              typeof err.response === 'object' &&
              'status' in err.response &&
              typeof err.response.status === 'number' &&
              err.response.status >= 500
            ) {
              done = true;
              toast({ type: 'error', message: 'Server error during cleanup.' });
              break;
            } else {
              // Network or unknown error
              done = true;
              toast({ type: 'error', message: 'Unknown error during cleanup.' });
              break;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        // Remove deleted jobs from the local array instead of reloading
        setJobs(prevJobs => prevJobs.filter(job => !selected.includes(job.id)));
      } else {
        // Remove deleted jobs from the local array instead of reloading
        setJobs(prevJobs => prevJobs.filter(job => !selected.includes(job.id)));
        toast({ type: 'success', message: 'Selected jobs deleted' });
      }
    } catch {
      toast({ type: 'error', message: 'Failed to delete jobs' });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // Fetch worker limits on mount
  useEffect(() => {
    const fetchWorkerLimits = async () => {
      try {
        await apiClient.getAllSettings();
      } catch {
        // ignore
      }
    };
    fetchWorkerLimits();
  }, []);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="flex-1 overflow-auto p-6">
        <div className="min-h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-white">Processing</h1>
            </div>

          </div>
          {/* Queue Status Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 flex-shrink-0">
            <div className="lg:col-span-2">
              <QueueStatus queueStatus={queueStatus} />
            </div>
            <div className="space-y-4">
              {/* Active Processes Summary */}
              <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold text-white">
                    Active Processes ({displayedActiveProcesses.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {displayedActiveProcesses.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">No active processes</p>
                  ) : (
                    <div className="space-y-2">
                      {displayedActiveProcesses.map((process) => (
                        <div
                          key={process.id}
                          className="p-2 bg-slate-900/50 rounded-lg border border-slate-700"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white font-medium">
                              {mediaFiles.find((f) => f.id === process.media_file_id)?.file_name ||
                                'Unknown'}
                            </span>
                            <span className="text-xs text-slate-400">{process.status}</span>
                          </div>
                          {process.processing_notes && (
                            <p className="text-xs text-slate-500 mt-1">
                              {process.processing_notes}
                            </p>
                          )}
                        </div>
                      ))}
                      {activeProcesses.length > displayedActiveProcesses.length && (
                        <p className="text-xs text-slate-500 text-center">
                          +{activeProcesses.length - 5} more processes
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Tabs and Job Queue fill all remaining vertical space */}
          <div className="flex-1 flex flex-col min-h-0">
            <Tabs defaultValue="queue" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-4 bg-slate-800/90 backdrop-blur-md border border-slate-700">
                <TabsTrigger value="queue" className="text-white">
                  All Jobs
                </TabsTrigger>
                <TabsTrigger value="monitor" className="text-white">
                  Monitor
                </TabsTrigger>
                <TabsTrigger value="analyzer" className="text-white">
                  Analyzer
                </TabsTrigger>
                <TabsTrigger value="batch" className="text-white">
                  Batch
                </TabsTrigger>
              </TabsList>

              <TabsContent value="queue" className="flex-1 flex flex-col min-h-0 mt-6">
                <div className="flex-1 flex flex-col min-h-0 overflow-auto">
                  <ProcessingQueue
                    jobs={jobs}
                    mediaFiles={mediaFiles}
                    profiles={[]} // Removed profiles prop
                    onStopProcessing={stopProcessing}
                    isLoading={isLoading}
                    onDeleteJob={handleDeleteJob}
                    selected={selected}
                    setSelected={setSelected}
                    onBulkDelete={handleBulkDelete}
                    bulkDeleteLoading={bulkDeleteLoading}
                    jobProgress={jobProgress}
                  />
                </div>
              </TabsContent>

              <TabsContent value="monitor" className="flex-1 flex flex-col min-h-0 mt-6">
                <div className="flex-1 flex flex-col min-h-0 overflow-auto">
                  <ProcessingMonitor
                    activeProcesses={displayedActiveProcesses}
                    mediaFiles={mediaFiles}
                    jobProgress={jobProgress}
                    onStopProcessing={stopProcessing}
                    onDeleteJob={handleDeleteJob}
                  />
                </div>
              </TabsContent>

              <TabsContent value="analyzer" className="flex-1 flex flex-col min-h-0 mt-6">
                <div className="flex-1 flex flex-col min-h-0 overflow-auto">
                  <AudioAnalyzer
                    audioAnalyses={audioAnalyses}
                    mediaFiles={mediaFiles}
                    onRefresh={loadData}
                  />
                </div>
              </TabsContent>

              <TabsContent value="batch" className="flex-1 flex flex-col min-h-0 mt-6">
                <div className="flex-1 flex flex-col min-h-0 overflow-auto">
                  <BatchProcessor
                    jobs={queuedJobs}
                    mediaFiles={mediaFiles}
                    profiles={[]} // Removed profiles prop
                    onStartBatch={startBatchProcessing}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      {/* Fixed bottom bar for deletion */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-gray-800/90 backdrop-blur-lg border border-gray-700/50 rounded-2xl shadow-2xl p-4 flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-gray-300">
              <span className="font-medium">{selected.length} selected</span>
            </div>
            <button
              onClick={handleBulkDelete}
              className="bg-red-500/90 hover:bg-red-500 text-white font-semibold py-2 px-6 rounded-xl shadow-lg shadow-red-500/25 transition-all duration-200 hover:shadow-red-500/40 hover:scale-105 flex items-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-label={`Delete ${selected.length} selected jobs`}
              disabled={bulkDeleteLoading}
            >
              <Trash2 className="w-4 h-4" />
              <span>{bulkDeleteLoading ? 'Deleting...' : 'Delete'}</span>
              {bulkDeleteLoading && (
                <svg
                  className="animate-spin ml-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
