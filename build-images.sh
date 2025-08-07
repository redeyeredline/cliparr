#!/bin/bash

# Build script for Cliparr Docker images
# This script builds both the base and NVIDIA variants

set -e

echo "🔨 Building Cliparr Docker images..."

# Build FFmpeg base image
echo "📦 Building FFmpeg base image..."
docker build -f docker/ffmpeg.Dockerfile -t ghcr.io/redeyeredline/ffmpeg-static:7.1.1-base .

# Build FFmpeg NVIDIA image
echo "📦 Building FFmpeg NVIDIA image..."
docker build -f docker/ffmpeg-nvidia.Dockerfile -t ghcr.io/redeyeredline/ffmpeg-static:7.1.1-nvidia .

# Build Cliparr base image
echo "📦 Building Cliparr base image..."
docker build -f Dockerfile --build-arg FFMPEG_IMAGE=ghcr.io/redeyeredline/ffmpeg-static:7.1.1-base -t cliparr:latest .

# Build Cliparr NVIDIA image
echo "📦 Building Cliparr NVIDIA image..."
docker build -f Dockerfile.nvidia --build-arg FFMPEG_IMAGE=ghcr.io/redeyeredline/ffmpeg-static:7.1.1-nvidia -t cliparr:nvidia .

echo "✅ All images built successfully!"
echo ""
echo "📊 Image sizes:"
docker images cliparr --format "table {{.Tag}}\t{{.Size}}"
echo ""
echo "🚀 To run the base image: docker run -p 8484:8484 cliparr:latest"
echo "🚀 To run the NVIDIA image: docker run --gpus all -p 8484:8484 cliparr:nvidia" 