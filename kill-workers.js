#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function killWorkers() {
  console.warn('Killing audio extraction and fingerprinting workers...');

  try {
    // Kill ffmpeg processes that are extracting audio for our app
    console.warn('Killing ffmpeg audio extraction processes...');
    await execAsync('pkill -f "ffmpeg.*-vn.*-acodec pcm_s16le"');
    console.warn('✅ ffmpeg audio extraction processes killed');
  } catch {
    console.warn('No ffmpeg audio extraction processes found');
  }

  try {
    // Kill ffmpeg chunk extraction processes
    console.warn('Killing ffmpeg chunk extraction processes...');
    await execAsync('pkill -f "ffmpeg.*-ss.*-t.*chunk_"');
    console.warn('✅ ffmpeg chunk extraction processes killed');
  } catch {
    console.warn('No ffmpeg chunk extraction processes found');
  }

  try {
    // Kill fpcalc fingerprinting processes
    console.warn('Killing fpcalc fingerprinting processes...');
    await execAsync('pkill -f "fpcalc"');
    console.warn('✅ fpcalc fingerprinting processes killed');
  } catch {
    console.warn('No fpcalc processes found');
  }

  console.warn('All audio processing workers killed!');
}

killWorkers().catch(console.error);
