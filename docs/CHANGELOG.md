# Dr.Coach! — Registro de cambios

## Sin publicar (herramientas y docs — la app no cambia)

### Añadido
- **`scripts/check.sh`**: chequeo pre-publicación en un comando — estructura crítica, secretos fuera de git, consistencia de versiones (APP_VERSION ↔ CACHE del SW), rutas rotas en `index.html`, estado de git y permisos. `bash scripts/check.sh` antes de cada push.
- **`docs/BD-MANTENIMIENTO.md`**: runbook de base de datos — mapa de la IndexedDB local (`mediospira-db`), cómo inspeccionarla con DevTools, tabla síntoma → causa → arreglo, backups export/import y ritual para corregir bugs de datos locales y de nube.
- **`docs/GITHUB-ACTIONS-PAGES.md`**: guía OPCIONAL para deploy automático con GitHub Actions (workflow YAML listo para copiar; por defecto se sigue usando "Deploy from a branch").

### Mejorado
- **`404.html`** pulida: animación de entrada, logo flotante, barra de progreso del cuenta atrás, foco visible para teclado, flecha animada en el botón, nota de tranquilidad ("tu progreso está a salvo") y respeto a `prefers-reduced-motion`.
- **`scripts/release.sh`** más seguro: rechaza publicar con cambios sin confirmar (con instrucciones), rechaza tags duplicados, verifica que el bump realmente se aplicó (y revierte si falla) y solo sube `js/app.js`/`sw.js` al commit de release.

## v3.0.2 · Fiabilidad de la nube + página 404

### Corregido
- **Service Worker ya no cachea respuestas de APIs externas** (Supabase REST/Auth/Storage, Piped/Invidious, Jina). Antes, cualquier GET exitoso se guardaba en caché y podía devolverse luego: los *pulls* de Cloud Sync podían traer datos obsoletos al sincronizar entre dispositivos y las búsquedas de música podían servir resultados viejos. Ahora el SW solo atiende peticiones de la propia app; las APIs van siempre a la red frescas. (El cache de búsquedas de música que describe el README es el de `localStorage`, gestionado por la app — no cambia.)

### Añadido
- **`404.html`** con la marca Dr.Coach!: GitHub Pages la muestra automáticamente en rutas inexistentes y redirige al inicio en 5 s (también con botón directo). Soporta modo claro/oscuro.
- **Diagrama de arquitectura** (Mermaid) en `docs/ESTRUCTURA.md`: se ve el flujo `index.html → js/ → IndexedDB` y el espejo opcional `cloud/ → Supabase`.

## v3.0.1 · Reorganización del proyecto (mantenimiento)

Cambios **solo de estructura**; la app funciona exactamente igual (mismo IndexedDB, mismo progreso, misma nube).

- Archivos agrupados por carpeta para facilitar el mantenimiento:
  - `css/` → estilos (`styles.css`)
  - `js/` → lógica (`db.js` base de datos local, `app.js` app, `zip.js` backups)
  - `assets/img/` y `assets/icons/` → logo, emblema e iconos PWA
  - `config/` → credenciales Supabase (`supabase.config.js` NO se sube a GitHub)
  - `supabase/` → SQL de la base de datos en la nube (`schema.sql`)
  - `companions/` → extensión de navegador y userscript móvil
  - `scripts/` → servidor local (`serve.py`) y launcher de macOS
  - `docs/` → guías (CHANGELOG, INSTALL-CLOUD, DISTRIBUCION, ESTRUCTURA)
- `index.html`, `manifest.webmanifest` y `sw.js` siguen en la raíz (requisito del Service Worker).
- Rutas actualizadas en `index.html`, `sw.js`, `manifest.webmanifest` y `cloud/auth.js`.
- Caché del Service Worker renovada: `drcoach-v3.0.1-reorg` (haz una recarga forzada tras desplegar).
- Nuevo `docs/ESTRUCTURA.md` con el mapa "¿dónde toco qué?".
- Sin cambios en base de datos, schema SQL ni comportamiento.

## v3.0.0 · Cloud Sync

## Resumen

v3.0.0 introduce **Local-first + Cloud Sync** sin sacrificar el modo offline.

- **Auth con Supabase** (2 usuarios, sin registro público). Login en el mismo HTML.
- **Sincronización**: Pull al abrir · Push al guardar (pregunta/sesión/board/edit/review) · Background cada 45 s si hay cambios pendientes.
- **Indicador visual** de estado: ☁ Guardado · ☁ Sincronizando… · ☁ N cambios pendientes · ⚠ Sin conexión · 💾 Solo local.
- **Supabase Storage** para capturas del Study Board con path `study-evidence/{user_id}/{attempt_id}/{image_id}.webp`.
- **Backup/Restore** preservado; al importar, los datos también se empujan a la nube.
- **Multi-dispositivo**: Lenovo Pad → iPad → PC mantienen el mismo progreso cuando se inicia sesión con la misma cuenta.
- **Preferencias locales**: Radio · Música · Volumen · Estado del reproductor no se sincronizan (son del dispositivo).

## Restricciones respetadas

- ✅ Medicospira no se modificó.
- ✅ Tampermonkey / Companion no se tocaron.
- ✅ Copy/paste en QBank sigue igual.
- ✅ Sistema de preguntas y UI v2.6.7 intactos.
- ✅ Funciona 100 % offline; sin config de Supabase, abre en modo local.
- ✅ IndexedDB sigue siendo la fuente de verdad local; Cloud es secundario.

## Arquitectura

```
                Dr.Coach!
                    |
       ---------------------------
       |                         |
   IndexedDB                  Supabase
    LOCAL                      CLOUD
       |                         |
       -------- Sincronización -----

  auth.js  ──── Login overlay ──── Supabase Auth (2 usuarios)
  sync.js  ──── Pull/Push/Background ──── Supabase Postgres
  storage.js ── Upload/download ──── Supabase Storage
  sync-indicator.js ─── Visual feedback en #saveState
  supabase-client.js ── Carga dinámica + fallback offline
```

## Instalación

Ver **`INSTALL-CLOUD.md`** para el setup completo de Supabase (schema SQL + 2 usuarios + bucket).

## Migración desde v2.6.7

La actualización es automática:

1. Sustituye los archivos de la versión anterior en tu hosting (GitHub Pages, servidor local, etc.).
2. Copia `config/supabase.config.example.js` → `config/supabase.config.js` y rellena URL + anon key.
3. Ejecuta `supabase/schema.sql` en tu proyecto de Supabase.
4. Crea los 2 usuarios en Dashboard → Authentication → Users.
5. Recarga Dr.Coach!. Verás el overlay de login. El progreso local existente se mantiene.

Sin config de Supabase, Dr.Coach! sigue funcionando en modo local como en v2.6.7.
