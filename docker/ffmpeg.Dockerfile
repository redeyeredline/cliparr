# syntax=docker/dockerfile:1
# -----------------------------------------------------------------------------
#  Build script for a STATIC FFmpeg 7.1.1 image with NVIDIA & VA-API support.
#  Run once, push to ghcr.io/your-org/ffmpeg-static:7.1.1, then reference it
#  from the main Dockerfile so regular Cliparr builds are fast.
# -----------------------------------------------------------------------------

FROM lsiobase/ubuntu:jammy AS builder

ARG FFMPEG_VERSION=7.1.1

RUN apt-get update && apt-get install -y \
    autoconf automake build-essential cmake git libtool make nasm pkg-config wget curl \
    yasm tar zlib1g-dev libssl-dev libbz2-dev liblzma-dev m4 \
    libmp3lame-dev libnuma-dev libogg-dev libopus-dev libvorbis-dev \
    libx264-dev libx265-dev libvpx-dev libxml2-dev libva-dev \
    libva-drm2 libva-glx2 libva-x11-2 vainfo \
    nvidia-cuda-toolkit nvidia-cuda-dev libfdk-aac-dev libflac-dev \
    libwavpack-dev intel-media-va-driver-non-free && \
    cd /tmp && \
    wget https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.bz2 && \
    tar -xf ffmpeg-${FFMPEG_VERSION}.tar.bz2 && \
    cd ffmpeg-${FFMPEG_VERSION} && \
    git clone https://git.videolan.org/git/ffmpeg/nv-codec-headers.git && \
    cd nv-codec-headers && make install && cd .. && \
    ./configure \
        --prefix=/usr/local \
        --enable-gpl --enable-nonfree --enable-version3 --enable-shared \
        --enable-pthreads \
        --enable-libx264 --enable-libx265 --enable-libvpx \
        --enable-libopus --enable-libvorbis --enable-libmp3lame \
        --enable-libfdk-aac \
        --enable-vaapi --enable-nvenc --enable-cuda-nvcc \
        --extra-cflags="-I/usr/local/cuda/include" \
        --extra-ldflags="-L/usr/local/cuda/lib64" && \
    make -j$(nproc) && make install && \
    cd / && rm -rf /tmp/ffmpeg-${FFMPEG_VERSION}* /tmp/nv-codec-headers

# ---------- Final minimal image containing only the binaries ----------
FROM lsiobase/ubuntu:jammy AS ffmpeg-static

RUN apt-get update && apt-get install -y \
    libxcb1 \
    libva2 libva-drm2 libva-x11-2 libva-glx2 \
    libvpx7 libx264-163 libx265-199 libopus0 libvorbis0a libvorbisenc2 libmp3lame0 libfdk-aac2 libflac8 libnuma1 libvdpau1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local /usr/local
ENV PATH="/usr/local/bin:${PATH}"
ENV LD_LIBRARY_PATH=/usr/local/lib
RUN ldconfig

# Display ffmpeg version for validation
RUN ffmpeg -version

LABEL org.opencontainers.image.title="FFmpeg ${FFMPEG_VERSION} static build" \
      org.opencontainers.image.description="Prebuilt FFmpeg binaries for use in Cliparr multi-stage builds" \
      org.opencontainers.image.version="${FFMPEG_VERSION}"

# No CMD – this image is meant to be copied-from