#!/bin/bash

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