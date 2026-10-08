#!/usr/bin/env bash
# Prepara una VM Ubuntu/Debian recién creada para correr Formsis:
# instala Docker con Compose, agrega 2 GB de swap (la compilación de Next.js y OpenCV
# lo agradece en máquinas de 4 GB) y deja al usuario actual usar docker sin sudo.
#
#   curl -fsSL https://raw.githubusercontent.com/gabrielventodev/formsis-v2/main/deploy/preparar-servidor.sh | bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Instalando Docker"
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"

if ! swapon --show | grep -q /swapfile; then
  echo "==> Creando 2 GB de swap"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

sudo apt-get install -y -qq git openssl >/dev/null

echo
echo "Listo. Cierra la sesión SSH y vuelve a entrar para usar docker sin sudo."
