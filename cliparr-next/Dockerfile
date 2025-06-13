# syntax=docker/dockerfile:1.4
FROM python:3.10-slim

# Suppress debconf/apt-utils warnings
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies and latest npm as root
RUN apt-get update && apt-get install -y \
    apt-utils \
    curl \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m cliparr

# Set working directory
WORKDIR /app

# Copy backend source
COPY backend/ ./backend/

# Create and activate virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip and install wheel
RUN pip install --upgrade pip && pip install wheel

# Copy and install Python requirements with BuildKit cache
COPY backend/requirements.txt ./backend/
RUN --mount=type=cache,target=/root/.cache/pip pip install -r backend/requirements.txt

# Copy only package.json and lock for npm cache
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN --mount=type=cache,target=/root/.npm npm install

# Copy the rest of the frontend and build
COPY --chown=cliparr:cliparr frontend/ .
RUN npm run build



# Create static directory with correct permissions (for Vite build output)
RUN mkdir -p /app/backend/static && chown -R cliparr:cliparr /app

# Switch to non-root user
USER cliparr

# Set working directory to backend
WORKDIR /app/backend

# Expose the port the app runs on
EXPOSE 5000

# Run the application
CMD ["python", "main.py"] 