#!/usr/bin/env bash
# =====================================================================
# Dr.Coach! — Publicar una nueva versión con un solo comando
#
#   bash scripts/release.sh patch    # 3.0.2 → 3.0.3 (arreglo rápido)
#   bash scripts/release.sh minor    # 3.0.2 → 3.1.0 (función nueva)
#   bash scripts/release.sh major    # 3.0.2 → 4.0.0 (cambio grande)
#
# Qué hace:
#   0. Comprueba que el árbol esté limpio (tu CHANGELOG ya debe estar
#      confirmado — así la entrada entra en el commit etiquetado).
#   1. Sube la versión en js/app.js (APP_VERSION).
#   2. Renueva la caché del Service Worker en sw.js.
#   3. Hace commit y crea el tag git vX.Y.Z.
#
# (El detalle de los cambios lo escribes tú en docs/CHANGELOG.md ANTES.)
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

KIND="${1:-patch}"
case "$KIND" in
  patch|minor|major) ;;
  *) echo "Uso: bash scripts/release.sh [patch|minor|major]"; exit 1 ;;
esac

# 0. Seguridad: árbol limpio y sin tag duplicado
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ Hay cambios sin confirmar. Antes de publicar:"
  echo "    1. Anota los cambios en docs/CHANGELOG.md"
  echo "    2. git add -A && git commit -m \"…\""
  echo "    3. bash scripts/release.sh $KIND"
  exit 1
fi

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

if git rev-parse -q --verify "refs/tags/v$NEW" >/dev/null; then
  echo "✗ El tag v$NEW ya existe (¿se publicó antes sin actualizar app.js?)."
  echo "  Revisa js/app.js y borra el tag obsoleto si procede: git tag -d v$NEW"
  exit 1
fi

# 1. Versión de la app (js/app.js)
sed -i "s/^const APP_VERSION = '.*';$/const APP_VERSION = '$NEW';/" js/app.js
grep -q "const APP_VERSION = '$NEW';" js/app.js || { echo "✗ El bump en app.js falló"; git checkout -- js/app.js; exit 1; }

# 2. Caché del Service Worker (sw.js) — fuerza renovación en los dispositivos
sed -i "s/^const CACHE='.*';$/const CACHE='drcoach-$NEW-release';/" sw.js
grep -q "const CACHE='drcoach-$NEW-release';" sw.js || { echo "✗ El bump en sw.js falló"; git checkout -- js/app.js sw.js; exit 1; }

# 3. Commit + tag
git add js/app.js sw.js
git -c core.hooksPath=/dev/null commit -m "Dr.Coach! v$NEW" --quiet
git tag "v$NEW"

echo "✓ Dr.Coach! v$CURRENT → v$NEW"
echo "  · js/app.js  APP_VERSION = $NEW"
echo "  · sw.js      CACHE = drcoach-$NEW-release"
echo "  · commit + tag v$NEW listos"
echo ""
echo "Siguiente paso:  git push origin main --tags"
echo "Chequeo previo:  bash scripts/check.sh"
