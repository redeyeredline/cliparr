FROM node:20-slim

WORKDIR /app

# Install PostgreSQL server and client
RUN apt-get update && apt-get install -y \
    postgresql \
    postgresql-contrib \
    && rm -rf /var/lib/apt/lists/*

# Create PostgreSQL data directory
RUN mkdir -p /var/lib/postgresql/data && \
    chown -R postgres:postgres /var/lib/postgresql/data && \
    chmod 700 /var/lib/postgresql/data

# Initialize PostgreSQL database
RUN service postgresql start && \
    su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD 'postgres';\"" && \
    su - postgres -c "createdb cliparr" && \
    service postgresql stop

# Install dependencies for both frontend and backend
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build the frontend
RUN npm run build

# Create startup script
RUN echo '#!/bin/bash\n\
service postgresql start\n\
npm start\n\
' > /app/start.sh && chmod +x /app/start.sh

# Expose the port the app runs on
EXPOSE 8484

# Start the application
CMD ["/app/start.sh"] 