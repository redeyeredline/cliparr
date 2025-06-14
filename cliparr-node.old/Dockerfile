FROM node:20-alpine

# Install latest npm
RUN npm install -g npm@11.4.2

# Install PostgreSQL binaries
RUN apk add --no-cache postgresql postgresql-contrib

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and update package-lock.json if needed
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create data directory
RUN mkdir -p /app/data/postgres && \
    chown -R node:node /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Switch to non-root user
USER node

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"] 