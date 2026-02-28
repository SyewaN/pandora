#!/usr/bin/env bash
set -euo pipefail

# Initial provisioning for backend and AI services.
# - installs Node dependencies
# - creates Python virtualenv
# - installs AI requirements
# - prepares runtime directories/files

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[setup] Starting project setup in $ROOT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "[setup] npm not found. Please install Node.js 18+ first."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "[setup] python3 not found. Please install Python 3.9+ first."
  exit 1
fi

mkdir -p data logs ai/model

if [[ ! -f data/measurements.json ]]; then
  echo "[]" > data/measurements.json
fi

npm install

python3 -m venv ai/.venv
# shellcheck disable=SC1091
source ai/.venv/bin/activate
pip install --upgrade pip
pip install -r ai/requirements.txt

if command -v pm2 >/dev/null 2>&1; then
  pm2 install pm2-logrotate || true
  pm2 set pm2-logrotate:max_size 10M || true
  pm2 set pm2-logrotate:retain 14 || true
  pm2 set pm2-logrotate:compress true || true
fi

echo "[setup] Setup completed successfully."
