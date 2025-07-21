// System diagnostics page displaying server uptime and database performance statistics.
// Shows query performance metrics and slowest queries for monitoring system health.
import React, { useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';

const SystemPage = () => {
  const [uptime, setUptime] = useState(0);
  const [dbStats, setDbStats] = useState({
    avgQueryTime: 0,
    slowestQueries: [],
    queryCount: 0,
  });

  useEffect(() => {
    const backendBase =
      import.meta.env.VITE_BACKEND_URL ||
      `${window.location.protocol}//${window.location.hostname}:8485`;
    const fetchStats = async () => {
      try {
        const res = await fetch(`${backendBase}/health/system/diagnostics`);
        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        setUptime(Math.floor(data.uptime));
        setDbStats(data.dbStats);
      } catch (err) {
        console.error('Failed to fetch system diagnostics:', err);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m ${seconds % 60}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m ${seconds % 60}s`;
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="mb-8 flex items-center space-x-4">
            <Cpu className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">System Diagnostics</h1>
          </div>

          {/* Uptime */}
          <div className="text-gray-400 mb-6">
            <span className="font-semibold text-blue-300">Uptime:</span> {formatUptime(uptime)}
          </div>

          {/* DB Stats Section */}
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/30 shadow-2xl p-8 mb-8">
            <h2 className="text-lg font-semibold text-blue-300 mb-4">Database Performance</h2>
            <div className="text-gray-300 mb-2">
              Average Query Time: <span className="font-mono">{dbStats.avgQueryTime}ms</span>
            </div>
            <div className="text-gray-300 mb-2">
              Query Count: <span className="font-mono">{dbStats.queryCount}</span>
            </div>
            <div className="text-gray-300 mb-2">Slowest Queries:</div>
            <ul className="text-gray-400 text-sm pl-4 list-disc">
              {dbStats.slowestQueries.map((q, i) => (
                <li key={i}>
                  {q.sql} - <span className="font-mono">{q.duration}ms</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemPage;
