import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Monitor, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProcessingJob, MediaFile } from '../entities/all';

interface ProcessingMonitorProps {
  activeProcesses: ProcessingJob[];
  mediaFiles: MediaFile[];
}

export default function ProcessingMonitor({ activeProcesses, mediaFiles }: ProcessingMonitorProps) {
  const getMediaFile = (mediaFileId: string | number): MediaFile | undefined => {
    return mediaFiles.find((f) => f.id === mediaFileId);
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
            <p>No active processing jobs.</p>
          </div>
        ) : (
          <AnimatePresence>
            {activeProcesses.map((job) => {
              const mediaFile = getMediaFile(job.media_file_id);
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 border-0 rounded-xl shadow-md bg-slate-900/80 mb-2"
                >
                  <h3 className="font-semibold mb-2 text-base text-white">
                    {mediaFile?.file_name || '...'}
                  </h3>
                  <div className="flex items-center gap-4">
                    <Progress value={Math.random() * 80 + 10} className="flex-1 h-2 rounded-full bg-slate-700" />
                    <span className="text-sm font-medium text-slate-200">
                      {(Math.random() * 50 + 20).toFixed(1)} fps
                    </span>
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
