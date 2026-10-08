#!/usr/bin/env bash
# Actualiza el servidor a la última versión de main y reconstruye lo que cambió.
# Lo corre el deploy automático (.github/workflows/deploy.yml) por SSH, y también sirve a mano:
#   ~/formsis-v2/deploy/actualizar.sh
set -euo pipefail
cd "$(dirname "$0")/.."

caddyfile_antes=$(sha256sum deploy/Caddyfile)
git fetch --quiet origin main
git merge --ff-only origin/main
git submodule update --init --recursive
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
# Caddy lee el Caddyfile solo al arrancar, y git reemplaza el archivo en vez de editarlo,
# así que el contenedor seguiría viendo el viejo: si cambió, se reinicia (un par de segundos).
if [ "$(sha256sum deploy/Caddyfile)" != "$caddyfile_antes" ]; then
  docker compose -f docker-compose.prod.yml restart caddy
fi
# Borra las imágenes viejas que dejó la reconstrucción para no llenar el disco.
docker image prune -f >/dev/null
docker compose -f docker-compose.prod.yml ps
