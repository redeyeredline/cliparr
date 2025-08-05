#!/usr/bin/env bash
# Query Cliparr processing status from the running Docker container
# Usage: ./scripts/jobs_status.sh
set -euo pipefail

if ! command -v docker-compose &> /dev/null; then
  echo "docker-compose is required but not found in PATH" >&2
  exit 1
fi

STATUS_JSON=$(docker-compose exec -T cliparr curl -s http://localhost:8484/processing/status)

if command -v jq &> /dev/null; then
  echo "$STATUS_JSON" | jq .
else
  echo "$STATUS_JSON"
fi
