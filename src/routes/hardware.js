// Hardware detection routes for system information and capabilities
// Provides endpoints to detect GPU, CPU, memory, and FFmpeg support
import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import config from '../config/index.js';
import { getDb, getSetting } from '../database/Db_Operations.js';

const execAsync = promisify(exec);
const router = express.Router();

const DATA_DIR = path.join(process.cwd(), 'data');
const HARDWARE_INFO_PATH = path.join(DATA_DIR, 'hardware-info.json');
const BENCHMARK_RESULTS_PATH = path.join(DATA_DIR, 'benchmark-results.json');

async function ensureDataDir() {
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {}
}

// Helper to get the latest temp_dir from DB (same as in showProcessor.js)
async function getTempDir() {
  const db = await getDb();
  let tempDir = getSetting(db, 'temp_dir', null);
  if (!tempDir) {
    tempDir = require('os').tmpdir() + '/cliprr';
  }
  return tempDir;
}

async function readJsonFile(filePath, fallback = null) {
  try {
    const data = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return fallback;
  }
}

async function writeJsonFile(filePath, data) {
  await ensureDataDir();
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// GET hardware information
router.get('/detect', async (req, res) => {
  const logger = req.app.get('logger');

  try {
    logger.info('Hardware detection requested');

    const hardwareInfo = await detectHardware();

    res.json({
      status: 'success',
      data: hardwareInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Hardware detection failed:', error);
    res.status(500).json({
      status: 'error',
      error: 'Hardware detection failed',
      details: error.message,
    });
  }
});

// GET stored hardware info (no re-detect)
router.get('/info', async (req, res) => {
  const logger = req.app.get('logger');
  try {
    logger.info('Hardware info requested (from cache)');
    const hardwareInfo = await readJsonFile(HARDWARE_INFO_PATH);
    if (!hardwareInfo) {
      return res.status(404).json({ status: 'error', error: 'No hardware info found' });
    }
    res.json({ status: 'success', data: hardwareInfo });
  } catch (error) {
    logger.error('Failed to get hardware info:', error);
    res
      .status(500)
      .json({ status: 'error', error: 'Failed to get hardware info', details: error.message });
  }
});

// POST re-detect hardware and update stored info
router.post('/detect', async (req, res) => {
  const logger = req.app.get('logger');
  try {
    logger.info('Hardware detection requested (force re-detect)');
    const hardwareInfo = await detectHardware();
    await writeJsonFile(HARDWARE_INFO_PATH, hardwareInfo);
    res.json({ status: 'success', data: hardwareInfo, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Hardware detection failed:', error);
    res
      .status(500)
      .json({ status: 'error', error: 'Hardware detection failed', details: error.message });
  }
});

// GET stored benchmark results
router.get('/benchmark/results', async (req, res) => {
  const logger = req.app.get('logger');
  try {
    logger.info('Benchmark results requested (from cache)');
    const results = await readJsonFile(BENCHMARK_RESULTS_PATH);
    if (!results) {
      return res.status(404).json({ status: 'error', error: 'No benchmark results found' });
    }
    res.json({ status: 'success', data: results });
  } catch (error) {
    logger.error('Failed to get benchmark results:', error);
    res
      .status(500)
      .json({ status: 'error', error: 'Failed to get benchmark results', details: error.message });
  }
});

// POST run hardware benchmark and update stored results
router.post('/benchmark', async (req, res) => {
  const logger = req.app.get('logger');
  const wss = req.app.get('wss');

  try {
    logger.info('Hardware benchmark requested');

    const sendProgress = (progress) => {
      if (!wss) {
        return;
      }
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(
            JSON.stringify({
              type: 'benchmark_progress',
              ...progress,
              timestamp: new Date().toISOString(),
            }),
          );
        }
      });
    };

    const benchmarkResults = await runHardwareBenchmark(sendProgress);
    await writeJsonFile(BENCHMARK_RESULTS_PATH, benchmarkResults);

    // Final event
    sendProgress({
      stage: 'complete',
      percent: 100,
      status: 'complete',
      message: 'Benchmark complete',
      results: benchmarkResults,
    });

    res.json({
      status: 'success',
      data: benchmarkResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Hardware benchmark failed:', error);
    res
      .status(500)
      .json({ status: 'error', error: 'Hardware benchmark failed', details: error.message });
  }
});

async function runHardwareBenchmark(sendProgress) {
  const results = {
    encoding_speed: {
      h264_cpu: { '1080p': 0, '4k': 0 },
      h264_gpu: { '1080p': 0, '4k': 0 },
      h265_cpu: { '1080p': 0, '4k': 0 },
      h265_gpu: { '1080p': 0, '4k': 0 },
    },
    recommended_profiles: [],
    benchmark_duration: 0,
    note: 'Each encode type tested at 1080p (1920x1080) and 4K (3840x2160).',
    timestamp: new Date().toISOString(),
  };

  const startTime = Date.now();

  try {
    const encodingResults = await benchmarkEncoding(sendProgress);
    results.encoding_speed = encodingResults;
    results.recommended_profiles = generateRecommendedProfiles(results);
    results.benchmark_duration = Date.now() - startTime;
  } catch (error) {
    console.error('Error during hardware benchmark:', error);
    throw error;
  }

  return results;
}

async function benchmarkCPU() {
  try {
    // Create a temporary test file for CPU-intensive operations
    const testFile = path.join(config.tempDir, `cpu_benchmark_${Date.now()}.txt`);

    // Generate a large amount of data for processing
    const testData = 'A'.repeat(1000000); // 1MB of data
    fs.writeFileSync(testFile, testData);

    const startTime = process.hrtime.bigint();

    // Perform CPU-intensive operations
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }

    // Read and process the test file
    const fileContent = fs.readFileSync(testFile, 'utf8');
    const processed = fileContent.split('').reverse().join('');

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    // Clean up
    fs.unlinkSync(testFile);

    // Calculate CPU score (higher is better, based on speed)
    // Base score of 1000, with bonus for faster processing
    const baseScore = 1000;
    const speedBonus = Math.max(0, 2000 - duration);
    const cpuScore = Math.round(baseScore + speedBonus);

    return Math.max(500, Math.min(5000, cpuScore)); // Clamp between 500-5000
  } catch (error) {
    console.error('CPU benchmark failed:', error);
    return 1000; // Fallback score
  }
}

async function benchmarkGPU() {
  try {
    // Check if we have GPU capabilities
    const hardwareInfo = await detectHardware();

    if (!hardwareInfo.nvenc_support && !hardwareInfo.qsv_support) {
      return 0; // No GPU acceleration available
    }

    // Test GPU encoding speed with a small test video
    const testFile = path.join(config.tempDir, `gpu_benchmark_${Date.now()}.mp4`);

    const startTime = process.hrtime.bigint();

    // Create a test video and encode it with GPU acceleration
    let encoder = 'libx264'; // Default CPU encoder
    if (hardwareInfo.nvenc_support) {
      encoder = 'h264_nvenc';
    } else if (hardwareInfo.qsv_support) {
      encoder = 'h264_qsv';
    }

    // Generate a test video and encode it
    await execAsync(
      `ffmpeg -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 -c:v ${encoder} -preset fast -t 10 "${testFile}" 2>/dev/null`,
    );

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    // Clean up
    try {
      fs.unlinkSync(testFile);
    } catch (e) {
      // Ignore cleanup errors
    }

    // Calculate GPU score (higher is better, based on encoding speed)
    // Base score of 2000, with bonus for faster encoding
    const baseScore = 2000;
    const speedBonus = Math.max(0, 6000 - duration);
    const gpuScore = Math.round(baseScore + speedBonus);

    return Math.max(1000, Math.min(10000, gpuScore)); // Clamp between 1000-10000
  } catch (error) {
    console.error('GPU benchmark failed:', error);
    return 0; // No GPU acceleration
  }
}

async function benchmarkMemory() {
  try {
    const startTime = process.hrtime.bigint();

    // Allocate and process large arrays to test memory bandwidth
    const size = 10000000; // 10 million elements
    const array1 = new Float64Array(size);
    const array2 = new Float64Array(size);

    // Fill arrays with data
    for (let i = 0; i < size; i++) {
      array1[i] = Math.random();
      array2[i] = Math.random();
    }

    // Perform memory-intensive operations
    let sum = 0;
    for (let i = 0; i < size; i++) {
      sum += array1[i] * array2[i];
    }

    // Additional memory operations
    const array3 = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      array3[i] = array1[i] + array2[i];
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    // Calculate memory bandwidth score (MB/s)
    // Estimate data processed: 3 arrays * 8 bytes per element * 10M elements = 240MB
    const dataProcessed = 240; // MB
    const bandwidth = Math.round((dataProcessed / duration) * 1000); // MB/s

    return Math.max(10, Math.min(100, bandwidth)); // Clamp between 10-100 MB/s
  } catch (error) {
    console.error('Memory benchmark failed:', error);
    return 25; // Fallback bandwidth
  }
}

async function benchmarkEncoding(sendProgress) {
  const results = {
    h264_cpu: { '1080p': 0, '4k': 0 },
    h264_gpu: { '1080p': 0, '4k': 0 },
    h265_cpu: { '1080p': 0, '4k': 0 },
    h265_gpu: { '1080p': 0, '4k': 0 },
  };

  const resolutions = [
    { label: '1080p', size: '1920x1080' },
    { label: '4k', size: '3840x2160' },
  ];
  const duration = 10;
  const timeout = 30000;

  async function runFfmpegTest(codec, encoder, resLabel, resSize) {
    // Get temp directory from settings
    const tempDir = await getTempDir();
    await fsp.mkdir(tempDir, { recursive: true });

    const testFile = path.join(
      tempDir,
      `encoding_benchmark_${codec}_${resLabel}_${Date.now()}.mp4`,
    );
    try {
      const { stderr } = await execAsync(
        `ffmpeg -f lavfi -i testsrc=duration=${duration}:size=${resSize}:rate=30 -c:v ${encoder} -preset fast -t ${duration} -y "${testFile}"`,
        { timeout },
      );

      // Parse the speed from FFmpeg output (e.g., "speed=10.6x")
      const speedMatch = stderr.match(/speed=(\d+\.?\d*)x/);
      if (speedMatch) {
        const speed = parseFloat(speedMatch[1]);
        // Convert speed to FPS (30 fps input * speed multiplier)
        return Math.round(30 * speed);
      }

      // Fallback: try to parse frame count and calculate FPS
      const frameMatch = stderr.match(/frame=\s*(\d+)/);
      if (frameMatch) {
        const frames = parseInt(frameMatch[1], 10);
        // For a 10-second test at 30fps, we expect 300 frames
        // Calculate FPS based on actual frames vs expected frames
        const expectedFrames = duration * 30;
        const fpsRatio = frames / expectedFrames;
        return Math.round(30 * fpsRatio);
      }

      return 0;
    } catch (e) {
      console.error(`FFmpeg test failed for ${encoder}:`, e.message);
      return 0;
    } finally {
      try {
        fs.unlinkSync(testFile);
      } catch (e) {}
    }
  }

  const hardwareInfo = await detectHardware();

  for (const res of resolutions) {
    // H.264 CPU
    results.h264_cpu[res.label] = await runFfmpegTest('h264_cpu', 'libx264', res.label, res.size);
    // H.264 GPU (NVENC or QSV)
    if (hardwareInfo.nvenc_support) {
      results.h264_gpu[res.label] = await runFfmpegTest(
        'h264_gpu',
        'h264_nvenc',
        res.label,
        res.size,
      );
    } else if (hardwareInfo.qsv_support) {
      results.h264_gpu[res.label] = await runFfmpegTest(
        'h264_gpu',
        'h264_qsv',
        res.label,
        res.size,
      );
    }
    // H.265 CPU
    results.h265_cpu[res.label] = await runFfmpegTest('h265_cpu', 'libx265', res.label, res.size);
    // H.265 GPU (NVENC or QSV)
    if (hardwareInfo.nvenc_support) {
      results.h265_gpu[res.label] = await runFfmpegTest(
        'h265_gpu',
        'hevc_nvenc',
        res.label,
        res.size,
      );
    } else if (hardwareInfo.qsv_support) {
      results.h265_gpu[res.label] = await runFfmpegTest(
        'h265_gpu',
        'hevc_qsv',
        res.label,
        res.size,
      );
    }
  }

  return results;
}

function generateRecommendedProfiles(benchmarkResults) {
  const profiles = [];

  // Determine best encoding method
  const h264CpuSpeed = benchmarkResults.encoding_speed.h264_cpu['1080p'];
  const h264GpuSpeed = benchmarkResults.encoding_speed.h264_gpu['1080p'];
  const h265CpuSpeed = benchmarkResults.encoding_speed.h265_cpu['1080p'];
  const h265GpuSpeed = benchmarkResults.encoding_speed.h265_gpu['1080p'];

  // High Quality profile
  if (h265GpuSpeed > h265CpuSpeed && h265GpuSpeed > 10) {
    profiles.push('High Quality (H.265 GPU)');
  } else if (h265CpuSpeed > 5) {
    profiles.push('High Quality (H.265 CPU)');
  } else if (h264GpuSpeed > h264CpuSpeed && h264GpuSpeed > 15) {
    profiles.push('High Quality (H.264 GPU)');
  } else {
    profiles.push('High Quality (H.264 CPU)');
  }

  // Fast Processing profile
  if (h264GpuSpeed > 20) {
    profiles.push('Fast Processing (H.264 GPU)');
  } else if (h264CpuSpeed > 10) {
    profiles.push('Fast Processing (H.264 CPU)');
  } else {
    profiles.push('Fast Processing (Balanced)');
  }

  // Archive Quality profile
  if (h265CpuSpeed > 3) {
    profiles.push('Archive Quality (H.265)');
  } else {
    profiles.push('Archive Quality (H.264)');
  }

  return profiles;
}

async function detectHardware() {
  const hardwareInfo = {
    gpu_name: null,
    cpu_name: null,
    cpu_cores: os.cpus().length,
    memory_gb: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    ffmpeg_version: null,
    nvenc_support: false,
    qsv_support: false,
    last_detected: new Date().toISOString(),
  };

  try {
    // Detect GPU
    hardwareInfo.gpu_name = await detectGPU();

    // Detect CPU name
    hardwareInfo.cpu_name = await detectCPU();

    // Detect FFmpeg version and capabilities
    const ffmpegInfo = await detectFFmpeg();
    hardwareInfo.ffmpeg_version = ffmpegInfo.version;
    hardwareInfo.nvenc_support = ffmpegInfo.nvenc_support;
    hardwareInfo.qsv_support = ffmpegInfo.qsv_support;
  } catch (error) {
    console.error('Error during hardware detection:', error);
  }

  return hardwareInfo;
}

async function detectGPU() {
  try {
    // Try to detect NVIDIA GPU first
    const { stdout: nvidiaOutput } = await execAsync(
      'nvidia-smi --query-gpu=name --format=csv,noheader,nounits 2>/dev/null || echo ""',
    );
    if (nvidiaOutput.trim()) {
      return nvidiaOutput.trim();
    }

    // Try to detect GPU via lspci
    const { stdout: lspciOutput } = await execAsync(
      'lspci | grep -i "vga|3d|display" | head -1 2>/dev/null || echo ""',
    );
    if (lspciOutput.trim()) {
      // Extract GPU name from lspci output
      const match = lspciOutput.match(/:\s*(.+)$/);
      return match ? match[1].trim() : lspciOutput.trim();
    }

    // Try to detect via /proc/gpuinfo (for some systems)
    try {
      const { stdout: gpuinfoOutput } = await execAsync(
        'cat /proc/gpuinfo 2>/dev/null | grep "Model" | head -1 || echo ""',
      );
      if (gpuinfoOutput.trim()) {
        const match = gpuinfoOutput.match(/Model:\s*(.+)$/);
        return match ? match[1].trim() : null;
      }
    } catch (e) {
      // Ignore errors for this method
    }

    return null;
  } catch (error) {
    console.error('GPU detection failed:', error);
    return null;
  }
}

async function detectCPU() {
  try {
    // Try to get CPU info from /proc/cpuinfo
    const { stdout: cpuinfoOutput } = await execAsync(
      'cat /proc/cpuinfo 2>/dev/null | grep "model name" | head -1 || echo ""',
    );
    if (cpuinfoOutput.trim()) {
      const match = cpuinfoOutput.match(/model name\s*:\s*(.*)/i);
      return match ? match[1].trim() : null;
    }

    // Fallback: try lscpu
    const { stdout: lscpuOutput } = await execAsync(
      'lscpu 2>/dev/null | grep "Model name" | head -1 || echo ""',
    );
    if (lscpuOutput.trim()) {
      const match = lscpuOutput.match(/Model name:\s*(.*)/i);
      return match ? match[1].trim() : null;
    }

    // Fallback: try sysctl on macOS
    try {
      const { stdout: sysctlOutput } = await execAsync(
        'sysctl -n machdep.cpu.brand_string 2>/dev/null || echo ""',
      );
      if (sysctlOutput.trim()) {
        return sysctlOutput.trim();
      }
    } catch (e) {
      // Ignore errors for this method
    }

    return null;
  } catch (error) {
    console.error('CPU detection failed:', error);
    return null;
  }
}

async function detectFFmpeg() {
  const result = {
    version: null,
    nvenc_support: false,
    qsv_support: false,
  };

  try {
    // Get FFmpeg version
    const { stdout: versionOutput } = await execAsync(
      'ffmpeg -version 2>/dev/null | head -1 || echo ""',
    );
    if (versionOutput.trim()) {
      const versionMatch = versionOutput.match(/ffmpeg version ([^\s]+)/);
      result.version = versionMatch ? versionMatch[1] : null;
    }

    // Test NVENC support by actually trying to encode
    try {
      await execAsync(
        'ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=1 -c:v h264_nvenc -t 1 -f null - 2>/dev/null',
      );
      result.nvenc_support = true;
    } catch (e) {
      result.nvenc_support = false;
    }

    // Test QSV support by actually trying to encode
    try {
      const { stderr } = await execAsync(
        'ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=1 -c:v h264_qsv -t 1 -f null - 2>&1',
      );
      // Check if the encoding actually succeeded by looking for successful output
      if (stderr.includes('Conversion failed!') || stderr.includes('Error while opening encoder')) {
        result.qsv_support = false;
      } else {
        result.qsv_support = true;
      }
    } catch (e) {
      result.qsv_support = false;
    }
  } catch (error) {
    console.error('FFmpeg detection failed:', error);
  }

  return result;
}

export default router;
