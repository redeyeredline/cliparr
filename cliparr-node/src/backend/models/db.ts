import { Pool } from 'pg';
import pino from 'pino';

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
  user: 'postgres',
  password: 'postgres',
  database: 'cliparr',
  host: 'localhost',
  port: 5432,
});

pool.on('connect', () => {
  logger.info('PostgreSQL pool connected');
});

pool.on('error', (err) => {
  logger.error({ msg: 'PostgreSQL pool error', error: err instanceof Error ? err.message : err });
});

export default pool;
