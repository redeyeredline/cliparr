#!/usr/bin/env bash
# Helper to commit all current changes and push to origin main
# Usage: ./scripts/git_push.sh "Commit message"
set -euo pipefail

MSG=${1:-"sync changes"}
BRANCH=$(git symbolic-ref --short -q HEAD)

git add -A
if git diff --cached --quiet; then
  echo "Nothing to commit"
  exit 0
fi

git commit -m "$MSG"
git push origin "$BRANCH"
