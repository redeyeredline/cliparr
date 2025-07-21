import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Cpu,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Gauge,
  RefreshCw,
  Settings,
} from 'lucide-react';

import HardwareDetection from '../components/HardwareDetection';
import ProcessingProfiles from '../components/ProcessingProfiles';
import PerformanceBenchmark from '../components/PerformanceBenchmark';
import { apiClient } from '../integration/api-client';
import { wsClient } from '../services/websocket.frontend';

interface HardwareInfo {
  [key: string]: any;
}

interface BenchmarkResults {
  cpu_score: number;
  gpu_score: number;
  memory_bandwidth: number;
  encoding_speed: {
    [key: string]: { [key: string]: number };
  };
  recommended_profiles: string[];
  benchmark_duration: number;
  timestamp: string;
  note?: string;
}

interface Progress {
  stage: string;
  percent: number;
  status: string;
  message: string;
  results?: BenchmarkResults;
}

export default function Hardware() {
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResults | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const progressRef = useRef<Progress | null>(null);

  // On first load, fetch cached hardware info and benchmark results
  useEffect(() => {
    const loadInitialData = async () => {
      setError(null);
      try {
        const hwResp = await apiClient.getHardwareInfo();
        if (hwResp.status === 'success') {
          setHardwareInfo(hwResp.data);
        }
      } catch (e) {
        // No cached hardware info yet is not a fatal error
        setHardwareInfo(null);
      }
      try {
        const benchResp = await apiClient.getBenchmarkResults();
        if (benchResp.status === 'success') {
          setBenchmarkResults(benchResp.data);
        }
      } catch (e) {
        setBenchmarkResults(null);
      }
      setProfiles([]); // Profiles not implemented yet
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    // Listen for benchmark progress events
    const handleProgress = (data: any) => {
      if (data.type === 'benchmark_progress') {
        setProgress(data);
        progressRef.current = data;
        // If complete, set results and stop benchmarking
        if (data.stage === 'complete') {
          setBenchmarkResults(data.results);
          setIsBenchmarking(false);
          setProgress(null);
        }
      }
    };
    wsClient.connect();
    wsClient.addEventListener('message', handleProgress);
    return () => {
      wsClient.removeEventListener('message', handleProgress);
    };
  }, []);

  // Only re-detect hardware if user clicks button
  const detectHardware = async () => {
    setIsDetecting(true);
    setError(null);
    try {
      const response = await apiClient.detectHardware();
      if (response.status === 'success') {
        setHardwareInfo(response.data);
      } else {
        throw new Error(response.error || 'Hardware detection failed');
      }
    } catch (detectError: any) {
      console.error('Hardware detection failed:', detectError);
      setError(detectError.message || 'Hardware detection failed');
    }
    setIsDetecting(false);
  };

  // Only run benchmark if user clicks button
  const runBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkResults(null);
    setError(null);
    setProgress({
      stage: 'Starting',
      percent: 0,
      status: 'running',
      message: 'Starting benchmark...',
    });
    try {
      const response = await apiClient.runHardwareBenchmark();
      if (response.status === 'success') {
        // Results will be set by WebSocket event
      } else {
        throw new Error(response.error || 'Benchmark failed');
      }
    } catch (benchmarkError: any) {
      console.error('Benchmark failed:', benchmarkError);
      setError(benchmarkError.message || 'Benchmark failed');
      setIsBenchmarking(false);
      setProgress(null);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-8xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Hardware Detection & Profiles</h1>
          <p className="text-slate-600 font-medium">
            Detect system hardware and configure processing profiles
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={detectHardware}
            disabled={isDetecting}
            variant="outline"
            className="border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isDetecting ? 'animate-spin' : ''}`} />
            {isDetecting ? 'Detecting...' : 'Detect Hardware'}
          </Button>
          <Button
            onClick={runBenchmark}
            disabled={isBenchmarking || !hardwareInfo}
            className="bg-slate-800 hover:bg-slate-900"
          >
            <Gauge className="w-4 h-4 mr-2" />
            {isBenchmarking ? 'Running Benchmark...' : 'Run Benchmark'}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-800 font-medium">Error</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Hardware Detection */}
        <div className="lg:col-span-2 space-y-6">
          <HardwareDetection
            hardwareInfo={hardwareInfo}
            isDetecting={isDetecting}
            onDetect={detectHardware}
          />

          <ProcessingProfiles
            profiles={profiles}
            hardwareInfo={hardwareInfo}
            onRefresh={() => {
              /* intentionally left blank */
            }}
          />
        </div>

        {/* Performance Benchmark */}
        <div style={{ minWidth: 400, maxWidth: 400 }}>
          <PerformanceBenchmark
            benchmarkResults={benchmarkResults}
            isBenchmarking={isBenchmarking}
            hardwareInfo={hardwareInfo}
            onRunBenchmark={runBenchmark}
            progress={progress}
          />
        </div>
      </div>
    </div>
  );
}
