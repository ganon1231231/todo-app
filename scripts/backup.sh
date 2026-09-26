#!/usr/bin/env bash
# =====================================================================
# Dr.Coach! — Copia de seguridad del proyecto (código + historial git)
#
#   bash scripts/backup.sh              # guarda en ~/drcoach-backups
#   bash scripts/backup.sh /ruta/carpeta
#
# Qué crea (con fecha y hora en el nombre):
#   1. drcoach-codigo-<fecha>.zip       ← el proyecto TAL CUAL está ahora.
#      ⚠ Incluye tu config/supabase.config.js (credenciales): es una
#        copia PARA TI. No la subas a GitHub ni la compartas.
#   2. drcoach-historial-<fecha>.bundle ← todo el historial git.
#      Se restaura con:  git clone <archivo.bundle> mi-carpeta
#
# Conserva las 8 copias más recientes de cada tipo y borra las viejas.
#
# NOTA: tu PROGRESO de estudio (preguntas, sesiones) vive en el navegador
# (IndexedDB), no en este repo. Ese se respalda desde la app:
# vista Datos → Exportar. Guía completa: docs/BD-MANTENIMIENTO.md
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

DEST="${1:-$HOME/drcoach-backups}"
KEEP=8
STAMP=$(date +%Y%m%d-%H%M)

if [ ! -d .git ]; then
  echo "✗ Esto no es un repositorio git (falta .git): no puedo crear el bundle de historial."
  echo "  Aún puedes copiar la carpeta a mano si lo necesitas."
  exit 1
fi

mkdir -p "$DEST"

# ── 1. ZIP del código actual (incluye tu config real: solo para ti) ──
CODE=""
if command -v zip >/dev/null 2>&1; then
  CODE="$DEST/drcoach-codigo-$STAMP.zip"
  zip -qr "$CODE" . -x "*.git/*" -x "*/.git/*" -x ".git" -x "*/.git"
else
  # macOS y Linux traen tar; zip puede faltar en Linux minimal
  CODE="$DEST/drcoach-codigo-$STAMP.tar.gz"
  tar --exclude=.git -czf "$CODE" .
fi

# ── 2. Bundle del historial git (todo: commits, tags, ramas) ──
BUNDLE="$DEST/drcoach-historial-$STAMP.bundle"
git bundle create "$BUNDLE" --all --quiet

# ── 3. Poda: conservar las KEEP más recientes de cada tipo ──
OLD=$(ls -t "$DEST"/drcoach-codigo-* 2>/dev/null | tail -n +$((KEEP + 1)) || true)
if [ -n "$OLD" ]; then printf '%s\n' "$OLD" | while IFS= read -r f; do rm -f -- "$f"; done; fi
OLD=$(ls -t "$DEST"/drcoach-historial-* 2>/dev/null | tail -n +$((KEEP + 1)) || true)
if [ -n "$OLD" ]; then printf '%s\n' "$OLD" | while IFS= read -r f; do rm -f -- "$f"; done; fi

# ── Resumen ──
SIZE_CODE=$(du -h "$CODE" | cut -f1 | tr -d ' ')
SIZE_BUN=$(du -h "$BUNDLE" | cut -f1 | tr -d ' ')
echo "✓ Backup completado en: $DEST"
echo "  · Código actual   → $(basename "$CODE") ($SIZE_CODE)"
echo "    $(git ls-files | wc -l | tr -d ' ') archivos rastreados · commit $(git rev-parse --short HEAD)"
echo "  · Historial git   → $(basename "$BUNDLE") ($SIZE_BUN)"
echo ""
echo "Restaurar el código:  descomprime el .zip en una carpeta nueva"
echo "Restaurar historial:  git clone \"$(basename "$BUNDLE")\" drcoach-restaurado"
echo ""
echo "⚠ Recuerda: el progreso de estudio se respalda desde la APP (Datos → Exportar)."
