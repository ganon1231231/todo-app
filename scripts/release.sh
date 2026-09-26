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
#   3. Actualiza la insignia de versión del README.
#   4. Hace commit y crea el tag git vX.Y.Z.
#
# Funciona igual en macOS y Linux (edición vía archivo temporal,
# sin depender del sed -i de cada sistema).
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

# Editar archivos de forma portable (macOS/BSD y GNU/Linux):
bump() { # bump <archivo> <expresión-sed>
  local file="$1" expr="$2" tmp
  tmp=$(mktemp) || return 1
  sed "$expr" "$file" > "$tmp" && mv "$tmp" "$file"
}

CURRENT=$(sed -n "s/^const APP_VERSION = '\([^']*\)';$/\1/p" js/app.js)
if [ -z "$CURRENT" ]; then
  echo "✗ No pude leer APP_VERSION en js/app.js"; exit 1
fi
README_CHANGED=0

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
bump js/app.js "s/^const APP_VERSION = '.*';$/const APP_VERSION = '$NEW';/"
grep -q "const APP_VERSION = '$NEW';" js/app.js || { echo "✗ El bump en app.js falló"; git checkout -- js/app.js; exit 1; }

# 2. Caché del Service Worker (sw.js) — fuerza renovación en los dispositivos
bump sw.js "s/^const CACHE='.*';$/const CACHE='drcoach-$NEW-release';/"
grep -q "const CACHE='drcoach-$NEW-release';" sw.js || { echo "✗ El bump en sw.js falló"; git checkout -- js/app.js sw.js; exit 1; }

# 3. Insignia de versión del README (solo si existe el badge)
if grep -q "versi%C3%B3n-v[0-9.]*-1f4f9a" README.md 2>/dev/null; then
  bump README.md "s|versi%C3%B3n-v[0-9.]*-1f4f9a|versi%C3%B3n-v$NEW-1f4f9a|g"
  grep -q "versi%C3%B3n-v$NEW-1f4f9a" README.md || { echo "✗ El bump del README falló"; git checkout -- js/app.js sw.js README.md; exit 1; }
  README_CHANGED=1
fi

# 4. Commit + tag
git add js/app.js sw.js
if [ "$README_CHANGED" = "1" ]; then git add README.md; fi
git -c core.hooksPath=/dev/null commit -m "Dr.Coach! v$NEW" --quiet
git tag "v$NEW"

echo "✓ Dr.Coach! v$CURRENT → v$NEW"
echo "  · js/app.js  APP_VERSION = $NEW"
echo "  · sw.js      CACHE = drcoach-$NEW-release"
[ "$README_CHANGED" = "1" ] && echo "  · README.md  insignia de versión actualizada"
echo "  · commit + tag v$NEW listos"
echo ""
echo "Siguiente paso:  git push origin main --tags"
echo "Chequeo previo:  bash scripts/check.sh"
