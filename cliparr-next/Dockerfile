FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    PYTHONPATH=/app/backend:/app/backend/app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    python3-pip \
    python3-dev \
    curl \
    gnupg \
    ca-certificates \
    apt-transport-https && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set up application directories
WORKDIR /app

# Create necessary directories with proper permissions
RUN mkdir -p /app/backend/app/data /app/backend/app/log /app/backend/app/config /config/log /data && \
    chown -R 1000:1000 /app/backend/app/data /app/backend/app/log /app/backend/app/config /config /data && \
    chmod -R 755 /app/backend/app/data /app/backend/app/log /app/backend/app/config /config /data

# Install Python dependencies
COPY backend/requirements.txt /app/backend/
RUN pip3 install --no-cache-dir -r /app/backend/requirements.txt

# Copy backend files
COPY backend/app /app/backend/app/
COPY backend/static /app/backend/static/

# Ensure proper permissions after copying files
RUN chown -R 1000:1000 /app/backend/app /app/backend/static && \
    chmod -R 755 /app/backend/app /app/backend/static

# Set up frontend
WORKDIR /app/frontend
COPY frontend/package*.json /app/frontend/
RUN npm install
COPY frontend/ /app/frontend/

# Create backend/static directory for Vite build
RUN mkdir -p /app/backend/static

# Build frontend
RUN npm run build

# Verify frontend build
RUN echo "Backend static directory contents:" && \
    ls -la /app/backend/static

# Expose port
EXPOSE 5000

# Define volumes
VOLUME /config
VOLUME /data

# Show final directory structure
RUN echo "Final directory structure:" && \
    echo "Backend directory:" && \
    ls -la /app/backend && \
    echo "App directory:" && \
    ls -la /app/backend/app && \
    echo "Static directory:" && \
    ls -la /app/backend/static

# Set the working directory and user
WORKDIR /app/backend
USER 1000:1000

# Start the application
CMD ["python3", "-m", "app.main"] 