#!/usr/bin/env bash
# =====================================================================
# Dr.Coach! — Chequeo pre-publicación (antes de git push)
#
#   bash scripts/check.sh
#
# Verifica, sin tocar nada:
#   1. Estructura: los archivos críticos existen.
#   2. Secretos: config/supabase.config.js NO está dentro de git.
#   3. Versiones: APP_VERSION (js/app.js) coincide con CACHE (sw.js)
#      y con la insignia del README.
#   4. Rutas: los href/src locales de index.html apuntan a archivos reales.
#   5. Git: hay repo, sin cambios sin confirmar, tag de la versión actual.
#   6. Permisos: scripts con bit de ejecución.
#
# Código de salida 0 = todo listo para publicar.
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0; FAIL=0; WARN=0
ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
bad()  { echo "  ✗ $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠ $1"; WARN=$((WARN+1)); }

echo "Dr.Coach! — chequeo pre-publicación"
echo "──────────────────────────────────────────────"

# 1. Estructura crítica
echo "1) Estructura"
CRITICAL=(
  index.html sw.js manifest.webmanifest 404.html .nojekyll
  css/styles.css js/db.js js/app.js js/zip.js
  cloud/supabase-client.js cloud/auth.js cloud/storage.js cloud/sync.js cloud/sync-indicator.js
  config/supabase.config.example.js supabase/schema.sql
  scripts/serve.py scripts/check.sh scripts/release.sh scripts/backup.sh
  docs/ESTRUCTURA.md docs/CHANGELOG.md
)
for f in "${CRITICAL[@]}"; do
  [ -f "$f" ] && ok "$f" || bad "falta $f"
done

# 2. Secretos fuera de git
echo "2) Secretos"
if [ -f config/supabase.config.js ]; then
  if git ls-files --error-unmatch config/supabase.config.js >/dev/null 2>&1; then
    bad "config/supabase.config.js está DENTRO de git (¡no lo publiques!)"
  else
    ok "config/supabase.config.js con tus credenciales NO viaja en git"
  fi
else
  warn "config/supabase.config.js no existe en este equipo (solo modo local)"
fi
git ls-files | grep -q "supabase.config.js$" && bad "git sigue un supabase.config.js" || ok "git no rastrea ningún supabase.config.js real"

# 3. Consistencia de versiones (app ↔ sw)
echo "3) Versiones"
APP_V=$(sed -n "s/^const APP_VERSION = '\([^']*\)';$/\1/p" js/app.js || true)
SW_V=$(sed -n "s/^const CACHE='drcoach-\(.*\)-release';$/\1/p" sw.js || true)
if [ -n "$APP_V" ] && [ "$APP_V" = "$SW_V" ]; then
  ok "APP_VERSION (app.js) = CACHE (sw.js) = $APP_V"
elif [ -n "$APP_V" ] && [ -z "$SW_V" ]; then
  bad "No pude leer CACHE en sw.js (¿formato 'drcoach-x.y.z-release'?)"
elif [ -z "$APP_V" ]; then
  bad "No pude leer APP_VERSION en js/app.js"
else
  bad "DESCUADRE: app.js=$APP_V vs sw.js=$SW_V — usa scripts/release.sh, no ediciones manuales"
fi

# 3b. Insignia de versión del README (aviso, no bloquea)
if [ -f README.md ] && grep -q "versi%C3%B3n-v[0-9.]*-1f4f9a" README.md; then
  README_V=$(grep -oE "versi%C3%B3n-v[0-9.]+-1f4f9a" README.md | head -1 | sed -E "s/versi%C3%B3n-v([0-9.]+)-1f4f9a/\1/")
  if [ -n "$APP_V" ] && [ "$README_V" = "$APP_V" ]; then
    ok "insignia del README = v$README_V"
  else
    warn "insignia del README (v$README_V) ≠ versión de la app (v$APP_V) — release.sh la actualiza al publicar"
  fi
fi

# 4. Rutas locales de index.html apuntan a archivos reales
echo "4) Rutas de index.html"
BROKEN=0
while IFS=':' read -r attr path; do
  [ -f "$path" ] || { bad "index.html referencia '$path' y NO existe"; BROKEN=1; }
done < <(grep -oE '(src|href)="\./[^"#?]+"' index.html | sed -E 's/(src|href)="\.\///; s/"$//')
[ "$BROKEN" = "0" ] && ok "todas las rutas ./locales existen"

# 5. Estado de git
echo "5) Git"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  ok "repositorio git inicializado"
  if [ -n "$(git status --porcelain)" ]; then
    warn "hay cambios sin confirmar (git status) — haz commit antes de publicar"
  else
    ok "árbol limpio (todo confirmado)"
  fi
  if git remote get-url origin >/dev/null 2>&1; then
    ok "remote origin: $(git remote get-url origin)"
  else
    warn "sin remote origin — configúralo para poder hacer push"
  fi
  if [ -n "$APP_V" ] && git rev-parse -q --verify "refs/tags/v$APP_V" >/dev/null; then
    ok "tag v$APP_V existe para la versión actual"
  elif [ -n "$APP_V" ]; then
    warn "la versión $APP_V aún no tiene tag (usa scripts/release.sh la próxima vez)"
  fi
else
  bad "no es un repositorio git — inicialízalo antes de publicar"
fi

# 6. Permisos de ejecución
echo "6) Permisos"
for s in scripts/release.sh scripts/check.sh scripts/backup.sh scripts/serve.py "scripts/Abrir DrCoach.command"; do
  if [ -f "$s" ] && [ -x "$s" ]; then ok "$s ejecutable"
  elif [ -f "$s" ]; then warn "$s sin permiso de ejecución (chmod +x \"$s\")"
  fi
done

echo "──────────────────────────────────────────────"
echo "Resultado: $PASS ok · $WARN avisos · $FAIL fallos"
if [ "$FAIL" -gt 0 ]; then
  echo "✗ Corrige los fallos antes de publicar."
  exit 1
fi
echo "✓ Listo para publicar (los avisos son opcionales)."
