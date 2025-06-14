import dotenv from 'dotenv';

dotenv.config();

export const config = {
    sonarr: {
        url: process.env.SONARR_URL || 'http://localhost:8989',
        apiKey: process.env.SONARR_API_KEY || '',
    },
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost',
    },
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'cliparr',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
    },
    import: {
        mode: process.env.IMPORT_MODE || 'none',
    },
}; 