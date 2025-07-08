# Stage 1: Build FFmpeg
FROM lsiobase/ubuntu:jammy as ffmpeg-build
RUN apt-get update && apt-get install -y \
    autoconf automake build-essential cmake git libtool make nasm pkg-config wget curl yasm patch tar zlib1g-dev m4 libssl-dev \
    libbz2-dev liblzma-dev libmp3lame-dev libnuma-dev libogg-dev libopus-dev libvorbis-dev libx264-dev libx265-dev libvpx-dev libxml2-dev \
    libva-dev libva-drm2 libva-glx2 libva-x11-2 vainfo \
    nvidia-cuda-toolkit nvidia-cuda-dev \
    libfdk-aac-dev libmp3lame-dev libflac-dev libwavpack-dev && \
    cd /tmp && \
    wget https://ffmpeg.org/releases/ffmpeg-7.1.1.tar.bz2 && \
    tar -xf ffmpeg-7.1.1.tar.bz2 && \
    cd ffmpeg-7.1.1 && \
    git clone https://git.videolan.org/git/ffmpeg/nv-codec-headers.git && \
    cd nv-codec-headers && make install && cd .. && \
    ./configure \
        --prefix=/ffmpeg-static \
        --enable-gpl \
        --enable-nonfree \
        --enable-version3 \
        --enable-shared \
        --enable-pthreads \
        --enable-libx264 \
        --enable-libx265 \
        --enable-libopus \
        --enable-libvorbis \
        --enable-libmp3lame \
        --enable-libfdk-aac \
        --enable-libflac \
        --enable-libvpx \
        --enable-vaapi \
        --enable-nvenc \
        --enable-cuda-nvcc \
        --enable-qsv \
        --extra-cflags="-I/usr/local/cuda/include" \
        --extra-ldflags="-L/usr/local/cuda/lib64" && \
    make -j$(nproc) && make install && cd / && rm -rf /tmp/ffmpeg-7.1.1* /tmp/nv-codec-headers

# Stage 2: Build Node.js app and frontend
FROM lsiobase/ubuntu:jammy as app-build
RUN apt-get update && apt-get install -y curl ca-certificates gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && npm install -g npm@11.4.2
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN chmod +x docker-start.sh
RUN npm run build
RUN npm prune --production

# Stage 3: Final minimal image
FROM lsiobase/ubuntu:jammy
RUN apt-get update && apt-get install -y redis-server curl ca-certificates libva-drm2 libva-x11-2 libva-glx2 libnuma1 libx264-163 libx265-199 libvpx7 libopus0 libvorbis0a libmp3lame0 libfdk-aac2 libflac8 && apt-get clean && rm -rf /var/lib/apt/lists/*
COPY --from=ffmpeg-build /ffmpeg-static /usr/local
COPY --from=app-build /app /app
WORKDIR /app
RUN chmod +x docker-start.sh
RUN mkdir -p /app/data /app/logs /app/temp /app/src/database/data
EXPOSE 8484
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8484/health/status || exit 1
CMD ["./docker-start.sh"] 