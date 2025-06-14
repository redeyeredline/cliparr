import dotenv from 'dotenv';

dotenv.config();

function formatSonarrUrl(url: string): string {
    // Remove any existing protocol
    let cleanUrl = url.replace(/^https?:\/\//, '');
    
    // Split into host and port if port exists
    const [host, port] = cleanUrl.split(':');
    
    // Reconstruct URL with protocol
    return `http://${host}${port ? `:${port}` : ':8989'}`;
}

export const config = {
    sonarr: {
        url: process.env.SONARR_URL ? formatSonarrUrl(process.env.SONARR_URL) : 'http://localhost:8989',
        apiKey: process.env.SONARR_API_KEY || '',
    },
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost',
    },
    database: {
        host: '/var/run/postgresql', // Use Unix socket
        port: 5432,
        database: 'cliparr',
        user: 'cliparr',
        password: '', // No password needed for peer auth
    },
    import: {
        mode: process.env.IMPORT_MODE || 'none',
    },
}; 