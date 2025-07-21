#!/bin/bash

# Script to fix slskd download permissions
# Run this script to fix permissions on files downloaded via slskd

SLSKD_DIR="/opt/slowerdrive/soulseek"

echo "Fixing permissions for slskd downloads in $SLSKD_DIR..."

# Check if directory exists
if [ ! -d "$SLSKD_DIR" ]; then
    echo "Error: Directory $SLSKD_DIR does not exist!"
    exit 1
fi

# Get PUID and PGID from environment or use defaults
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Using PUID: $PUID, PGID: $PGID"

# Fix ownership for any files/directories not owned by the correct user
echo "Fixing ownership..."
sudo find "$SLSKD_DIR" -not -user $PUID -exec chown $PUID:$PGID {} \;

# Fix group ownership for any files/directories not owned by the correct group
echo "Fixing group ownership..."
sudo find "$SLSKD_DIR" -not -group $PGID -exec chown $PUID:$PGID {} \;

# Set proper permissions (775 for directories, 664 for files)
echo "Setting proper permissions..."
sudo find "$SLSKD_DIR" -type d -exec chmod 775 {} \;
sudo find "$SLSKD_DIR" -type f -exec chmod 664 {} \;

echo "Permissions fixed for slskd downloads!"
echo ""
echo "To prevent this issue in the future, restart the slskd container:"
echo "docker-compose restart slskd" 