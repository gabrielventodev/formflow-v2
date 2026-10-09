#!/usr/bin/env bash
# Actualiza un ambiente a la última versión de su rama y reconstruye lo que cambió.
#   producción: rama main, carpeta ~/formsis-v2
#   QA:         rama qa,   carpeta ~/formsis-v2-qa
# Cada carpeta sabe qué ambiente es por AMBIENTE en su .env (sin definir es producción).
#
# A mano:
#   ~/formsis-v2/deploy/actualizar.sh          # producción
#   ~/formsis-v2/deploy/actualizar.sh qa       # QA (corre el script de ~/formsis-v2-qa)
#   ~/formsis-v2-qa/deploy/actualizar.sh       # QA (sin argumento, el ambiente de su carpeta)
# El deploy automático (.github/workflows/deploy.yml) entra por SSH con una llave que solo puede
# correr este script en ~/formsis-v2, y manda el ambiente como comando (llega en SSH_ORIGINAL_COMMAND).
# Guía: docs/ambientes.md
set -euo pipefail

# Todo va dentro de una función para que bash lea el script entero antes de empezar:
# el "git merge" de abajo puede reemplazar este mismo archivo.
principal() {
  cd "$(dirname "$0")/.."

  local propio
  propio=$(sed -n 's/^AMBIENTE=//p' .env 2>/dev/null | tail -n 1 | tr -d "\"' \r")
  propio=${propio:-prod}

  # Sin argumento ni comando SSH se actualiza el ambiente de esta carpeta.
  # "actualizar" es lo que mandaban los workflows antes de que hubiera ambientes: producción.
  local pedido=${1:-${SSH_ORIGINAL_COMMAND:-$propio}}
  case "$pedido" in
    prod | actualizar) pedido=prod ;;
    qa) ;;
    *)
      echo "Ambiente desconocido: '$pedido'. Usa prod o qa." >&2
      exit 2
      ;;
  esac

  # Si se pidió otro ambiente, se corre el script de la carpeta de ese ambiente (al lado de esta).
  if [ "$pedido" != "$propio" ]; then
    local carpeta
    if [ "$pedido" = prod ]; then carpeta="$(dirname "$PWD")/formsis-v2"; else carpeta="$(dirname "$PWD")/formsis-v2-$pedido"; fi
    if [ -n "${FORMSIS_DESVIADO:-}" ] || [ ! -x "$carpeta/deploy/actualizar.sh" ]; then
      echo "El ambiente $pedido no está instalado en $carpeta (o su .env no dice AMBIENTE=$pedido). Ver docs/ambientes.md." >&2
      exit 1
    fi
    FORMSIS_DESVIADO=1 exec "$carpeta/deploy/actualizar.sh" "$pedido"
  fi

  # Un deploy a la vez en el servidor, venga del repo que venga: compilar dos ambientes juntos
  # no entra en memoria. Si hay otro corriendo, este espera.
  exec 9>"${TMPDIR:-/tmp}/formsis-deploy.lock"
  if ! flock -n 9; then
    echo "Hay otro deploy en curso; esperando a que termine..."
    flock 9
  fi

  local rama archivo proyecto
  if [ "$pedido" = prod ]; then
    rama=main archivo=docker-compose.prod.yml proyecto=formsis
  else
    rama=$pedido archivo=docker-compose.ambiente.yml proyecto=formsis-$pedido
  fi
  compose() { docker compose -p "$proyecto" -f "$archivo" "$@"; }
  echo "== Actualizando $pedido (rama $rama) en $PWD"

  local caddyfile_antes
  caddyfile_antes=$(sha256sum deploy/Caddyfile)
  git fetch --quiet origin "$rama"
  # Deja los submódulos en el commit fijado antes del merge (QA los mueve, ver abajo).
  git submodule update --init --recursive --quiet
  git merge --ff-only "origin/$rama"
  git submodule update --init --recursive

  if [ "$pedido" = prod ]; then
    # Producción usa exactamente los commits de main fijados en el submódulo (lo probado en QA).
    actualizar_sitio
  else
    # QA sigue la punta de la rama del mismo nombre en cada submódulo (api, face), para
    # probar cambios del backend sin mover el puntero en este repo. Si el submódulo no tiene esa
    # rama, queda en el commit fijado.
    local sub
    for sub in $(git config --file .gitmodules --get-regexp '\.path$' | awk '{print $2}'); do
      if git -C "$sub" fetch --quiet origin "$rama" 2>/dev/null; then
        git -C "$sub" checkout --quiet --detach FETCH_HEAD
        echo "$sub: rama $rama ($(git -C "$sub" rev-parse --short HEAD))"
      else
        echo "$sub: sin rama $rama, queda en el commit fijado ($(git -C "$sub" rev-parse --short HEAD))"
      fi
    done
    if ! docker network inspect formsis-borde >/dev/null 2>&1; then
      echo "Falta la red formsis-borde, que crea producción: actualiza producción primero." >&2
      exit 1
    fi
  fi

  compose up -d --build --remove-orphans
  # Caddy (solo en producción) lee el Caddyfile solo al arrancar, y git reemplaza el archivo en vez
  # de editarlo, así que el contenedor seguiría viendo el viejo: si cambió, se reinicia (un par de segundos).
  if [ "$pedido" = prod ] && [ "$(sha256sum deploy/Caddyfile)" != "$caddyfile_antes" ]; then
    compose restart caddy
  fi
  # Borra las imágenes viejas que dejó la reconstrucción para no llenar el disco.
  docker image prune -f >/dev/null
  compose ps
}

# Sitio de presentación (repo aparte), clonado al lado de este. Si falla no frena el deploy de la app.
actualizar_sitio() {
  local sitio=../formsis-web
  if [ -d "$sitio/.git" ]; then
    { git -C "$sitio" fetch --quiet origin main && git -C "$sitio" merge --quiet --ff-only origin/main; } \
      || echo "Aviso: no se pudo actualizar el sitio en $sitio" >&2
  else
    git clone --quiet https://github.com/gabrielventodev/formsis-web.git "$sitio" \
      || echo "Aviso: no se pudo clonar el sitio en $sitio" >&2
  fi
  # Que la carpeta exista y sea del usuario: si no, Docker la crearía como root al montarla
  # y el próximo clone fallaría.
  mkdir -p "$sitio"
}

principal "$@"
exit
