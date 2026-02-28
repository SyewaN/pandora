#!/usr/bin/env bash
set -euo pipefail

# Deployment helper for VM instances.
# Pulls latest changes, installs dependencies, and restarts PM2 processes.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[deploy] Deploy started at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

git fetch --all --prune
git pull --rebase

npm install

if [[ -d "ai/.venv" ]]; then
  # shellcheck disable=SC1091
  source ai/.venv/bin/activate
  pip install -r ai/requirements.txt
else
  echo "[deploy] Python venv missing, running setup script."
  ./scripts/setup.sh
fi

pm2 startOrReload ecosystem.config.js --env production
pm2 install pm2-logrotate || true
pm2 save

echo "[deploy] Deploy finished successfully."
