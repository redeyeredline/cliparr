import config from '../src/backend/config/environment';

describe('Environment Configuration', () => {
  it('should load configuration with default values', () => {
    expect(config).toBeDefined();
    expect(config.database).toBeDefined();
    expect(config.sonarr).toBeDefined();
    expect(config.app).toBeDefined();
  });

  it('should have valid database configuration', () => {
    expect(config.database.path).toBeDefined();
    expect(typeof config.database.path).toBe('string');
  });

  it('should have valid Sonarr configuration', () => {
    expect(config.sonarr.url).toBeDefined();
    expect(config.sonarr.apiKey).toBeDefined();
  });

  it('should have valid app configuration', () => {
    expect(typeof config.app.port).toBe('number');
    expect(['development', 'production', 'test']).toContain(config.app.environment);
    expect(config.app.dataDir).toBeDefined();
    expect(config.app.mediaDir).toBeDefined();
    expect(['debug', 'info', 'warn', 'error']).toContain(config.app.logLevel);
  });

  it('should have correct data directory structure', () => {
    expect(config.app.mediaDir).toContain(config.app.dataDir);
  });
});
