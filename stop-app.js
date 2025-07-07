#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function stopApp() {
  console.warn('Stopping all application processes...');

  try {
    // Stop Vite processes
    console.warn('Stopping Vite processes...');
    await execAsync('pkill -f "vite"');
    console.warn('✅ Vite processes stopped');
  } catch {
    console.warn('No Vite processes found or already stopped');
  }

  try {
    // Stop Node.js app processes (but not Cursor/VS Code processes)
    console.warn('Stopping Node.js app processes...');
    await execAsync('pkill -f "node.*app.js"');
    await execAsync('pkill -f "node.*server.js"');
    console.warn('✅ Node.js app processes stopped');
  } catch {
    console.warn('No Node.js app processes found or already stopped');
  }

  try {
    // Stop any remaining workers
    console.warn('Stopping any remaining workers...');
    await execAsync('pkill -f "episode-processing"');
    await execAsync('pkill -f "audio-extraction"');
    await execAsync('pkill -f "fingerprinting"');
    await execAsync('pkill -f "detection"');
    await execAsync('pkill -f "trimming"');
    console.warn('✅ Worker processes stopped');
  } catch {
    console.warn('No worker processes found or already stopped');
  }

  console.warn('Application stopped successfully!');
}

stopApp().catch(console.error);
