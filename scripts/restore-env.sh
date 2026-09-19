#!/usr/bin/env bash
# Deja el entorno de datos listo en una máquina limpia, con un solo comando.
#
# En un clon nuevo, MinIO arranca vacío y la base no tiene las imágenes del
# Proyecto 1, así que la etapa `analyze` falla cerrado (necesita los bytes
# reales para el pHash de duplicados — ver pipeline/README.md). Este script
# baja el bundle de datos del release v1.0.0 desde GitHub Releases y delega en
# el restore.sh que viene dentro, que es el que sube los objetos a MinIO, carga
# el dump y verifica los conteos.
#
# El bundle NO vive en git (son ~496 MiB): es un asset del release, y lo que se
# extrae queda bajo .dq-env-bundle/, ignorado por .gitignore.
#
# Uso:  ./scripts/restore-env.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_DIR="$REPO_DIR/.dq-env-bundle"
BUNDLE_ZIP="$REPO_DIR/.dq-env-bundle.zip"
BUNDLE_URL="https://github.com/White-eclipse1/Proyecto-02-dataset-Quality/releases/download/v1.0.0-data/dq-env-bundle-v1.0.0.zip"

if [[ -d "$BUNDLE_DIR/minio" ]]; then
  echo "==> El bundle ya está en .dq-env-bundle/, no se descarga de nuevo"
else
  echo "==> Descargando el bundle de datos (~496 MiB) desde GitHub Releases"
  curl -fL --progress-bar "$BUNDLE_URL" -o "$BUNDLE_ZIP"

  echo "==> Extrayendo"
  # El zip trae todo bajo dq-env-bundle/; se renombra a .dq-env-bundle/ para
  # que caiga bajo la regla de .gitignore y no se pueda colar al repo.
  rm -rf "$REPO_DIR/dq-env-bundle" "$BUNDLE_DIR"
  if command -v unzip >/dev/null 2>&1; then
    unzip -q "$BUNDLE_ZIP" -d "$REPO_DIR"
  else
    # Git Bash no siempre trae unzip, pero el pipeline ya exige Python.
    python -c "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" \
      "$BUNDLE_ZIP" "$REPO_DIR"
  fi
  mv "$REPO_DIR/dq-env-bundle" "$BUNDLE_DIR"
  rm -f "$BUNDLE_ZIP"
fi

echo
exec bash "$BUNDLE_DIR/restore.sh" "$REPO_DIR"
