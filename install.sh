#!/usr/bin/env bash
set -euo pipefail

# Clean, predictable install for Docker
# Run from repo root.

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but not found in PATH." >&2
  exit 1
fi

if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is required." >&2
  exit 1
fi

echo "Stopping and removing containers/volumes..."
docker compose down -v --rmi local || true

# Try to remove named volumes explicitly (ignore errors)
docker volume rm bchoperativo-db bchoperativo-uploads >/dev/null 2>&1 || true

echo "Starting services..."
docker compose up -d --build

echo "Done. Use 'docker compose logs -f db' to wait for DB readiness."
