import React, { useState, useEffect } from 'react';
import {
  ProcessingJob,
  ProcessingJobEntity,
  MediaFile,
  AudioAnalysis,
  AudioAnalysisEntity,
} from '@/components/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProcessingQueue from '../components/processing/ProcessingQueue';
import AudioAnalyzer from '../components/processing/AudioAnalyzer';
import ProcessingMonitor from '../components/processing/ProcessingMonitor';
import BatchProcessor from '../components/processing/BatchProcessor';

export default function Processing() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [audioAnalyses, setAudioAnalyses] = useState<AudioAnalysis[]>([]);
  const [activeProcesses, setActiveProcesses] = useState<ProcessingJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async () => {
    if (isLoading) {
      setIsLoading(true);
    }
    try {
      const [jobsData, filesData, audioData] = await Promise.all([
        ProcessingJobEntity.list('-created_date'),
        Promise.resolve([]),
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

  useEffect(() => {
    loadData();
    const intervalId = setInterval(loadData, 3000);
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
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <Card className="rounded-2xl shadow-xl border-0 bg-slate-800/90 backdrop-blur-md">
        <CardContent className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 p-8">
          <div>
            <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">
              Advanced Processing
            </h1>
            <p className="text-slate-300 font-medium text-lg">
              FFmpeg-powered video processing with hardware acceleration
            </p>
          </div>
          <div className="flex gap-8 bg-slate-900/80 rounded-xl shadow p-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">
                {stats.processing}
              </div>
              <div className="text-xs text-slate-300">Processing</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400">
                {stats.queued}
              </div>
              <div className="text-xs text-slate-300">Queued</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">
                {stats.completed}
              </div>
              <div className="text-xs text-slate-300">Completed</div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Tabs defaultValue="queue" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-slate-900/80 rounded-xl p-1">
          <TabsTrigger value="queue" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-300 rounded-lg">
            Processing Queue
          </TabsTrigger>
          <TabsTrigger value="audio" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-300 rounded-lg">
            Audio Analysis
          </TabsTrigger>
          <TabsTrigger value="monitor" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-300 rounded-lg">
            Live Monitor
          </TabsTrigger>
          <TabsTrigger value="batch" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-300 rounded-lg">
            Batch Processing
          </TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="space-y-6">
          <ProcessingQueue
            jobs={jobs}
            mediaFiles={mediaFiles}
            profiles={profiles}
            onStopProcessing={stopProcessing}
            isLoading={isLoading}
          />
        </TabsContent>
        <TabsContent value="audio" className="space-y-6">
          <AudioAnalyzer
            audioAnalyses={audioAnalyses}
            mediaFiles={mediaFiles}
            onRefresh={loadData}
          />
        </TabsContent>
        <TabsContent value="monitor" className="space-y-6">
          <ProcessingMonitor
            activeProcesses={activeProcesses}
            mediaFiles={mediaFiles}
          />
        </TabsContent>
        <TabsContent value="batch" className="space-y-6">
          <BatchProcessor
            jobs={jobs.filter((j) => j.status === 'verified' && j.manual_verified)}
            mediaFiles={mediaFiles}
            profiles={profiles}
            onStartBatch={startBatchProcessing}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
