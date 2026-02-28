#!/usr/bin/env bash
set -euo pipefail

# Creates timestamped backups of measurement data.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SOURCE_FILE="data/measurements.json"
BACKUP_DIR="data/backups"
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
TARGET_FILE="$BACKUP_DIR/measurements-$TIMESTAMP.json"

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "[backup] Source file not found: $SOURCE_FILE"
  exit 1
fi

cp "$SOURCE_FILE" "$TARGET_FILE"
echo "[backup] Backup created: $TARGET_FILE"
