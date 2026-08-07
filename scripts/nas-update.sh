#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"

echo "[Folio] Updating deployment files from main..."
git pull --ff-only origin main

echo "[Folio] Pulling the latest container image..."
docker compose -f compose.nas.yaml pull

echo "[Folio] Applying the deployment..."
docker compose -f compose.nas.yaml up -d --remove-orphans

attempt=1
while [ "$attempt" -le 12 ]; do
  if docker compose -f compose.nas.yaml exec -T folio node -e "fetch('http://127.0.0.1:4173/api/v1/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"; then
    echo "[Folio] Deployment is healthy."
    exit 0
  fi

  echo "[Folio] Waiting for health check ($attempt/12)..."
  sleep 5
  attempt=$((attempt + 1))
done

echo "[Folio] Deployment did not become healthy. Check: docker compose -f compose.nas.yaml logs folio" >&2
exit 1
