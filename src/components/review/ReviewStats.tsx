import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { ProcessingJob } from '@/components/entities/all';

interface ReviewStatsProps {
  jobs: ProcessingJob[];
}

export default function ReviewStats({ jobs }: ReviewStatsProps) {
  const pending = jobs.filter((j) => j.status === 'detected' && !j.manual_verified).length;
  const verified = jobs.filter((j) => j.manual_verified).length;
  const needsAttention = jobs.filter((j) => j.status === 'failed').length;

  const stats = [
    { label: 'Pending Review', value: pending, icon: Clock, color: 'text-amber-400' },
    { label: 'Verified', value: verified, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'Needs Attention', value: needsAttention, icon: AlertCircle, color: 'text-red-400' },
  ];

  return (
    <div className="flex gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="border border-gray-700/30 rounded-2xl shadow-2xl bg-gray-800/30 backdrop-blur-sm"
        >
          <div className="p-4">
            <div className="flex items-center gap-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div>
                <p className="text-sm text-gray-300">{stat.label}</p>
                <p className="text-lg font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
