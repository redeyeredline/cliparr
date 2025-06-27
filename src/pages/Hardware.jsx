import React, { useState, useEffect } from 'react';
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

export default function Hardware() {
  const [hardwareInfo, setHardwareInfo] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setError(null);
      // Load hardware info if available
      const response = await apiClient.getHardwareInfo();
      if (response.status === 'success') {
        setHardwareInfo(response.data);
      }
      // For now, we'll use empty profiles since the entities aren't implemented yet
      setProfiles([]);
    } catch (error) {
      console.error('Error loading hardware data:', error);
      setError('Failed to load hardware information');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
    } catch (error) {
      console.error('Hardware detection failed:', error);
      setError(error.message || 'Hardware detection failed');
    }

    setIsDetecting(false);
  };

  const runBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkResults(null);
    setError(null);

    try {
      // Simulate benchmark results for now
      // In the future, this could be a real benchmark API
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const mockResults = {
        cpu_score: Math.floor(Math.random() * 3000) + 1000,
        gpu_score: Math.floor(Math.random() * 8000) + 2000,
        memory_bandwidth: Math.floor(Math.random() * 50) + 25,
        encoding_speed: {
          h264_cpu: Math.floor(Math.random() * 10) + 5,
          h264_gpu: Math.floor(Math.random() * 50) + 25,
          h265_cpu: Math.floor(Math.random() * 5) + 2,
          h265_gpu: Math.floor(Math.random() * 30) + 15,
        },
        recommended_profiles: [
          hardwareInfo?.nvenc_support ? 'High Quality (NVENC)' : 'Balanced (CPU)',
          'Fast Processing',
          'Archive Quality',
        ],
      };

      setBenchmarkResults(mockResults);
    } catch (error) {
      console.error('Benchmark failed:', error);
      setError('Benchmark failed');
    }

    setIsBenchmarking(false);
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
            onRefresh={loadData}
          />
        </div>

        {/* Performance Benchmark */}
        <div>
          <PerformanceBenchmark
            benchmarkResults={benchmarkResults}
            isBenchmarking={isBenchmarking}
            hardwareInfo={hardwareInfo}
            onRunBenchmark={runBenchmark}
          />
        </div>
      </div>
    </div>
  );
}
