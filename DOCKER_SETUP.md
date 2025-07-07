# Docker Setup for Cliparr

## Using GitHub Container Registry (Recommended)

Cliparr is available as a Docker image from GitHub Container Registry, similar to how Tdarr works.

### Quick Start

1. **Update the image name** in `docker-compose.yml`:
   ```yaml
   image: ghcr.io/redeyeredline/cliparr-dev:latest
   ```
   (This is your actual image name.)

2. **Set your data and media directories in `docker-compose.yml`**:
   - The following are just examples. You can use any absolute or relative paths you want.
   - If you do not set a volume, the app will use its internal default (`./data` relative to the container's working directory).
   ```yaml
   volumes:
     - ./data:/app/data  # Or use an absolute path like /opt/dockerdata/cliparr/data:/app/data
     - /path/to/your/media:/media:ro  # Change this to your media directory
   ```

3. **Start the container**:
   ```bash
   docker-compose up -d
   ```

### Hardware Acceleration (Optional)

If you have an NVIDIA GPU, uncomment the NVIDIA runtime section in `docker-compose.yml`:

```yaml
# NVIDIA runtime (uncomment if you have NVIDIA GPU)
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: all
          capabilities: [gpu]
```

### Setting Up GitHub Container Registry

To publish your own image to GHCR:

1. **Enable GitHub Actions** in your repository settings
2. **Push to main branch** - The workflow will automatically build and push the image
3. **Create a release** with a tag (e.g., `v1.0.0`) to create a tagged image

The workflow will create images like:
- `ghcr.io/redeyeredline/cliparr-dev:latest` (latest main branch)
- `ghcr.io/redeyeredline/cliparr-dev:v1.0.0` (tagged releases)
- `ghcr.io/redeyeredline/cliparr-dev:main-abc123` (commit-specific)

### Local Development

For local development, you can build the image yourself:

```bash
docker build -t cliparr-dev:latest .
```

Then update `docker-compose.yml` to use:
```yaml
image: cliparr-dev:latest
```

### Accessing the Application

Once running, access Cliparr at:
- **Web Interface**: http://localhost:8484

### Data Persistence

- The application will use `/app/data` inside the container for all persistent data (database, logs, temp files, settings).
- You control where this maps on your host via the `docker-compose.yml` volume setting.
- If you do not set a volume, data will be stored inside the container and will be lost if the container is removed.

### Troubleshooting

1. **Check container logs**:
   ```bash
   docker-compose logs -f cliparr
   ```

2. **Check health status**:
   ```bash
   curl http://localhost:8484/health/status
   ```

3. **Reset data** (WARNING: This will delete all data):
   ```bash
   sudo rm -rf ./data/*
   docker-compose down
   docker-compose up -d
   ``` 