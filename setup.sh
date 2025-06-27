#!/bin/bash

# Cliprr Setup Script
# Installs system dependencies and sets up the development environment

set -e

echo "🚀 Setting up Cliprr development environment..."

# Check if running as root (needed for apt install)
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please don't run this script as root. Use sudo for specific commands."
    exit 1
fi

# Update package list
echo "📦 Updating package list..."
sudo apt update

# Install Redis
echo "🔴 Installing Redis..."
if ! command -v redis-server &> /dev/null; then
    sudo apt install -y redis-server
    echo "✅ Redis installed successfully"
else
    echo "✅ Redis already installed"
fi

# Start Redis service
echo "🔴 Starting Redis service..."
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test Redis connection
echo "🔴 Testing Redis connection..."
if redis-cli ping | grep -q "PONG"; then
    echo "✅ Redis is running and responding"
else
    echo "❌ Redis is not responding. Please check the service status."
    exit 1
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Create data directory if it doesn't exist
echo "📁 Setting up data directory..."
mkdir -p data

# Set proper permissions
echo "🔐 Setting up permissions..."
sudo chown -R $USER:$USER data/

echo "✅ Setup completed successfully!"
echo ""
echo "🎉 You can now run the development server with:"
echo "   npm run dev"
echo ""
echo "📋 The application will be available at:"
echo "   Frontend: http://localhost:8484"
echo "   Backend:  http://localhost:8485"
echo "   Redis:    localhost:6379" 