# Build stage for frontend
FROM node:18-slim as frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Main stage
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create abc user and group
RUN groupadd -g 911 abc && \
    useradd -u 911 -g abc -s /bin/bash -m abc

# Create necessary directories with correct permissions
RUN mkdir -p /data/{app,logs,config,db,static} && \
    chown -R abc:abc /data && \
    chmod -R 755 /data

# Set workdir to data/app
WORKDIR /data/app

# Copy requirements first for better caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY --chown=abc:abc backend/app ./app

# Copy built frontend files from builder stage
COPY --from=frontend-builder --chown=abc:abc /frontend/dist/* /data/static/
COPY --from=frontend-builder --chown=abc:abc /frontend/dist/assets /data/static/assets

# Switch to abc user
USER abc

# Set environment variables
ENV PYTHONPATH=/data/app
ENV CLIPARR_DATA_DIR=/data
ENV ENV=production
ENV DEBUG=false
ENV HOST=0.0.0.0
ENV PORT=5000
ENV CLIPARR_IMPORT_MODE=none

# Expose port
EXPOSE 5000

# Run the application
CMD ["python", "-m", "app.main"] 