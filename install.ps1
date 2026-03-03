$ErrorActionPreference = "Stop"

# Clean, predictable install for Docker
# Run from repo root.

Write-Host "Stopping and removing containers/volumes..."
try { docker compose down -v --rmi local } catch { }
try { docker volume rm bchoperativo-db bchoperativo-uploads | Out-Null } catch { }

Write-Host "Starting services..."
docker compose up -d --build

Write-Host "Done. Use 'docker compose logs -f db' to wait for DB readiness."
