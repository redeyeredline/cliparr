#!/bin/bash

# Script to fix music directory permissions
# Run this script to fix permissions on the music directory

MUSIC_DIR="/opt/slowerdrive/media/Music"

echo "Fixing permissions for $MUSIC_DIR..."

# Fix ownership for any files/directories not owned by user 1000
sudo find "$MUSIC_DIR" -not -user 1000 -exec chown 1000:1000 {} \;

# Fix group ownership for any files/directories not owned by group 1000
sudo find "$MUSIC_DIR" -not -group 1000 -exec chown 1000:1000 {} \;

# Set proper permissions (775 for directories, 664 for files)
sudo find "$MUSIC_DIR" -type d -exec chmod 775 {} \;
sudo find "$MUSIC_DIR" -type f -exec chmod 664 {} \;

echo "Permissions fixed!" 