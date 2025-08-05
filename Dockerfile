# syntax=docker/dockerfile:1

# --------  FFmpeg binary layer (prebuilt) --------
# Provide an FFmpeg image once (built separately with docker/ffmpeg.Dockerfile),
# push it to your registry, and reference it here so we skip the long compile.
# Update the tag when you rebuild FFmpeg.
ARG FFMPEG_IMAGE=ghcr.io/redeyeredline/ffmpeg-static:7.1.1
FROM ${FFMPEG_IMAGE} AS ffmpeg

# --------  Application build layer --------
FROM lsiobase/ubuntu:jammy AS app-build

RUN apt-get update && apt-get install -y \
    curl ca-certificates gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && npm install -g npm@11.4.2

WORKDIR /app
COPY . .
RUN npm install && \
    chmod +x docker-start.sh && \
    npm run build && \
    npm prune --omit=dev

# --------  Runtime layer --------
FROM lsiobase/ubuntu:jammy

# Install minimal dependencies & Node
RUN apt-get update && apt-get install -y \
    curl ca-certificates gnupg build-essential \
    libva-drm2 libva-x11-2 \
    libva-glx2 libnuma1 libx264-163 libx265-199 libvpx7 \
    libopus0 libvorbis0a libmp3lame0 libfdk-aac2 libflac8 \
    libvorbisenc2 libvdpau1 && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && npm install -g npm@11.4.2 && \
    # Install Redis 6.2+ from Redis repository
    curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb jammy main" | tee /etc/apt/sources.list.d/redis.list && \
    apt-get update && \
    apt-get install -y redis-server && \
    apt-get clean && rm -rf /var/lib/apt/lists/* 

# --- Bring in prebuilt FFmpeg ---
COPY --from=ffmpeg /usr/local /usr/local

# Ensure ffmpeg binary is in PATH and libs are found
ENV PATH="/usr/local/bin:${PATH}"
ENV LD_LIBRARY_PATH=/usr/local/lib
RUN ldconfig

# --- Copy application ---
COPY --from=app-build /app /app
WORKDIR /app
RUN chmod +x docker-start.sh && \
    mkdir -p data logs temp src/database/data && \
    npm rebuild better-sqlite3

# Validate front-end build exists
RUN if [ ! -d /app/dist ]; then echo 'ERROR: /app/dist missing. Frontend build failed.'; exit 1; fi

EXPOSE 8484

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 CMD curl -f http://localhost:8484/health/status || exit 1

CMD ["./docker-start.sh"]