#!/bin/bash
set -e

# Ensure data directory exists
mkdir -p /app/data

# Run database migrations
alembic upgrade head

# Start the application
exec uvicorn backend.main:app --host 0.0.0.0 --port 5000 