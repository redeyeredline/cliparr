FROM node:20-slim

WORKDIR /app

# Update npm to latest version
RUN npm install -g npm@11.4.2

# Install PostgreSQL server and client
RUN apt-get update && apt-get install -y \
    postgresql \
    postgresql-contrib \
    && rm -rf /var/lib/apt/lists/*

# Create PostgreSQL data directory
RUN mkdir -p /opt/dockerdata/cliparr/postgres && \
    chown -R postgres:postgres /opt/dockerdata/cliparr/postgres && \
    chmod 700 /opt/dockerdata/cliparr/postgres

# Copy package files
COPY package*.json ./

# Install dependencies and generate package-lock.json
RUN npm install && \
    npm install --package-lock-only

# Copy all source code
COPY . .

# Build the frontend
RUN npm run build:frontend

# Build the backend
RUN npm run build:backend

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
# Start PostgreSQL in the background\n\
su - postgres -c "/usr/lib/postgresql/15/bin/pg_ctl -D /opt/dockerdata/cliparr/postgres -l /opt/dockerdata/cliparr/postgres/server.log start"\n\
# Wait for Postgres to be ready\n\
until su - postgres -c "/usr/lib/postgresql/15/bin/pg_isready -h /var/run/postgresql -d postgres"; do\n\
  echo "Waiting for Postgres..."\n\
  sleep 1\n\
done\n\
# Create database and user if not exist\n\
su - postgres -c "psql -c \"DO \\\\$\\\$ BEGIN IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cliparr') THEN CREATE DATABASE cliparr; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cliparr') THEN CREATE ROLE cliparr LOGIN; END IF; END \\\\$\\\$;\""\n\
# Start the application\n\
exec npm start\n' > /app/start.sh && chmod +x /app/start.sh

# Expose the port the app runs on
EXPOSE 8484

# Start the application as postgres user (UID 999)
USER 999:999
ENV NODE_ENV=production
CMD ["/app/start.sh"] 