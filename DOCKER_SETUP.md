# Docker Setup for Cliparr

## Using GitHub Container Registry (Recommended)

Cliparr is available as a Docker image from GitHub Container Registry, similar to how Tdarr works.

### Quick Start

1. **Update the image name** in `docker-compose.yml`:
   ```yaml
   image: ghcr.io/YOUR_USERNAME/cliparr:latest
   ```
   Replace `YOUR_USERNAME` with your GitHub username.

2. **Create the data directory**:
   ```bash
   sudo mkdir -p /opt/dockerdata/cliparr/data
   sudo chown $USER:$USER /opt/dockerdata/cliparr/data
   ```

3. **Update media path** in `docker-compose.yml`:
   ```yaml
   volumes:
     - /opt/dockerdata/cliparr/data:/app/data
     - /path/to/your/media:/media:ro  # Change this to your media directory
   ```

4. **Start the container**:
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
- `ghcr.io/yourusername/cliparr:latest` (latest main branch)
- `ghcr.io/yourusername/cliparr:v1.0.0` (tagged releases)
- `ghcr.io/yourusername/cliparr:main-abc123` (commit-specific)

### Local Development

For local development, you can build the image yourself:

```bash
docker build -t cliparr:latest .
```

Then update `docker-compose.yml` to use:
```yaml
image: cliparr:latest
```

### Accessing the Application

Once running, access Cliparr at:
- **Web Interface**: http://localhost:8484

### Data Persistence

The application data is stored in `/opt/dockerdata/cliparr/data` and includes:
- SQLite database
- Log files
- Temporary processing files
- Application settings

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
   sudo rm -rf /opt/dockerdata/cliparr/data/*
   docker-compose down
   docker-compose up -d
   ``` 