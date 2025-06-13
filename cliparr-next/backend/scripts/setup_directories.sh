#!/bin/bash

# Create necessary directories
mkdir -p /data/static/assets
mkdir -p /data/config
mkdir -p /data/logs

# Set permissions (assuming the container runs as user 911:911)
chown -R 911:911 /data
chmod -R 755 /data 