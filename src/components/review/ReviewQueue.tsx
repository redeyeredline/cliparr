import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Clock, CheckCircle2, Tv2, Film } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProcessingJob, MediaFile } from '@/components/entities/all';

interface ReviewQueueProps {
  jobs: ProcessingJob[];
  mediaFiles: MediaFile[];
  onSelectJob: (job: ProcessingJob) => void;
  selectedJobId: string | number | undefined;
  isLoading: boolean;
}

export default function ReviewQueue({
  jobs,
  mediaFiles,
  onSelectJob,
  selectedJobId,
  isLoading,
}: ReviewQueueProps) {
  const getMediaFile = (mediaFileId: string | number): MediaFile | undefined => {
    return mediaFiles.find((f) => f.id === mediaFileId);
  };

  const getJobsForTab = (tab: string) => {
    switch (tab) {
      case 'processing': return jobs.filter((j) => j.status === 'processing' || j.status === 'scanning');
      case 'pending': return jobs.filter((j) => j.status === 'detected' && !j.manual_verified);
      case 'verified': return jobs.filter((j) => j.manual_verified && j.status !== 'completed');
      case 'completed': return jobs.filter((j) => j.status === 'completed');
      default: return [];
    }
  };

  const JobItem = ({ job }: { job: ProcessingJob }) => {
    const mediaFile = getMediaFile(job.media_file_id);
    const isSelected = selectedJobId === job.id;
    if (!mediaFile) {
      return null;
    }
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className={`p-3 border-l-4 rounded-r-lg cursor-pointer transition-all duration-200 shadow bg-gray-900/80 ${
          isSelected
            ? 'border-blue-500 bg-gray-800/90 scale-[1.01] text-white'
            : 'border-transparent hover:bg-gray-800/70 text-gray-200'
        }`}
        onClick={() => onSelectJob(job)}
      >
        <div className="flex items-start gap-3">
          <div className="w-16 h-10 bg-gray-700 rounded-md flex-shrink-0 flex items-center justify-center">
            <Film className="w-6 h-6 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate text-sm text-white">{mediaFile.file_name}</h3>
            <p className="text-xs text-gray-400 truncate">
              {mediaFile.series_name} • {formatDistanceToNow(new Date(job.created_date), { addSuffix: true })}
            </p>
          </div>
          <Badge variant="outline" className="text-xs border-blue-700 text-blue-300 bg-gray-800/60">
            {(job.confidence_score * 100).toFixed(0)}%
          </Badge>
        </div>
      </motion.div>
    );
  };

  const renderTabContent = (status: string) => {
    if (isLoading) {
      return (
        <div className="space-y-3 px-4">
          {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      );
    }
    const filteredJobs = getJobsForTab(status);
    if (filteredJobs.length === 0) {
      return (
        <div className="text-center py-16 px-4">
          <CheckCircle2 className="w-12 h-12 mx-auto text-gray-700" />
          <h3 className="mt-2 font-medium text-gray-400">All caught up!</h3>
          <p className="text-sm text-gray-500">No jobs in this queue.</p>
        </div>
      );
    }
    return (
      <div className="space-y-2 p-2">
        <AnimatePresence>
          {filteredJobs.map((job) => <JobItem key={job.id} job={job} />)}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <Tabs defaultValue="processing" className="flex-1 flex flex-col">
      <div className="px-4 pt-2">
        <TabsList className="grid w-full grid-cols-4 bg-gray-900/80 rounded-xl">
          <TabsTrigger value="processing" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-300 rounded-lg">Processing</TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-300 rounded-lg">Pending</TabsTrigger>
          <TabsTrigger value="verified" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-300 rounded-lg">Verified</TabsTrigger>
          <TabsTrigger value="completed" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-300 rounded-lg">Done</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="processing" className="flex-1 overflow-y-auto mt-0">
        {renderTabContent('processing')}
      </TabsContent>
      <TabsContent value="pending" className="flex-1 overflow-y-auto mt-0">
        {renderTabContent('pending')}
      </TabsContent>
      <TabsContent value="verified" className="flex-1 overflow-y-auto mt-0">
        {renderTabContent('verified')}
      </TabsContent>
      <TabsContent value="completed" className="flex-1 overflow-y-auto mt-0">
        {renderTabContent('completed')}
      </TabsContent>
    </Tabs>
  );
}
