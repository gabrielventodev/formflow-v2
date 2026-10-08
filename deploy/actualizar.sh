#!/usr/bin/env bash
# Actualiza el servidor a la última versión de main y reconstruye lo que cambió.
# Lo corre el deploy automático (.github/workflows/deploy.yml) por SSH, y también sirve a mano:
#   ~/formsis-v2/deploy/actualizar.sh
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch --quiet origin main
git merge --ff-only origin/main
git submodule update --init --recursive
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
# Borra las imágenes viejas que dejó la reconstrucción para no llenar el disco.
docker image prune -f >/dev/null
docker compose -f docker-compose.prod.yml ps
