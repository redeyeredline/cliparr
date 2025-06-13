# Build stage for frontend
FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Main stage
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY backend/ ./

# Build TypeScript
RUN npm run build

# Create necessary directories
RUN mkdir -p /data/static /data/logs /data/config /data/db

# Copy built frontend files from builder stage
COPY --from=frontend-builder /frontend/dist/* /data/static/
COPY --from=frontend-builder /frontend/dist/assets /data/static/assets

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"] 