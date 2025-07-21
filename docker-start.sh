#!/bin/bash

# Symlink/copy NVIDIA libraries from host if present (mimic Plex behavior)
REQUIRED_LIBS=(libcuda.so.1 libnvidia-encode.so.1 libnvidia-ml.so.1)
HOST_LIB_DIRS=(
  /usr/lib/x86_64-linux-gnu
  /usr/local/cuda/lib64
  /lib/x86_64-linux-gnu
)

for LIB in "${REQUIRED_LIBS[@]}"; do
  for DIR in "${HOST_LIB_DIRS[@]}"; do
    if [ -e "$DIR/$LIB" ]; then
      if [ ! -e "/usr/lib/x86_64-linux-gnu/$LIB" ]; then
        echo "Symlinking $DIR/$LIB to /usr/lib/x86_64-linux-gnu/$LIB"
        ln -sf "$DIR/$LIB" "/usr/lib/x86_64-linux-gnu/$LIB"
      fi
    fi
  done
done

# --- YOUR ORIGINAL STARTUP LOGIC BELOW ---

# Start Redis in the background with container-friendly config
echo "Starting Redis..."
redis-server --daemonize yes --bind 127.0.0.1 --port 6379

# Wait a moment for Redis to start
sleep 2

# Verify Redis is running
if ! redis-cli ping | grep -q "PONG"; then
    echo "❌ Redis failed to start"
    exit 1
fi
echo "✅ Redis is running"

# Start the Node.js application
echo "Starting Cliprr application..."
exec node src/integration/index.js 