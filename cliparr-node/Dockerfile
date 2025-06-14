FROM node:20-alpine

# Install latest npm
RUN npm install -g npm@11.4.2

# Install sqlite3 system dependency
RUN apk add --no-cache sqlite

# Create abc user and group
RUN addgroup -S abc && adduser -S abc -G abc

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and update package-lock.json if needed
RUN npm install

# Copy source code
COPY . .

# Build the application with debugging
RUN echo "Building application..." && \
    npm run build && \
    echo "Checking dist directory..." && \
    ls -la dist/ && \
    echo "Checking server dist directory..." && \
    ls -la dist/server/ && \
    # Ensure the dist directory exists and has correct permissions
    mkdir -p /app/dist/server && \
    chown -R abc:abc /app/dist && \
    # Verify the compiled files
    echo "Verifying compiled files..." && \
    find /app/dist -type f -name "*.js" -exec ls -la {} \; && \
    # Ensure all compiled files have correct permissions
    chmod -R 755 /app/dist

# Create data directory with correct permissions
RUN mkdir -p /app/data && \
    chown -R abc:abc /app/data && \
    chmod 777 /app/data && \
    # Verify permissions
    ls -la /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8484

# Switch to abc user
USER abc

# Expose port
EXPOSE 8484

# Start the application
CMD ["npm", "start"] 