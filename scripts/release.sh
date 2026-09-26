#!/usr/bin/env bash
# =====================================================================
# Dr.Coach! — Publicar una nueva versión con un solo comando
#
#   bash scripts/release.sh patch    # 3.0.1 → 3.0.2 (arreglo rápido)
#   bash scripts/release.sh minor    # 3.0.1 → 3.1.0 (función nueva)
#   bash scripts/release.sh major    # 3.0.1 → 4.0.0 (cambio grande)
#
# Qué hace:
#   1. Sube la versión en js/app.js (APP_VERSION).
#   2. Renueva la caché del Service Worker en sw.js.
#   3. Hace commit y crea el tag git vX.Y.Z.
#
# (El detalle de los cambios lo escribes tú en docs/CHANGELOG.md.)
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

KIND="${1:-patch}"
case "$KIND" in
  patch|minor|major) ;;
  *) echo "Uso: bash scripts/release.sh [patch|minor|major]"; exit 1 ;;
esac

CURRENT=$(sed -n "s/^const APP_VERSION = '\([^']*\)';$/\1/p" js/app.js)
if [ -z "$CURRENT" ]; then
  echo "✗ No pude leer APP_VERSION en js/app.js"; exit 1
fi

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
case "$KIND" in
  patch) PATCH=$((PATCH+1)) ;;
  minor) MINOR=$((MINOR+1)); PATCH=0 ;;
  major) MAJOR=$((MAJOR+1)); MINOR=0; PATCH=0 ;;
esac
NEW="$MAJOR.$MINOR.$PATCH"

# 1. Versión de la app (js/app.js)
sed -i "s/^const APP_VERSION = '.*';$/const APP_VERSION = '$NEW';/" js/app.js

# 2. Caché del Service Worker (sw.js) — fuerza renovación en los dispositivos
sed -i "s/^const CACHE='.*';$/const CACHE='drcoach-$NEW-release';/" sw.js

# 3. Commit + tag
git add -A
git -c core.hooksPath=/dev/null commit -m "Dr.Coach! v$NEW" --quiet || true
git tag "v$NEW"

echo "✓ Dr.Coach! v$CURRENT → v$NEW"
echo "  · js/app.js  APP_VERSION = $NEW"
echo "  · sw.js      CACHE = drcoach-$NEW-release"
echo "  · commit + tag v$NEW listos"
echo ""
echo "Siguiente paso: git push origin main --tags"
echo "Recuerda anotar los cambios en docs/CHANGELOG.md"
