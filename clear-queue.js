#!/usr/bin/env node

import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
});

const queueNames = [
  'episode-processing',
  'audio-extraction',
  'fingerprinting',
  'detection',
  'trimming',
];

async function clearAllQueues() {
  console.log('Clearing all queues...');

  for (const queueName of queueNames) {
    try {
      const queue = new Queue(queueName, { connection: redis });

      // Get all jobs
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const delayed = await queue.getDelayed();

      // Remove all jobs
      for (const job of [...waiting, ...active, ...delayed]) {
        await job.remove();
      }

      console.log(`✅ Cleared ${queueName}: ${waiting.length} waiting, ${active.length} active, ${delayed.length} delayed`);

      await queue.close();
    } catch (error) {
      console.error(`❌ Failed to clear ${queueName}:`, error.message);
    }
  }

  await redis.disconnect();
  console.log('Queue clearing completed!');
}

clearAllQueues().catch(console.error);
