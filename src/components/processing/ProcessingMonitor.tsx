import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Monitor, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MediaFile } from '../entities/all';

interface ProcessingMonitorProps {
  activeProcesses: any[];
  mediaFiles: MediaFile[];
  jobProgress?: Record<string, { progress: number; fps: number; currentFile: any; updated: number }>;
}

const AUDIO_WEIGHT = 0.4;
const CHUNK_WEIGHT = 0.6;

export default function ProcessingMonitor({ activeProcesses, mediaFiles, jobProgress = {} }: ProcessingMonitorProps) {
  // Helper to get file name from filePath or mediaFiles
  const getFileName = (filePath: string) => {
    const match = mediaFiles.find((f) => f.file_path === filePath);
    return match?.file_name || filePath?.split('/')?.pop() || filePath;
  };

  return (
    <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
          <Monitor className="w-5 h-5" />
          Live Processing Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeProcesses.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>No active ffmpeg jobs.</p>
          </div>
        ) : (
          <AnimatePresence>
            {activeProcesses.map((job) => {
              // Use real-time progress from jobProgress if available, else fallback to job.progress
              const realTimeProgress = jobProgress[job.id as string | number];
              const audioPercent = realTimeProgress?.progress ?? job.audioPercent ?? (job.progress < 50 ? job.progress * 2 : 100) ?? 0;
              const chunkPercent = realTimeProgress?.progress ?? job.chunkPercent ?? (job.progress >= 50 ? (job.progress - 50) * 2 : 0) ?? 0;
              const overall = Math.round(audioPercent * AUDIO_WEIGHT + chunkPercent * CHUNK_WEIGHT);
              const fileName = getFileName(job.filePath || job.currentFile?.filePath || realTimeProgress?.currentFile?.filePath || '');
              const currentFile = realTimeProgress?.currentFile || job.currentFile;

              return (
                <motion.div
                  key={job.episodeFileId || job.id || fileName}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="p-5 border-0 rounded-xl shadow-md bg-slate-900/80 mb-2"
                >
                  <h3 className="font-semibold mb-2 text-base text-white">
                    {fileName}
                  </h3>
                  <div className="flex items-center gap-4">
                    <Progress value={overall} className="flex-1 h-2 rounded-full bg-slate-700" />
                    <span className="text-sm font-medium text-slate-200">
                      {overall}%
                    </span>
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {job.status} | Audio: {audioPercent}% | Chunk: {chunkPercent}%
                    {realTimeProgress?.fps && ` | FPS: ${realTimeProgress.fps}`}
                  </div>
                  {currentFile?.episode && (
                    <div className="text-xs text-slate-500 mt-1">
                      Processing: {currentFile.episode} (S{currentFile.season})
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
