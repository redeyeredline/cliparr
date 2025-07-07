FROM lsiobase/ubuntu:jammy

# Set environment variables
ENV \
    LIBVA_DRIVERS_PATH="/usr/lib/x86_64-linux-gnu/dri" \
    LD_LIBRARY_PATH="/usr/lib/x86_64-linux-gnu" \
    NVIDIA_DRIVER_CAPABILITIES="compute,video,utility" \
    NVIDIA_VISIBLE_DEVICES="all" \
    NODE_ENV="production" \
    PORT="8484"

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # Build tools
    autoconf \
    automake \
    build-essential \
    cmake \
    git \
    libtool \
    make \
    nasm \
    pkg-config \
    wget \
    curl \
    yasm \
    patch \
    tar \
    zlib1g-dev \
    m4 \
    libssl-dev \
    # FFmpeg minimal dependencies
    libbz2-dev \
    liblzma-dev \
    libmp3lame-dev \
    libnuma-dev \
    libogg-dev \
    libopus-dev \
    libvorbis-dev \
    libx264-dev \
    libx265-dev \
    libvpx-dev \
    libxml2-dev \
    # NVIDIA CUDA toolkit and codec headers
    nvidia-cuda-toolkit \
    nvidia-cuda-dev \
    # FFmpeg will fetch ffnvcodec headers automatically
    # Redis
    redis-server \
    # Node.js
    curl \
    ca-certificates \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    # Install specific npm version (lockfileVersion 3 indicates npm 7+)
    && npm install -g npm@11.4.2 \
    # Clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Build FFmpeg from source with NVENC support (minimal codecs)
RUN cd /tmp && \
    wget https://ffmpeg.org/releases/ffmpeg-7.1.1.tar.bz2 && \
    tar -xf ffmpeg-7.1.1.tar.bz2 && \
    cd ffmpeg-7.1.1 && \
    # Fetch ffnvcodec headers (NVIDIA codec headers)
    git clone https://git.videolan.org/git/ffmpeg/nv-codec-headers.git && \
    cd nv-codec-headers && \
    make install && \
    cd .. && \
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
        --enable-libvpx \
        --enable-shared \
        --enable-pthreads \
        --enable-version3 \
        --enable-openssl \
        --enable-vaapi \
        --extra-cflags="-I/usr/local/cuda/include" \
        --extra-ldflags="-L/usr/local/cuda/lib64" && \
    make -j$(nproc) && \
    make install && \
    ldconfig && \
    cd / && \
    rm -rf /tmp/ffmpeg-7.1.1* /tmp/nv-codec-headers

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Make startup script executable
RUN chmod +x docker-start.sh

# Build the frontend
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Create necessary directories
RUN mkdir -p /app/data /app/logs /app/temp /app/src/database/data

# Expose port
EXPOSE 8484

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8484/health/status || exit 1

# Start the application
CMD ["./docker-start.sh"] 