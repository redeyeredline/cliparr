import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Play,
  Pause,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileVideo,
  List,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProcessingJob, MediaFile, ProcessingProfile } from '../entities/all';

interface ProcessingQueueProps {
  jobs: ProcessingJob[];
  mediaFiles: MediaFile[];
  profiles: ProcessingProfile[];
  onStopProcessing: (jobId: string | number) => Promise<void>;
  isLoading: boolean;
}

export default function ProcessingQueue({
  jobs,
  mediaFiles,
  profiles,
  onStopProcessing,
  isLoading,
}: ProcessingQueueProps) {
  const [filter, setFilter] = useState<string>('all');
  const filteredJobs = jobs.filter((job) => filter === 'all' || job.status === filter);

  const getMediaFile = (mediaFileId: string | number): MediaFile | undefined => {
    return mediaFiles.find((f) => f.id === mediaFileId);
  };

  const statusConfig = {
    processing: { color: 'bg-blue-100 text-blue-700', icon: Play },
    verified: { color: 'bg-amber-100 text-amber-700', icon: Clock },
    completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    failed: { color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  };

  return (
    <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <List className="w-5 h-5" />
            Job Queue
          </CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48 rounded-lg bg-slate-900 text-slate-200 border-slate-700">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 text-slate-200 border-slate-700">
              <SelectItem value="all">All Jobs</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="verified">Queued (Verified)</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && filteredJobs.length === 0 ? (
          <p className="text-slate-400">Loading...</p>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>No jobs in this category.</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredJobs.map((job) => {
              const mediaFile = getMediaFile(job.media_file_id);
              const config = statusConfig[job.status as keyof typeof statusConfig] || {
                color: 'bg-slate-700 text-slate-200',
                icon: Clock,
              };
              const StatusIcon = config.icon;
              return (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-5 border-0 rounded-xl shadow-md bg-slate-900/80 hover:scale-[1.01] transition-transform duration-200 cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <h3 className="font-semibold text-white text-base">
                        {mediaFile?.file_name || 'Loading...'}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge className={`${config.color} capitalize rounded-full px-3 py-1 text-xs font-semibold border border-slate-700`}> <StatusIcon className="w-3 h-3 mr-1.5" /> {job.status}
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs border-slate-700 text-slate-200">
                          Profile: {profiles.find((p) => p.id === job.profile_id)?.name || 'Auto'}
                        </Badge>
                      </div>
                      {job.status === 'processing' && (
                        <Progress value={Math.random() * 80 + 10} className="h-2 mt-2 rounded-full bg-slate-700" />
                      )}
                    </div>
                    {job.status === 'processing' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onStopProcessing(job.id!)}
                        className="rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200"
                      >
                        <Pause className="w-5 h-5" />
                      </Button>
                    )}
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
