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

export default function Processing() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [audioAnalyses, setAudioAnalyses] = useState<AudioAnalysis[]>([]);
  const [activeProcesses, setActiveProcesses] = useState<ProcessingJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [queueStatus, setQueueStatus] = useState<any>(null);
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

  return (
    <div className="container mx-auto p-6 space-y-6">
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
                          {process.media_file?.title || 'Unknown'}
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

      <Tabs defaultValue="queue" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-slate-800/90 backdrop-blur-md border border-slate-700">
          <TabsTrigger value="queue" className="text-white">Queue</TabsTrigger>
          <TabsTrigger value="monitor" className="text-white">Monitor</TabsTrigger>
          <TabsTrigger value="analyzer" className="text-white">Analyzer</TabsTrigger>
          <TabsTrigger value="batch" className="text-white">Batch</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-6">
          <ProcessingQueue
            jobs={jobs}
            mediaFiles={mediaFiles}
            onRefresh={loadData}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="monitor" className="space-y-6">
          <ProcessingMonitor
            jobs={jobs}
            mediaFiles={mediaFiles}
            onRefresh={loadData}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="analyzer" className="space-y-6">
          <AudioAnalyzer
            audioAnalyses={audioAnalyses}
            mediaFiles={mediaFiles}
            onRefresh={loadData}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="batch" className="space-y-6">
          <BatchProcessor
            jobs={jobs}
            mediaFiles={mediaFiles}
            profiles={profiles}
            onRefresh={loadData}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
