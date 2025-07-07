import React, { useState, useEffect, useRef } from 'react';
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
import { Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../integration/api-client';
import { logger } from '../services/logger.frontend.js';
import { Button } from '@/components/ui/button';

export default function Processing() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [audioAnalyses, setAudioAnalyses] = useState<AudioAnalysis[]>([]);
  const [activeProcesses, setActiveProcesses] = useState<ProcessingJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const toast = useToast();
  const [cpuLimit, setCpuLimit] = useState<number>(2);
  const [gpuLimit, setGpuLimit] = useState<number>(1);
  const [workerSaving, setWorkerSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [jobProgress, setJobProgress] = useState<Record<string, { progress: number, fps: number, currentFile: any, updated: number }>>({});

  const loadData = async () => {
    console.log('loadData called');
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
      const processing = jobsData.filter(
        (j: ProcessingJob) => j.status === 'processing' || j.status === 'scanning',
      );
      setActiveProcesses(processing);
    } catch (error) {
      console.error('Error loading processing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // WebSocket event handlers
  useEffect(() => {
    // Add a simple message logger to debug all incoming messages
    const handleAllMessages = (data: any) => {
    };

    // Helper to normalize job IDs (strip 'epjob-' prefix)
    const normalizeId = (id: string | number | undefined) => (id ? id.toString().replace(/^epjob-/, '') : '');

    const handleJobUpdate = (data: any) => {
      // Handle job updates - these come directly without a 'type' field
      if (data.dbJobId && data.status) {
        // Check if this job exists in our current jobs array (normalize IDs)
        const existingJob = jobs.find((j) => normalizeId(j.id) === normalizeId(data.dbJobId));

        // If job doesn't exist in our array, reload data to get latest jobs
        if (!existingJob) {
          loadData();
          return; // Exit early, let the reload handle the update
        }

        // Track real-time progress/fps for processing jobs
        if (data.status === 'processing' && data.progress !== undefined) {
          setJobProgress((prev) => {
            const newProgress = {
              ...prev,
              [normalizeId(data.dbJobId) || '']: {
                progress: data.progress,
                fps: data.fps,
                currentFile: data.currentFile,
                updated: Date.now(),
              },
            };
            return newProgress;
          });
        }
        // Remove progress for jobs that are completed/failed
        if (['completed', 'failed'].includes(data.status)) {
          setJobProgress((prev) => {
            const copy = { ...prev };
            delete copy[normalizeId(data.dbJobId) || ''];
            return copy;
          });
        }
        // Update the specific job in the state
        setJobs((prevJobs) => {
          const updated = prevJobs.map((job) => {
            if (!job) {
              return job;
            }
            if (normalizeId(job.id) === normalizeId(data.dbJobId)) {
              return {
                ...job,
                status: data.status,
                processing_notes: data.error || data.result?.message || job.processing_notes,
                updated_date: new Date().toISOString(),
              };
            }
            return job;
          });
          return updated;
        });

        // Show toast notification for important updates
        if (data.status === 'completed') {
          toast({
            type: 'success',
            message: `Job ${data.dbJobId} completed successfully`,
          });
        } else if (data.status === 'failed') {
          toast({
            type: 'error',
            message: `Job ${data.dbJobId} failed: ${data.error || data.message}`,
          });
        } else if (data.status === 'active') {
          toast({
            type: 'info',
            message: `Job ${data.dbJobId} started processing`,
          });
        }
      }

      // Handle legacy job_update type messages (for backward compatibility)
      if (data.type === 'job_update') {
        // Check if this job exists in our current jobs array (normalize IDs)
        const existingJob = jobs.find((j) => normalizeId(j.id) === normalizeId(data.dbJobId));

        // If job doesn't exist in our array, reload data to get latest jobs
        if (!existingJob) {
          loadData();
          return; // Exit early, let the reload handle the update
        }

        // Track real-time progress/fps for processing jobs
        if (data.status === 'processing' && data.progress !== undefined) {
          setJobProgress((prev) => ({
            ...prev,
            [normalizeId(data.dbJobId) || '']: {
              progress: data.progress,
              fps: data.fps,
              currentFile: data.currentFile,
              updated: Date.now(),
            },
          }));
        }
        // Remove progress for jobs that are completed/failed
        if (['completed', 'failed'].includes(data.status)) {
          setJobProgress((prev) => {
            const copy = { ...prev };
            delete copy[normalizeId(data.dbJobId) || ''];
            return copy;
          });
        }
        // Update the specific job in the state
        setJobs((prevJobs) => {
          return prevJobs.map((job) => {
            if (!job) {
              return job;
            }
            if (normalizeId(job.id) === normalizeId(data.dbJobId)) {
              return {
                ...job,
                status: data.status,
                processing_notes: data.error || data.result?.message || job.processing_notes,
                updated_date: new Date().toISOString(),
              };
            }
            return job;
          });
        });

        // Show toast notification for important updates
        if (data.status === 'completed') {
          toast({
            type: 'success',
            message: `Job ${data.dbJobId} completed successfully`,
          });
        } else if (data.status === 'failed') {
          toast({
            type: 'error',
            message: `Job ${data.dbJobId} failed: ${data.error}`,
          });
        } else if (data.status === 'active') {
          toast({
            type: 'info',
            message: `Job ${data.dbJobId} started processing`,
          });
        }
      }
    };

    const handleQueueStatus = (data: any) => {
      if (data.type === 'queue_status') {
        setQueueStatus(data.queues);
      }
    };

    const handleProcessingStatus = (data: any) => {
      if (data.type === 'processing_status') {
        // Update processing status
        setQueueStatus(data);
      }
    };

    // Add WebSocket event listeners
    wsClient.addEventListener('message', handleAllMessages);
    wsClient.addEventListener('message', handleJobUpdate);
    wsClient.addEventListener('message', handleQueueStatus);
    wsClient.addEventListener('message', handleProcessingStatus);
    wsClient.addEventListener('open', () => {});
    wsClient.addEventListener('close', () => {});
    wsClient.addEventListener('error', (e: Event) => {});

    // Ensure WebSocket is connected
    wsClient.connect();

    return () => {
      // Clean up event listeners
      wsClient.removeEventListener('message', handleAllMessages);
      wsClient.removeEventListener('message', handleJobUpdate);
      wsClient.removeEventListener('message', handleQueueStatus);
      wsClient.removeEventListener('message', handleProcessingStatus);
    };
  }, [toast, jobs, loadData]);

  // useEffect(() => {
  //   loadData();
  //   const intervalId = setInterval(loadData, 10000); // Poll every 10 seconds for updates
  //   return () => clearInterval(intervalId);
  // }, []);

  const startBatchProcessing = async (
    jobIds: (string | number)[],
    profileId: string | number,
  ) => {
    try {
      await Promise.all(
        jobIds.map((id) =>
          ProcessingJobEntity.update(id, {
            status: 'processing',
            processing_notes: `Batch processing started with profile ${profileId}`,
          }),
        ),
      );
      await loadData();
    } catch (error) {
      console.error('Error starting batch processing:', error);
    }
  };

  const stopProcessing = async (jobId: string | number) => {
    try {
      await ProcessingJobEntity.update(jobId, {
        status: 'detected',
        processing_notes: 'Processing stopped by user',
      });
      await loadData();
    } catch (error) {
      console.error('Error stopping processing:', error);
    }
  };

  const getProcessingStats = () => {
    const processing = jobs.filter((j) => j.status === 'processing').length;
    const queued = jobs.filter((j) => j.status === 'verified' && j.manual_verified).length;
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;
    return { processing, queued, completed, failed };
  };

  const stats = getProcessingStats();

  // Update handleDeleteJob to use selected
  const handleDeleteJob = async (jobId: string | number) => {
    try {
      await ProcessingJobEntity.delete(jobId);
      setSelected((ids) => ids.filter((id) => id !== jobId));
      await loadData();
      toast({ type: 'success', message: 'Job deleted' });
    } catch (error) {
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
              toast({ type: 'error', message: `Bulk delete failed: ${status.failedReason || 'Unknown error'}` });
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
        await loadData();
      } else {
        await loadData();
        toast({ type: 'success', message: 'Selected jobs deleted' });
      }
    } catch (error) {
      toast({ type: 'error', message: 'Failed to delete jobs' });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // Fetch worker limits on mount
  useEffect(() => {
    const fetchWorkerLimits = async () => {
      try {
        const settings = await apiClient.getAllSettings();
        setCpuLimit(parseInt(settings.cpu_worker_limit, 10) || 2);
        setGpuLimit(parseInt(settings.gpu_worker_limit, 10) || 1);
      } catch (err) {
        // ignore
      }
    };
    fetchWorkerLimits();
  }, []);

  // Save worker limits
  const saveWorkerLimits = async (cpu: number, gpu: number) => {
    setWorkerSaving('saving');
    try {
      await apiClient.setAllSettings({ cpu_worker_limit: cpu, gpu_worker_limit: gpu });
      setWorkerSaving('saved');
      setTimeout(() => setWorkerSaving('idle'), 1200);
      toast({ type: 'success', message: 'Worker limits updated' });
    } catch (err) {
      setWorkerSaving('idle');
      toast({ type: 'error', message: 'Failed to update worker limits' });
    }
  };

  // Only show jobs with status 'processing' and a recent progress update (last 30s)
  const now = Date.now();
  const activeJobs = Object.keys(jobProgress)
    .map((id) => jobs.find((j) => j.id?.toString() === id))
    .filter((j) => j && now - jobProgress[j.id as string | number].updated < 30000);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="flex-1 overflow-auto p-6">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-white">Processing</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  wsClient.send({ type: 'test', message: 'Test from Processing page' });
                }}
                variant="outline"
                size="sm"
                className="text-white border-slate-600 hover:bg-slate-700"
              >
                Test WebSocket
              </Button>
            </div>
          </div>
          {/* Queue Status Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 flex-shrink-0">
            <div className="lg:col-span-2">
              <QueueStatus queueStatus={queueStatus} />
            </div>
            <div className="space-y-6">
              {/* Active Processes Summary */}
              <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white">
                    Active Processes ({activeProcesses.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activeProcesses.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">No active processes</p>
                  ) : (
                    <div className="space-y-3">
                      {activeProcesses.slice(0, 5).map((process) => (
                        <div
                          key={process.id}
                          className="p-3 bg-slate-900/50 rounded-lg border border-slate-700"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white font-medium">
                              {mediaFiles.find((f) => f.id === process.media_file_id)?.file_name || 'Unknown'}
                            </span>
                            <span className="text-xs text-slate-400">
                              {process.status}
                            </span>
                          </div>
                          {process.processing_notes && (
                            <p className="text-xs text-slate-500 mt-1">
                              {process.processing_notes}
                            </p>
                          )}
                        </div>
                      ))}
                      {activeProcesses.length > 5 && (
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
                <TabsTrigger value="queue" className="text-white">Queue</TabsTrigger>
                <TabsTrigger value="monitor" className="text-white">Monitor</TabsTrigger>
                <TabsTrigger value="analyzer" className="text-white">Analyzer</TabsTrigger>
                <TabsTrigger value="batch" className="text-white">Batch</TabsTrigger>
              </TabsList>

              <TabsContent value="queue" className="flex-1 flex flex-col min-h-0 mt-6">
                <div className="flex-1 flex flex-col min-h-0 overflow-auto">
                  <ProcessingQueue
                    jobs={jobs}
                    mediaFiles={mediaFiles}
                    profiles={profiles}
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
                    activeProcesses={activeProcesses}
                    mediaFiles={mediaFiles}
                    jobProgress={jobProgress}
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
                    jobs={jobs}
                    mediaFiles={mediaFiles}
                    profiles={profiles}
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
                <svg className="animate-spin ml-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
