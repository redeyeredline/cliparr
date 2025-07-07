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
    meson \
    ninja-build \
    patch \
    tar \
    zlib1g-dev \
    m4 \
    # FFmpeg dependencies
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
    libtool-bin \
    libturbojpeg0-dev \
    libvorbis-dev \
    libx264-dev \
    libxml2-dev \
    libvpx-dev \
    # NVIDIA CUDA toolkit
    nvidia-cuda-toolkit \
    nvidia-cuda-dev \
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

# Build FFmpeg from source with NVENC support
RUN cd /tmp && \
    wget https://ffmpeg.org/releases/ffmpeg-7.1.1.tar.bz2 && \
    tar -xf ffmpeg-7.1.1.tar.bz2 && \
    cd ffmpeg-7.1.1 && \
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
        --extra-ldflags="-L/usr/local/cuda/lib64" && \
    make -j$(nproc) && \
    make install && \
    ldconfig && \
    cd / && \
    rm -rf /tmp/ffmpeg-7.1.1*

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