#!/bin/bash

# Source and destination directories
DATA_DIR="/data"
DB_DIR="$DATA_DIR/db"

# Ensure DB directory exists
mkdir -p "$DB_DIR"

# Function to safely move a database file
move_db() {
    local src="$1"
    local dst="$2"
    if [ -f "$src" ] && [ "$src" != "$dst" ]; then
        if [ -f "$dst" ]; then
            # If both source and destination exist, keep the newer one
            src_time=$(stat -c %Y "$src")
            dst_time=$(stat -c %Y "$dst")
            if [ "$src_time" -gt "$dst_time" ]; then
                echo "Moving newer database from $src to $dst"
                mv "$src" "$dst"
            else
                echo "Removing older database at $src"
                rm "$src"
            fi
        else
            echo "Moving $src to $dst"
            mv "$src" "$dst"
        fi
    fi
}

# Move databases to correct location if they exist in root
move_db "$DATA_DIR/cliparr.db" "$DB_DIR/cliparr.db"
move_db "$DATA_DIR/audio_fingerprints.db" "$DB_DIR/audio_fingerprints.db"
move_db "$DATA_DIR/audio_analysis_jobs.db" "$DB_DIR/audio_analysis_jobs.db"

# Set correct permissions
chown -R 911:911 "$DB_DIR"
chmod -R 755 "$DB_DIR"

echo "Database cleanup complete" 