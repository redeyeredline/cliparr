import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

interface DatabaseConfig {
  user: string;
  host: string;
  database: string;
  password: string;
  port: number;
}

interface SonarrConfig {
  url: string;
  apiKey: string;
}

interface AppConfig {
  port: number;
  environment: 'development' | 'production' | 'test';
  dataDir: string;
  mediaDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

interface Config {
  database: DatabaseConfig;
  sonarr: SonarrConfig;
  app: AppConfig;
}

// Default configuration
const defaultConfig: Config = {
  database: {
    user: 'postgres',
    host: 'localhost',
    database: 'cliparr',
    password: 'postgres',
    port: 5432,
  },
  sonarr: {
    url: 'http://localhost:8989',
    apiKey: '',
  },
  app: {
    port: 8484,
    environment: 'development',
    dataDir: '/opt/dockerdata/cliparr',
    mediaDir: '/opt/dockerdata/cliparr/media',
    logLevel: 'info',
  },
};

// Load configuration from environment variables
const loadConfig = (): Config => {
  return {
    database: {
      user: process.env.POSTGRES_USER || defaultConfig.database.user,
      host: process.env.POSTGRES_HOST || defaultConfig.database.host,
      database: process.env.POSTGRES_DB || defaultConfig.database.database,
      password: process.env.POSTGRES_PASSWORD || defaultConfig.database.password,
      port: parseInt(process.env.POSTGRES_PORT || String(defaultConfig.database.port)),
    },
    sonarr: {
      url: process.env.SONARR_URL || defaultConfig.sonarr.url,
      apiKey: process.env.SONARR_API_KEY || defaultConfig.sonarr.apiKey,
    },
    app: {
      port: parseInt(process.env.PORT || String(defaultConfig.app.port)),
      environment:
        (process.env.NODE_ENV as Config['app']['environment']) || defaultConfig.app.environment,
      dataDir: process.env.DATA_DIR || defaultConfig.app.dataDir,
      mediaDir: process.env.MEDIA_DIR || defaultConfig.app.mediaDir,
      logLevel: (process.env.LOG_LEVEL as Config['app']['logLevel']) || defaultConfig.app.logLevel,
    },
  };
};

// Validate configuration
const validateConfig = (config: Config): void => {
  const errors: string[] = [];

  // Validate database configuration
  if (!config.database.user) errors.push('Database user is required');
  if (!config.database.host) errors.push('Database host is required');
  if (!config.database.database) errors.push('Database name is required');
  if (!config.database.password) errors.push('Database password is required');
  if (isNaN(config.database.port)) errors.push('Database port must be a number');

  // Validate Sonarr configuration
  if (!config.sonarr.url) errors.push('Sonarr URL is required');
  if (!config.sonarr.apiKey) errors.push('Sonarr API key is required');

  // Validate app configuration
  if (isNaN(config.app.port)) errors.push('App port must be a number');
  if (!['development', 'production', 'test'].includes(config.app.environment)) {
    errors.push('Invalid environment');
  }
  if (!['debug', 'info', 'warn', 'error'].includes(config.app.logLevel)) {
    errors.push('Invalid log level');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
};

// Create and validate configuration
const config = loadConfig();
validateConfig(config);

// Export configuration
export default config;

// Export types for use in other files
export type { Config, DatabaseConfig, SonarrConfig, AppConfig };
