#!/bin/zsh
cd "$(dirname "$0")"
clear
echo "Dr.Coach! — iniciando servidor local seguro para Focus Radio…"
if command -v python3 >/dev/null 2>&1; then
  exec python3 serve.py
else
  echo "No se encontró Python 3 en este Mac."
  echo "Instálalo o publica Dr.Coach! como sitio HTTPS."
  read -k 1 "?Pulsa cualquier tecla para cerrar…"
fi
