# Docker Build Process

This project now supports two Docker image variants:

## Image Variants

### Base Image (`cliparr:latest`)
- **Size**: ~600MB smaller than NVIDIA variant
- **Features**: CPU encoding + Intel QuickSync (VA-API)
- **Use case**: General purpose, no NVIDIA GPU required
- **FFmpeg**: Built without NVIDIA support

### NVIDIA Image (`cliparr:nvidia`)
- **Size**: Larger due to NVIDIA dependencies
- **Features**: CPU encoding + Intel QuickSync + NVIDIA GPU acceleration
- **Use case**: Systems with NVIDIA GPUs for hardware acceleration
- **FFmpeg**: Built with NVIDIA CUDA support

## Build Process

The build process creates separate FFmpeg images for each variant:

1. **FFmpeg Base** (`ffmpeg-static:7.1.1-base`)
   - CPU + QuickSync support only
   - Smaller size
   - Used by `cliparr:latest`

2. **FFmpeg NVIDIA** (`ffmpeg-static:7.1.1-nvidia`)
   - CPU + QuickSync + NVIDIA support
   - Larger size due to CUDA dependencies
   - Used by `cliparr:nvidia`

## Local Building

To build both variants locally:

```bash
./build-images.sh
```

This will build:
- `ghcr.io/redeyeredline/ffmpeg-static:7.1.1-base`
- `ghcr.io/redeyeredline/ffmpeg-static:7.1.1-nvidia`
- `cliparr:latest`
- `cliparr:nvidia`

## Running the Images

### Base Image (CPU + QuickSync)
```bash
docker run -p 8484:8484 cliparr:latest
```

### NVIDIA Image (CPU + QuickSync + NVIDIA)
```bash
docker run --gpus all -p 8484:8484 cliparr:nvidia
```

## GitHub Actions

The GitHub workflow automatically builds both variants:
- `build-ffmpeg-base` → `build-cliparr-base` → `cliparr:latest`
- `build-ffmpeg-nvidia` → `build-cliparr-nvidia` → `cliparr:nvidia`

## File Structure

```
├── Dockerfile                    # Base image (CPU + QuickSync)
├── Dockerfile.nvidia            # NVIDIA image (CPU + QuickSync + NVIDIA)
├── docker/
│   ├── ffmpeg.Dockerfile        # FFmpeg base build
│   └── ffmpeg-nvidia.Dockerfile # FFmpeg NVIDIA build
└── .github/workflows/
    └── docker-build.yml         # CI/CD workflow
```

## Size Comparison

The base image should be approximately 600MB smaller than the NVIDIA variant due to:
- No NVIDIA CUDA toolkit
- No NVIDIA development libraries
- Smaller FFmpeg binary without NVIDIA codecs 