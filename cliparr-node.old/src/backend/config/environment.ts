import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface Config {
  sonarr: {
    url: string;
    apiKey: string;
  };
  app: {
    port: number;
    environment: 'development' | 'production';
    dataDir: string;
    mediaDir: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

// Default configuration
const defaultConfig: Config = {
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

  // Validate Sonarr configuration
  if (!config.sonarr.url) errors.push('Sonarr URL is required');
  if (!config.sonarr.apiKey) errors.push('Sonarr API key is required');

  // Validate app configuration
  if (isNaN(config.app.port)) errors.push('App port must be a number');
  if (!['development', 'production'].includes(config.app.environment)) {
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
export type { Config };
