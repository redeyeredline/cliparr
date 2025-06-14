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
# Verify npm version\n\
echo "Using npm version: $(npm --version)"\n\
\n\
# Start PostgreSQL service\n\
service postgresql start\n\
\n\
# Initialize PostgreSQL if not already initialized\n\
if [ ! -f /opt/dockerdata/cliparr/postgres/PG_VERSION ]; then\n\
  echo "Initializing PostgreSQL database..."\n\
  su - postgres -c "/usr/lib/postgresql/15/bin/initdb -D /opt/dockerdata/cliparr/postgres"\n\
  \n\
  # Configure PostgreSQL\n\
  echo "listen_addresses = '\''localhost'\''" >> /opt/dockerdata/cliparr/postgres/postgresql.conf\n\
  echo "port = 5432" >> /opt/dockerdata/cliparr/postgres/postgresql.conf\n\
  \n\
  # Restart PostgreSQL to apply new configuration\n\
  service postgresql restart\n\
  \n\
  # Create database and set password\n\
  su - postgres -c "createdb cliparr"\n\
  su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD '\''postgres'\'';\""\n\
fi\n\
\n\
# Start the application\n\
npm start\n\
' > /app/start.sh && chmod +x /app/start.sh

# Expose the port the app runs on
EXPOSE 8484

# Start the application
ENV NODE_ENV=production
CMD ["/app/start.sh"] 