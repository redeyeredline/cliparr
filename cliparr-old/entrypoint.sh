#!/bin/bash
set -e

# 1. Initialize Postgres data directory if needed
if [ ! -s /data/pgdata/PG_VERSION ]; then
  echo "Initializing Postgres data directory..."
  initdb -D /data/pgdata
fi

# 2. Start Postgres in the background
pg_ctl -D /data/pgdata -l /data/pg.log start

# 3. Wait for Postgres to be ready
until pg_isready -h /var/run/postgresql -d postgres; do
  echo "Waiting for Postgres..."
  sleep 1
done

# 4. Run the Node app (it will connect via socket)
exec node dist/backend/server.js 