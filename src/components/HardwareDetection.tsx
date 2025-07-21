import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Cpu, Zap, Monitor, RefreshCw } from 'lucide-react';

interface HardwareInfo {
  gpu_name?: string;
  cpu_name?: string;
  cpu_cores?: number;
  memory_gb?: number;
  ffmpeg_version?: string;
  nvenc_support?: boolean;
  qsv_support?: boolean;
  last_detected?: string;
}

interface HardwareDetectionProps {
  hardwareInfo: HardwareInfo | null;
  isDetecting: boolean;
  onDetect: () => void;
}

export default function HardwareDetection({
  hardwareInfo,
  isDetecting,
  onDetect,
}: HardwareDetectionProps) {
  const renderInfoRow = (label: string, value: any, badgeColor?: string) => (
    <div className="flex justify-between items-center py-3 border-b border-gray-700/20 last:border-b-0">
      <span className="text-gray-200 font-medium text-base">{label}</span>
      {value ? (
        <Badge
          variant={badgeColor ? 'default' : 'secondary'}
          className={badgeColor || 'bg-gray-700/60 text-white'}
        >
          {value === true ? 'Supported' : value}
        </Badge>
      ) : (
        <Badge variant="outline" className="border-gray-700/40 text-gray-400">
          Not Detected
        </Badge>
      )}
    </div>
  );

  const formatDistanceToNow = (date: string) => {
    const now = new Date();
    const targetDate = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - targetDate.getTime()) / 1000);
    if (diffInSeconds < 60) {
      return 'just now';
    }
    if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    }
    if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    }
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  return (
    <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/30 shadow-2xl p-8 w-full">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-white" />
            <span className="text-xl font-bold text-white">Hardware Detection</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDetect}
            disabled={isDetecting}
            className="text-gray-200 hover:bg-gray-700/30"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isDetecting ? 'animate-spin' : ''}`} />
            Re-Scan
          </Button>
        </div>
        {hardwareInfo && hardwareInfo.last_detected && (
          <p className="text-sm text-gray-400 pt-1">
            Last detected: {formatDistanceToNow(hardwareInfo.last_detected)}
          </p>
        )}
      </div>
      <div>
        {isDetecting ? (
          <div className="space-y-4">
            <Skeleton className="h-7 w-full rounded-lg" />
            <Skeleton className="h-7 w-full rounded-lg" />
            <Skeleton className="h-7 w-full rounded-lg" />
            <Skeleton className="h-7 w-full rounded-lg" />
            <Skeleton className="h-7 w-full rounded-lg" />
            <Skeleton className="h-7 w-full rounded-lg" />
          </div>
        ) : hardwareInfo ? (
          <div className="space-y-2">
            {renderInfoRow('GPU', hardwareInfo.gpu_name)}
            {renderInfoRow('CPU', hardwareInfo.cpu_name)}
            {renderInfoRow('CPU Cores', hardwareInfo.cpu_cores)}
            {renderInfoRow(
              'Memory',
              hardwareInfo.memory_gb ? `${hardwareInfo.memory_gb} GB` : undefined,
            )}
            {renderInfoRow('FFmpeg Version', hardwareInfo.ffmpeg_version)}
            {renderInfoRow(
              'NVENC',
              hardwareInfo.nvenc_support,
              hardwareInfo.nvenc_support ? 'bg-emerald-100 text-emerald-800' : '',
            )}
            {renderInfoRow(
              'QSV',
              hardwareInfo.qsv_support,
              hardwareInfo.qsv_support ? 'bg-emerald-100 text-emerald-800' : '',
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Cpu className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="font-semibold text-gray-200 mb-2 text-lg">No Hardware Info</h3>
            <p className="text-gray-400 mb-4">Click below to detect your system hardware</p>
            <Button
              onClick={onDetect}
              disabled={isDetecting}
              className="bg-gray-700/60 text-white hover:bg-gray-700/80"
            >
              <Zap className="w-4 h-4 mr-2" />
              {isDetecting ? 'Detecting...' : 'Detect Hardware'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
