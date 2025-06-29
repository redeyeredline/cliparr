#!/usr/bin/env node

import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
});

async function clearRedis() {
  console.log('Clearing Redis database...');

  try {
    // Get all keys
    const keys = await redis.keys('*');
    console.log(`Found ${keys.length} keys in Redis`);

    if (keys.length > 0) {
      // Delete all keys
      await redis.del(...keys);
      console.log('✅ All Redis keys deleted');
    } else {
      console.log('No keys found in Redis');
    }

    // Also flush the database to be sure
    await redis.flushdb();
    console.log('✅ Redis database flushed');

    await redis.disconnect();
    console.log('Redis cleared successfully!');
  } catch (error) {
    console.error('Failed to clear Redis:', error);
    await redis.disconnect();
  }
}

clearRedis().catch(console.error);
