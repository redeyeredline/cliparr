# Stage 1: Build FFmpeg
FROM lsiobase/ubuntu:jammy AS ffmpeg-build

RUN apt-get update && apt-get install -y \
    autoconf automake build-essential cmake git libtool make nasm pkg-config wget curl \
    yasm tar zlib1g-dev libssl-dev libbz2-dev liblzma-dev m4 \
    libmp3lame-dev libnuma-dev libogg-dev libopus-dev libvorbis-dev \
    libx264-dev libx265-dev libvpx-dev libxml2-dev libva-dev \
    libva-drm2 libva-glx2 libva-x11-2 vainfo \
    nvidia-cuda-toolkit nvidia-cuda-dev libfdk-aac-dev libflac-dev \
    libwavpack-dev intel-media-va-driver-non-free && \
    cd /tmp && \
    wget https://ffmpeg.org/releases/ffmpeg-7.1.1.tar.bz2 && \
    tar -xf ffmpeg-7.1.1.tar.bz2 && \
    cd ffmpeg-7.1.1 && \
    git clone https://git.videolan.org/git/ffmpeg/nv-codec-headers.git && \
    cd nv-codec-headers && make install && cd .. && \
    ./configure \
        --prefix=/ffmpeg-static \
        --enable-gpl --enable-nonfree --enable-version3 --enable-shared \
        --enable-pthreads \
        --enable-libx264 --enable-libx265 --enable-libvpx \
        --enable-libopus --enable-libvorbis --enable-libmp3lame \
        --enable-libfdk-aac \
        --enable-vaapi --enable-nvenc --enable-cuda-nvcc \
        --extra-cflags="-I/usr/local/cuda/include" \
        --extra-ldflags="-L/usr/local/cuda/lib64" && \
    make -j$(nproc) && make install && \
    cd / && rm -rf /tmp/ffmpeg-7.1.1* /tmp/nv-codec-headers

# Stage 2: Build Node.js app + Vite frontend
FROM lsiobase/ubuntu:jammy AS app-build

RUN apt-get update && apt-get install -y curl ca-certificates gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && npm install -g npm@11.4.2

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN chmod +x docker-start.sh && \
    npm run build && \
    npm prune --omit=dev

# Stage 3: Final minimal image
FROM lsiobase/ubuntu:jammy

RUN apt-get update && apt-get install -y \
    curl ca-certificates gnupg build-essential \
    libva-drm2 libva-x11-2 \
    libva-glx2 libnuma1 libx264-163 libx265-199 libvpx7 \
    libopus0 libvorbis0a libmp3lame0 libfdk-aac2 libflac8 && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && npm install -g npm@11.4.2 && \
    # Install Redis 6.2+ from Redis repository
    curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb jammy main" | tee /etc/apt/sources.list.d/redis.list && \
    apt-get update && \
    apt-get install -y redis-server && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy ffmpeg binaries
COPY --from=ffmpeg-build /ffmpeg-static /usr/local

# Copy app and start script
COPY --from=app-build /app /app
WORKDIR /app
RUN chmod +x docker-start.sh && \
    mkdir -p data logs temp src/database/data && \
    npm rebuild better-sqlite3

# Ensure dist directory is present (from frontend build)
RUN if [ ! -d /app/dist ]; then echo 'ERROR: /app/dist missing. Frontend build failed.'; exit 1; fi

EXPOSE 8484

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8484/health/status || exit 1

# Start Redis & Node app
CMD ["./docker-start.sh"]