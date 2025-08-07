import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Monitor, Zap, Play, Pause, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MediaFile } from '../entities/all';
import { Button } from '../ui/button';

interface ProcessingMonitorProps {
  activeProcesses: any[];
  mediaFiles: MediaFile[];
  jobProgress?: Record<
    string,
    { progress: number; fps: number; currentFile: any; updated: number }
  >;
  onStopProcessing?: (jobId: string | number) => Promise<void>;
  onDeleteJob?: (jobId: string | number) => Promise<void>;
}

const AUDIO_WEIGHT = 0.4;
const CHUNK_WEIGHT = 0.6;

// Individual episode entity for monitor tab
const MonitorEpisodeEntity = memo(({ 
  job, 
  mediaFile, 
  jobProgress,
  onStopProcessing,
  onDeleteJob
}: {
  job: any;
  mediaFile?: MediaFile;
  jobProgress?: Record<string, { progress: number; fps: number; currentFile: any; updated: number }>;
  onStopProcessing?: (jobId: string | number) => Promise<void>;
  onDeleteJob?: (jobId: string | number) => Promise<void>;
}) => {
  // Get real-time progress for this specific job
  const realTimeProgress = jobProgress?.[job.id as string | number];
  const progressPercent = realTimeProgress?.progress || 0;
  const currentFile = realTimeProgress?.currentFile || job.currentFile;
  
  // Calculate audio and chunk percentages
  const audioPercent = realTimeProgress?.progress ?? job.audioPercent ?? (job.progress < 50 ? job.progress * 2 : 100) ?? 0;
  const chunkPercent = realTimeProgress?.progress ?? job.chunkPercent ?? (job.progress >= 50 ? (job.progress - 50) * 2 : 0) ?? 0;
  const overall = Math.round(audioPercent * AUDIO_WEIGHT + chunkPercent * CHUNK_WEIGHT);
  
  // Get file name
  const fileName = mediaFile?.file_name || 
    job.filePath?.split('/')?.pop() || 
    currentFile?.filePath?.split('/')?.pop() || 
    'Unknown File';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="p-5 border-0 rounded-xl shadow-md bg-slate-900/80 mb-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          {/* File name and status */}
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-base text-white">{fileName}</h3>
            <Badge className="bg-blue-100 text-blue-700 capitalize rounded-full px-3 py-1 text-xs font-semibold border border-slate-700">
              <Play className="w-3 h-3 mr-1.5" /> Processing
            </Badge>
          </div>
          
          {/* Progress bar with percentage */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Progress value={overall} className="flex-1 h-3 rounded-full bg-slate-700" />
              <span className="text-sm font-bold text-slate-200 min-w-[3rem]">{overall}%</span>
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            
            {/* Detailed progress info */}
            <div className="text-xs text-slate-400 space-y-1">
              <div>Audio: {audioPercent}% | Chunk: {chunkPercent}%</div>
              {realTimeProgress?.fps && (
                <div>FPS: {realTimeProgress.fps}</div>
              )}
              {currentFile?.episode && (
                <div>Episode: {currentFile.episode} (S{currentFile.season})</div>
              )}
              {currentFile?.show && (
                <div>Show: {currentFile.show}</div>
              )}
            </div>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2 ml-4">
          {onStopProcessing && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onStopProcessing(job.id!)}
              className="rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200"
              title="Pause processing"
            >
              <Pause className="w-5 h-5" />
            </Button>
          )}
          {onDeleteJob && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDeleteJob(job.id!)}
              className="rounded-full bg-slate-800 hover:bg-red-700 text-red-400"
              title="Remove job"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

MonitorEpisodeEntity.displayName = 'MonitorEpisodeEntity';

export default function ProcessingMonitor({
  activeProcesses,
  mediaFiles,
  jobProgress = {},
  onStopProcessing,
  onDeleteJob,
}: ProcessingMonitorProps) {
  // Helper to get file name from filePath or mediaFiles
  const getMediaFile = (job: any): MediaFile | undefined => {
    return mediaFiles.find((f) => f.file_path === job.filePath || f.id === job.media_file_id);
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
              const mediaFile = getMediaFile(job);
              
              return (
                <MonitorEpisodeEntity
                  key={job.episodeFileId || job.id || job.filePath}
                  job={job}
                  mediaFile={mediaFile}
                  jobProgress={jobProgress}
                  onStopProcessing={onStopProcessing}
                  onDeleteJob={onDeleteJob}
                />
              );
            })}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
