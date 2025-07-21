import React, { useState, useEffect } from 'react';
import {
  ProcessingJob,
  ProcessingJobEntity,
  MediaFile,
  MediaFileEntity,
} from '@/components/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye } from 'lucide-react';

import ReviewQueue from '../components/review/ReviewQueue';
import VideoPreview from '../components/review/VideoPreview';
import ReviewStats from '../components/review/ReviewStats';

export default function Review() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [selectedJob, setSelectedJob] = useState<ProcessingJob | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = async () => {
    if (isLoading) {
      setIsLoading(true);
    }
    try {
      const [jobsData, filesData] = await Promise.all([
        ProcessingJobEntity.list('-created_date'),
        MediaFileEntity.list('-created_date'),
      ]);
      setJobs(jobsData);
      setMediaFiles(filesData);

      // Debug: Log job status distribution
      const statusCounts = jobsData.reduce(
        (acc, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      console.log('Review page loaded jobs:', {
        total: jobsData.length,
        statusCounts,
        pending: jobsData.filter((j) => j.status === 'detected' && !j.manual_verified).length,
        verified: jobsData.filter((j) => j.manual_verified && j.status !== 'completed').length,
        completed: jobsData.filter((j) => j.status === 'completed').length,
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      if (isLoading) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
    const intervalId = setInterval(loadData, 5000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!selectedJob && jobs.length > 0) {
      const firstPending = jobs.find((j) => j.status === 'detected' && !j.manual_verified);
      if (firstPending) {
        setSelectedJob(firstPending);
      }
    }
  }, [jobs, selectedJob]);

  const selectNextJob = () => {
    const pendingJobs = jobs.filter((j) => j.status === 'detected' && !j.manual_verified);
    if (!selectedJob || pendingJobs.length <= 1) {
      setSelectedJob(null);
      return;
    }
    const currentIndex = pendingJobs.findIndex((j) => j.id === selectedJob.id);
    if (currentIndex !== -1 && currentIndex < pendingJobs.length - 1) {
      setSelectedJob(pendingJobs[currentIndex + 1]);
    } else {
      setSelectedJob(pendingJobs[0]);
    }
  };

  const handleVerifyJob = async (jobId: string | number, verified: boolean = true) => {
    try {
      await ProcessingJobEntity.update(jobId, {
        manual_verified: verified,
        status: verified ? 'verified' : 'detected',
      });
      selectNextJob();
    } catch (error) {
      console.error('Error updating job:', error);
    }
  };

  const handleUpdateTimestamps = async (
    jobId: string | number,
    timestamps: Partial<ProcessingJob>,
  ) => {
    try {
      await ProcessingJobEntity.update(jobId, timestamps);
      setSelectedJob((prev) => (prev ? { ...prev, ...timestamps } : prev));
    } catch (error) {
      console.error('Error updating timestamps:', error);
    }
  };

  const getMediaFileForJob = (job: ProcessingJob) => {
    return mediaFiles.find((f) => f.id === job.media_file_id) || null;
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Review Queue</h1>
          <p className="text-gray-400 font-medium">Verify AI-detected sequences</p>
        </div>
        <ReviewStats jobs={jobs} />
      </div>
      {/* Main Editor Layout */}
      <div className="grid lg:grid-cols-4 gap-6 min-h-[calc(100vh-200px)]">
        {/* Sidebar - Job Queue */}
        <div className="lg:col-span-1">
          <div className="h-full bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/30 shadow-2xl flex flex-col">
            <div className="border-b border-gray-700/30 p-4">
              <span className="text-lg font-semibold text-white">Queue</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ReviewQueue
                jobs={jobs}
                mediaFiles={mediaFiles}
                onSelectJob={setSelectedJob}
                selectedJobId={selectedJob?.id}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>
        {/* Main Content - Video Preview */}
        <div className="lg:col-span-3">
          <VideoPreview
            key={selectedJob?.id}
            job={selectedJob}
            mediaFile={selectedJob ? getMediaFileForJob(selectedJob) : null}
            onVerify={handleVerifyJob}
            onUpdateTimestamps={handleUpdateTimestamps}
            onSkip={selectNextJob}
          />
        </div>
      </div>
    </div>
  );
}
