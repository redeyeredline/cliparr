import React, { useState, useEffect } from 'react';
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

  const loadData = async () => {
    if (isLoading) {
      setIsLoading(true);
    }
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
      if (isLoading) {
        setIsLoading(false);
      }
    }
  };

  // WebSocket event handlers
  useEffect(() => {
    const handleJobUpdate = (data: any) => {
      if (data.type === 'job_update') {
        // Update the specific job in the state
        setJobs((prevJobs) => {
          return prevJobs.map((job) => {
            if (job.id?.toString() === data.jobId?.toString()) {
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
            message: `Job ${data.jobId} completed successfully`,
          });
        } else if (data.status === 'failed') {
          toast({
            type: 'error',
            message: `Job ${data.jobId} failed: ${data.error}`,
          });
        } else if (data.status === 'active') {
          toast({
            type: 'info',
            message: `Job ${data.jobId} started processing`,
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
    wsClient.addEventListener('message', handleJobUpdate);
    wsClient.addEventListener('message', handleQueueStatus);
    wsClient.addEventListener('message', handleProcessingStatus);

    // Ensure WebSocket is connected
    wsClient.connect();

    return () => {
      // Clean up event listeners
      wsClient.removeEventListener('message', handleJobUpdate);
      wsClient.removeEventListener('message', handleQueueStatus);
      wsClient.removeEventListener('message', handleProcessingStatus);
    };
  }, [toast]);

  useEffect(() => {
    loadData();
    const intervalId = setInterval(loadData, 10000); // Poll every 10 seconds for updates
    return () => clearInterval(intervalId);
  }, []);

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
      await Promise.all(selected.map((id) => ProcessingJobEntity.delete(id)));
      setSelected([]);
      await loadData();
      toast({ type: 'success', message: 'Selected jobs deleted' });
    } catch (error) {
      toast({ type: 'error', message: 'Failed to delete selected jobs' });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 min-h-screen overflow-y-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Processing</h1>
      </div>
      {/* Queue Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

      <Tabs defaultValue="queue" className="space-y-6 h-full">
        <TabsList className="grid w-full grid-cols-4 bg-slate-800/90 backdrop-blur-md border border-slate-700">
          <TabsTrigger value="queue" className="text-white">Queue</TabsTrigger>
          <TabsTrigger value="monitor" className="text-white">Monitor</TabsTrigger>
          <TabsTrigger value="analyzer" className="text-white">Analyzer</TabsTrigger>
          <TabsTrigger value="batch" className="text-white">Batch</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-6 h-100 pb-32">
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
          />
        </TabsContent>

        <TabsContent value="monitor" className="space-y-6">
          <ProcessingMonitor
            activeProcesses={activeProcesses}
            mediaFiles={mediaFiles}
          />
        </TabsContent>

        <TabsContent value="analyzer" className="space-y-6">
          <AudioAnalyzer
            audioAnalyses={audioAnalyses}
            mediaFiles={mediaFiles}
            onRefresh={loadData}
          />
        </TabsContent>

        <TabsContent value="batch" className="space-y-6">
          <BatchProcessor
            jobs={jobs}
            mediaFiles={mediaFiles}
            profiles={profiles}
            onStartBatch={startBatchProcessing}
          />
        </TabsContent>
      </Tabs>
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
