#!/bin/bash

# Install Jellyfin FFmpeg with NVENC support for Cliprr
# Dynamically determines the correct package name based on FFmpeg version

set -e

echo "🚀 Installing Jellyfin FFmpeg with NVENC support for Cliprr..."

# Check if we're on x86_64
if ! uname -m | grep -q x86_64; then
    echo "❌ This script is designed for x86_64 architecture"
    exit 1
fi

# Check if NVIDIA GPU is available
if ! command -v nvidia-smi &> /dev/null; then
    echo "⚠️  NVIDIA GPU not detected, but continuing with installation..."
fi

# Set up environment variables
export NVIDIA_DRIVER_CAPABILITIES="compute,video,utility"
export NVIDIA_VISIBLE_DEVICES="all"

# Get latest Jellyfin FFmpeg version
echo "📥 Getting latest Jellyfin FFmpeg version..."
FFMPEG_VERSION=$(curl --silent https://api.github.com/repos/jellyfin/jellyfin-ffmpeg/releases/latest | grep -oP '"tag_name":\s*"v\K[^"]+')

if [ -z "$FFMPEG_VERSION" ]; then
    echo "❌ Failed to get FFmpeg version, using fallback..."
    FFMPEG_VERSION="7.1.1-7"
fi

# Extract major version for package name
echo "🔎 Determining package name..."
MAJOR_VERSION=$(echo "$FFMPEG_VERSION" | cut -d. -f1)
PACKAGE_NAME="jellyfin-ffmpeg${MAJOR_VERSION}"
echo "Using package: $PACKAGE_NAME"

# Download and install Jellyfin FFmpeg
wget "https://github.com/jellyfin/jellyfin-ffmpeg/releases/download/v${FFMPEG_VERSION}/${PACKAGE_NAME}_${FFMPEG_VERSION}-jammy_amd64.deb"

# Install the package
sudo apt-get update
sudo apt install -y ./${PACKAGE_NAME}_${FFMPEG_VERSION}-jammy_amd64.deb

# Clean up downloaded file
rm -f ${PACKAGE_NAME}_${FFMPEG_VERSION}-jammy_amd64.deb

# Create backup of system FFmpeg
echo "💾 Backing up system FFmpeg..."
if [ -f /usr/bin/ffmpeg ]; then
    sudo mv /usr/bin/ffmpeg /usr/bin/ffmpeg-system
fi

# Create symlink to Jellyfin FFmpeg
echo "🔗 Creating symlink to Jellyfin FFmpeg..."
sudo ln -sf /usr/lib/${PACKAGE_NAME}/ffmpeg /usr/bin/ffmpeg

# Update library cache
echo "🔄 Updating library cache..."
sudo ldconfig

# Test the installation
echo "🧪 Testing FFmpeg installation..."
ffmpeg -version | head -1

# Test NVENC support
echo "🧪 Testing NVENC support..."
if ffmpeg -hide_banner -encoders | grep -q nvenc; then
    echo "✅ NVENC support is available!"
    ffmpeg -hide_banner -encoders | grep nvenc
else
    echo "❌ NVENC support not found"
fi

# Test QSV support
echo "🧪 Testing QSV support..."
if ffmpeg -hide_banner -encoders | grep -q qsv; then
    echo "✅ QSV support is available!"
    ffmpeg -hide_banner -encoders | grep qsv
else
    echo "❌ QSV support not found"
fi

echo "🎉 Jellyfin FFmpeg with NVENC support has been installed!"
echo "📝 You can now run the hardware benchmark to test GPU encoding."
echo "💡 To restore the original FFmpeg, run: sudo ln -sf /usr/bin/ffmpeg-system /usr/bin/ffmpeg" 