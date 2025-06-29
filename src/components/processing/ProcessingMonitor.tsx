import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Monitor, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MediaFile } from '../entities/all';
import { wsClient } from '../../services/websocket.frontend';
import { api } from '../../integration/api-client';

interface FfmpegJob {
  episodeFileId: string | number;
  filePath: string;
  percent: number;
  status: string;
}

interface ProcessingMonitorProps {
  mediaFiles: MediaFile[];
}

export default function ProcessingMonitor({ mediaFiles }: ProcessingMonitorProps) {
  const [activeJobs, setActiveJobs] = useState<Record<string, FfmpegJob>>({});

  // Fetch initial active ffmpeg jobs on mount
  useEffect(() => {
    async function fetchActiveJobs() {
      try {
        const res = await api.get('/api/processing/active-ffmpeg');
        if (res.data && res.data.active) {
          setActiveJobs(res.data.active);
        }
      } catch (err) {
        // ignore
      }
    }
    fetchActiveJobs();
  }, []);

  // Subscribe to ffmpeg-progress events
  useEffect(() => {
    function handleProgress(event: any) {
      if (event && event.type === 'ffmpeg-progress' && event.episodeFileId) {
        setActiveJobs((prev) => ({
          ...prev,
          [event.episodeFileId]: {
            episodeFileId: event.episodeFileId,
            filePath: event.filePath,
            percent: event.percent,
            status: event.status,
          },
        }));
      }
    }
    wsClient.addEventListener('message', handleProgress);
    wsClient.connect();
    return () => {
      wsClient.removeEventListener('message', handleProgress);
    };
  }, []);

  // Remove jobs that reach 100% after a short delay
  useEffect(() => {
    const timeoutIds: NodeJS.Timeout[] = [];
    Object.values(activeJobs).forEach((job) => {
      if (job.percent >= 100) {
        const tid = setTimeout(() => {
          setActiveJobs((prev) => {
            const copy = { ...prev };
            delete copy[job.episodeFileId];
            return copy;
          });
        }, 2000);
        timeoutIds.push(tid);
      }
    });
    return () => { timeoutIds.forEach(clearTimeout); };
  }, [activeJobs]);

  // Helper to get file name from filePath or mediaFiles
  const getFileName = (filePath: string) => {
    const match = mediaFiles.find((f) => f.file_path === filePath);
    return match?.file_name || filePath.split('/').pop() || filePath;
  };

  const jobsList = Object.values(activeJobs);

  return (
    <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
          <Monitor className="w-5 h-5" />
          Live Processing Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobsList.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>No active ffmpeg jobs.</p>
          </div>
        ) : (
          <AnimatePresence>
            {jobsList.map((job) => (
              <motion.div
                key={job.episodeFileId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="p-5 border-0 rounded-xl shadow-md bg-slate-900/80 mb-2"
              >
                <h3 className="font-semibold mb-2 text-base text-white">
                  {getFileName(job.filePath)}
                </h3>
                <div className="flex items-center gap-4">
                  <Progress value={job.percent} className="flex-1 h-2 rounded-full bg-slate-700" />
                  <span className="text-sm font-medium text-slate-200">
                    {job.percent}%
                  </span>
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xs text-slate-400 mt-1">{job.status}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
