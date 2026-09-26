# Distribución de Dr.Coach! v2.6.7

La instalación recomendada continúa siendo GitHub Pages / HTTPS.

1. Sustituye los archivos de la versión anterior por los de `drcoach_v2.6.7`.
2. Conserva el mismo dominio para que IndexedDB siga encontrando el progreso local.
3. Haz una recarga forzada una vez para renovar el Service Worker (`drcoach-v2.6.7-studyboard1`).

La búsqueda musical no requiere API key. Necesita Internet para búsquedas nuevas; los resultados ya consultados pueden reutilizarse desde cache local.


## Study Board fullscreen

Esta compilación mantiene IndexedDB/local-first y reemplaza el mini-whiteboard por el Study Board fullscreen. El modelo nuevo se guarda de forma aditiva dentro de cada intento; los registros legacy siguen siendo legibles. Supabase no forma parte todavía de esta fase.

`DrCoach-Portable.html` y `Mediospira-Portable.html` se regeneraron con el mismo Study Board para evitar diferencias entre GitHub Pages y el modo portátil.
