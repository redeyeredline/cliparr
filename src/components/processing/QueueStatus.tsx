import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Activity, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QueueStatusProps {
  queueStatus: any[] | null;
}

export default function QueueStatus({ queueStatus }: QueueStatusProps) {
  if (!queueStatus) {
    return (
      <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <Activity className="w-5 h-5" />
            Queue Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            <Activity className="w-16 h-16 mx-auto mb-4 text-slate-700" />
            <p>Loading queue status...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalActive = queueStatus.reduce((sum, queue) => sum + queue.active, 0);
  const totalWaiting = queueStatus.reduce((sum, queue) => sum + queue.waiting, 0);
  const totalCompleted = queueStatus.reduce((sum, queue) => sum + queue.completed, 0);
  const totalFailed = queueStatus.reduce((sum, queue) => sum + queue.failed, 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Activity className="w-4 h-4 text-blue-400" />;
      case 'waiting':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-900/50 text-blue-300 border-blue-700';
      case 'waiting':
        return 'bg-amber-900/50 text-amber-300 border-amber-700';
      case 'completed':
        return 'bg-green-900/50 text-green-300 border-green-700';
      case 'failed':
        return 'bg-red-900/50 text-red-300 border-red-700';
      default:
        return 'bg-slate-900/50 text-slate-300 border-slate-700';
    }
  };

  return (
    <Card className="border-0 rounded-2xl shadow-lg bg-slate-800/90 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
          <Activity className="w-5 h-5" />
          Queue Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-slate-900/50 rounded-xl border border-slate-700">
            <div className="text-2xl font-bold text-blue-400">{totalActive}</div>
            <div className="text-sm text-slate-400">Active</div>
          </div>
          <div className="text-center p-4 bg-slate-900/50 rounded-xl border border-slate-700">
            <div className="text-2xl font-bold text-amber-400">{totalWaiting}</div>
            <div className="text-sm text-slate-400">Waiting</div>
          </div>
          <div className="text-center p-4 bg-slate-900/50 rounded-xl border border-slate-700">
            <div className="text-2xl font-bold text-green-400">{totalCompleted}</div>
            <div className="text-sm text-slate-400">Completed</div>
          </div>
          <div className="text-center p-4 bg-slate-900/50 rounded-xl border border-slate-700">
            <div className="text-2xl font-bold text-red-400">{totalFailed}</div>
            <div className="text-sm text-slate-400">Failed</div>
          </div>
        </div>

        {/* Individual Queue Status */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Queue Details</h3>
          <AnimatePresence>
            {queueStatus.map((queue, index) => (
              <motion.div
                key={queue.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 bg-slate-900/50 rounded-xl border border-slate-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-white">{queue.name}</h4>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(queue.active > 0 ? 'active' : queue.waiting > 0 ? 'waiting' : 'completed')}
                    <span className="text-sm text-slate-400">
                      {queue.active > 0 ? 'Active' : queue.waiting > 0 ? 'Waiting' : 'Idle'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-blue-400">{queue.active}</div>
                    <div className="text-slate-500">Active</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-amber-400">{queue.waiting}</div>
                    <div className="text-slate-500">Waiting</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-green-400">{queue.completed}</div>
                    <div className="text-slate-500">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-red-400">{queue.failed}</div>
                    <div className="text-slate-500">Failed</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
