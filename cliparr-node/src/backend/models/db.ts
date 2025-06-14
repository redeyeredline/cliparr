import { Pool } from 'pg';
import pino from 'pino';
import { config } from '../config';

const logger = pino({
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
      : undefined,
});

const pool = new Pool({
  host: config.database.host, // Unix socket
  port: config.database.port,
  user: config.database.user, // 'cliparr'
  database: config.database.database, // 'cliparr'
  password: config.database.password, // ''
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  logger.info('PostgreSQL pool connected');
});

pool.on('error', (err) => {
  logger.error({ msg: 'PostgreSQL pool error', error: err instanceof Error ? err.message : err });
});

export default pool;
