#!/bin/bash

# Build FFmpeg with NVENC support for Cliprr
# Based on Tdarr's approach: https://github.com/HaveAGitGat/Tdarr/blob/master/docker/Dockerfile.base

set -e

echo "🚀 Building FFmpeg with NVENC support for Cliprr..."

# Check if we're on x86_64
if ! uname -m | grep -q x86_64; then
    echo "❌ This script is designed for x86_64 architecture"
    exit 1
fi

# Check if NVIDIA GPU is available
if ! command -v nvidia-smi &> /dev/null; then
    echo "⚠️  NVIDIA GPU not detected, but continuing with build..."
fi

# Install build dependencies
echo "📦 Installing build dependencies..."
sudo apt-get update
sudo apt-get install -y \
    autoconf \
    automake \
    build-essential \
    cmake \
    git \
    libass-dev \
    libbz2-dev \
    libfontconfig-dev \
    libfreetype-dev \
    libfribidi-dev \
    libharfbuzz-dev \
    libjansson-dev \
    liblzma-dev \
    libmp3lame-dev \
    libnuma-dev \
    libogg-dev \
    libopus-dev \
    libsamplerate0-dev \
    libspeex-dev \
    libtheora-dev \
    libtool \
    libtool-bin \
    libturbojpeg0-dev \
    libvorbis-dev \
    libx264-dev \
    libxml2-dev \
    libvpx-dev \
    m4 \
    make \
    meson \
    nasm \
    ninja-build \
    patch \
    pkg-config \
    tar \
    zlib1g-dev \
    yasm \
    wget \
    curl

# Install NVIDIA development libraries
echo "🔧 Installing NVIDIA development libraries..."
sudo apt-get install -y \
    nvidia-cuda-toolkit \
    nvidia-cuda-dev

# Set up environment variables
export NVIDIA_DRIVER_CAPABILITIES="compute,video,utility"
export NVIDIA_VISIBLE_DEVICES="all"

# Create build directory
BUILD_DIR="/tmp/ffmpeg-build"
mkdir -p $BUILD_DIR
cd $BUILD_DIR

# Download FFmpeg source
echo "📥 Downloading FFmpeg source..."
FFMPEG_VERSION="7.1.1"
wget https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.bz2
tar -xf ffmpeg-${FFMPEG_VERSION}.tar.bz2
cd ffmpeg-${FFMPEG_VERSION}

# Configure FFmpeg with NVENC support
echo "⚙️  Configuring FFmpeg with NVENC support..."
./configure \
    --prefix=/usr/local \
    --enable-gpl \
    --enable-nonfree \
    --enable-nvenc \
    --enable-cuda-nvcc \
    --enable-libx264 \
    --enable-libx265 \
    --enable-libmp3lame \
    --enable-libopus \
    --enable-libvorbis \
    --enable-libass \
    --enable-libfreetype \
    --enable-libfribidi \
    --enable-libtheora \
    --enable-libvpx \
    --enable-libspeex \
    --enable-libsamplerate \
    --enable-libjansson \
    --enable-libxml2 \
    --enable-libturbojpeg \
    --enable-libwebp \
    --enable-libopenh264 \
    --enable-libkvazaar \
    --enable-libfdk-aac \
    --enable-libbs2b \
    --enable-libcaca \
    --enable-libcdio \
    --enable-libcodec2 \
    --enable-libdav1d \
    --enable-libdc1394 \
    --enable-libdrm \
    --enable-libdvdnav \
    --enable-libdvdread \
    --enable-libflite \
    --enable-libfontconfig \
    --enable-libgme \
    --enable-libgsm \
    --enable-libharfbuzz \
    --enable-libiec61883 \
    --enable-libjack \
    --enable-libmysofa \
    --enable-libopencore-amrnb \
    --enable-libopencore-amrwb \
    --enable-libopenjpeg \
    --enable-libopenmpt \
    --enable-libplacebo \
    --enable-libpulse \
    --enable-librsvg \
    --enable-librubberband \
    --enable-libshine \
    --enable-libsmbclient \
    --enable-libsnappy \
    --enable-libsoxr \
    --enable-libsrt \
    --enable-libtesseract \
    --enable-libtwolame \
    --enable-libvidstab \
    --enable-libvo-amrwbenc \
    --enable-libzimg \
    --enable-libzmq \
    --enable-libzvbi \
    --enable-lv2 \
    --enable-openal \
    --enable-opencl \
    --enable-opengl \
    --enable-openssl \
    --enable-postproc \
    --enable-pthreads \
    --enable-shared \
    --enable-version3 \
    --enable-vaapi \
    --enable-libvpl \
    --enable-libxavs2 \
    --enable-libdavs2 \
    --enable-libvmaf \
    --enable-libvvenc \
    --enable-libilbc \
    --enable-libklvanc \
    --enable-omx \
    --enable-libsvtav1 \
    --enable-librist \
    --enable-libjxl \
    --enable-libopenh264 \
    --extra-cflags="-I/usr/local/cuda/include" \
    --extra-ldflags="-L/usr/local/cuda/lib64"

# Build FFmpeg
echo "🔨 Building FFmpeg (this may take a while)..."
make -j$(nproc)

# Install FFmpeg
echo "📦 Installing FFmpeg..."
sudo make install

# Update library cache
echo "🔄 Updating library cache..."
sudo ldconfig

# Create backup of system FFmpeg
echo "💾 Backing up system FFmpeg..."
if [ -f /usr/bin/ffmpeg ]; then
    sudo mv /usr/bin/ffmpeg /usr/bin/ffmpeg-system
fi

# Create symlink to our custom FFmpeg
echo "🔗 Creating symlink..."
sudo ln -sf /usr/local/bin/ffmpeg /usr/bin/ffmpeg

# Test the build
echo "🧪 Testing FFmpeg build..."
ffmpeg -version | head -1

# Test NVENC support
echo "🧪 Testing NVENC support..."
if ffmpeg -hide_banner -encoders | grep -q nvenc; then
    echo "✅ NVENC support is available!"
    ffmpeg -hide_banner -encoders | grep nvenc
else
    echo "❌ NVENC support not found"
fi

# Clean up
echo "🧹 Cleaning up build files..."
cd /
sudo rm -rf $BUILD_DIR

echo "🎉 FFmpeg with NVENC support has been built and installed!"
echo "📝 You can now run the hardware benchmark to test GPU encoding." 