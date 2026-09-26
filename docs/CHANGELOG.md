# Dr.Coach! — Registro de cambios

## v3.0.4 · Endurecimiento del motor de sync (además de lo arreglado en v3.0.3)

> Si después de v3.0.3 el indicador volvía a mostrar "⚠ Error de sync" de vez en cuando (o al abrir la app), esta versión elimina las causas restantes. Verificado contra el esquema real de Supabase: las 48 columnas que la app usa coinciden una a una y las filas de ejemplo pasan la validación — el problema restante estaba en la GESTIÓN de fallos del motor, no en la base de datos.

### Corregido
- **Peticiones con el token caducado tras dormir el dispositivo**: el motor disparaba pull/push con el JWT viejo antes de que supabase-js lo renovara → 401 → "⚠ Error de sync". Ahora **cada pull y push renueva la sesión primero** si falta menos de 60 s para su expiración.
- **Un solo fallo del pull al arrancar dejaba "⚠ Error de sync" pegado toda la sesión**: el reintento solo existía para subidas. Ahora el pull **se reintenta solo (2 veces, 4 s)** y el temporizador de 45 s **vuelve a descargar cada ~2 min** — la etiqueta de error se recupera sola y el progreso guardado en el OTRO dispositivo llega sin recargar la app.
- **"Sesión expirada" ya no se disfraza de "⚠ Sin conexión"**: los fallos de autenticación (JWT caducado, refresh token inválido) tienen su propio estado con color rojo y mensaje accionable, tanto en el indicador como en la fila "Estado" de la vista Datos.
- **El estado de error y su causa ya no son un secreto**: al pasar el ratón por el indicador se ve el mensaje real de Supabase, y la fila "Estado" del panel Cloud Sync muestra el detalle (truncado) en lugar de un "Conectado" plano.
- Subir preferencias sin usuario activo ahora da un mensaje claro en vez de un error críptico de RLS.

### Añadido
- **Fila "Versión de la app"** en el panel Cloud Sync (Datos): confirma de un vistazo que AMBOS dispositivos corren la misma versión — un dispositivo viejo (≤3.0.2) sigue mandando campos que la nube rechaza.
- **Diagnóstico más útil**: la comprobación de "Sesión" muestra la validez restante del token y, si ya caducó, intenta renovarlo ahí mismo y reporta el resultado.

## v3.0.3 · Reparación de Cloud Sync

> Corrige el **"⚠ Error de sync"** que impedía guardar el progreso en la nube y hacer que apareciera en el otro dispositivo. Los datos locales NUNCA estuvieron en riesgo: el fallo era solo al subir.

### Corregido
- **Las subidas fallaban con columnas inexistentes** ("Could not find the 'updatedAt' column"). El sanitizador de `cloud/sync.js` era una lista negra y dejaba escapar el campo camelCase `updatedAt` que la app añade a cada intento editado (y a todo registro descargado y vuelto a subir): Supabase rechazaba la fila y el indicador quedaba en "⚠ Error de sync". Ahora es una **lista blanca**: se construye la fila solo con las columnas que existen en cada tabla de `supabase/schema.sql`, así que ningún campo legacy o futuro puede colarse de nuevo.
- **Los registros que fallaron 3 veces quedaban aparcados para siempre** (dead-letter) — el motivo del "se queda buggeado". Ahora se reincorporan solos a la cola cada vez que abres la app y, además, hay un botón **"♻ Reintentar registros en error"** en la vista Datos.
- **El pull incremental comparaba el reloj de tu dispositivo con el del servidor** (`.gt('updated_at', hora_local)`): con el reloj adelantado unos minutos, los datos recién subidos desde el otro dispositivo se saltaban en silencio — la causa del "en mi otra cuenta no aparece mi progreso". Ahora el pull es siempre completo (barato para 2 usuarios) y **nunca sobrescribe filas con cambios locales pendientes** en la cola.
- **Las preferencias no se subían si la fila de perfil no existía** (cuentas creadas antes de que el trigger existiera): el `UPDATE` afectaba a 0 filas en silencio. Ahora es `UPSERT` y la fila de perfil se auto-crea en la primera subida.
- El diagnóstico ahora distingue **"⚠ Sin conexión"** (no hay internet) de **"⚠ Error de sync"** (Supabase rechazó algo), también en los pulls.

### Añadido
- **🩺 Ejecutar diagnóstico** (vista Datos): comprueba en un clic la configuración, la sesión, el acceso a las tablas con RLS, la existencia de la fila de perfil y el estado de la cola y de los registros en error — sin abrir la consola.
- **Fila "Registros en error"** en el panel de Cloud Sync de la vista Datos, con contador en vivo.

### Cambiado
- **`supabase/schema.sql` reescrito a prueba de balas**: idempotente (seguro para re-ejecutar), con `ADD COLUMN IF NOT EXISTS` para completar instalaciones a medias, y las dos sentencias que pueden chocar con permisos del proyecto (trigger sobre `auth.users` y alta del bucket) envueltas en `DO … EXCEPTION` para que **un fallo parcial no aborte el resto del script**. Incluye backfill de perfiles para usuarios ya existentes y una consulta de verificación al final.

## Sin publicar (herramientas y docs — la app no cambia)

### Añadido
- **`docs/README.md`**: índice de toda la documentación ("¿cómo hago X?" → guía), visible al navegar la carpeta docs/ en GitHub.
- **`docs/ESTRUCTURA.md`** ampliado: diagrama del ritual de publicación (check → release → push → Pages), entradas nuevas en el mapa (instalar en dispositivos, copia de seguridad) y pasos de check.sh integrados en el ritual manual.
- **`scripts/check.sh` §9**: valida que los enlaces relativos del README y de docs/*.md apunten a archivos que existen (15 comprobados ahora; un renombre que rompa una guía se detecta antes de publicar).
- **`docs/INSTALAR-APP.md`**: guía para instalar Dr.Coach! como aplicación (PWA) en iPad/iPhone (Safari), Android (Chrome), Mac y Windows (Chrome/Edge) — pasos, cómo se actualiza una instalada, dónde viven los datos por dispositivo y tabla de problemas frecuentes.
- **Tarjeta social del repo** (`docs/img/social-preview.png`, 1280×640): imagen de marca con logo, funciones y captura real de la app, lista para subir en Settings → Social preview (pasos en `docs/GITHUB-PAGES.md` § 6).
- **`.github/`**: plantillas de issues (bug e idea) y de pull request, en español y adaptadas a la app (piden el chip de versión, la vista afectada, errores de consola y el estado de la base de datos; recuerdan exportar el progreso antes de tocar nada y no pegar credenciales).
- **`scripts/backup.sh`**: copia de seguridad en un comando — ZIP del proyecto tal cual está (incluye tu `config/supabase.config.js`: es copia local, no subirla a GitHub) + bundle del historial git completo (restaurable con `git clone archivo.bundle`). Conserva las 8 más recientes. `bash scripts/backup.sh [carpeta]`.
- **Capturas del proyecto** en `docs/img/` (escritorio, móvil y acceso) mostradas en el README con texto alternativo descriptivo.
- **`scripts/check.sh`**: chequeo pre-publicación en un comando — estructura crítica, secretos fuera de git, consistencia de versiones (APP_VERSION ↔ CACHE del SW ↔ insignia del README), rutas rotas en `index.html` **y `404.html`**, estado de git, permisos, **recursos offline** (las 10 URLs que cachea el Service Worker y los iconos del manifest existen en disco) y **PWA instalable** (campos mínimos del manifest e iconos 192/512). `bash scripts/check.sh` antes de cada push.
- **`docs/BD-MANTENIMIENTO.md`**: runbook de base de datos — mapa de la IndexedDB local (`mediospira-db`), cómo inspeccionarla con DevTools, tabla síntoma → causa → arreglo, backups export/import y ritual para corregir bugs de datos locales y de nube.
- **`docs/GITHUB-ACTIONS-PAGES.md`**: guía OPCIONAL para deploy automático con GitHub Actions (workflow YAML listo para copiar; por defecto se sigue usando "Deploy from a branch").

### Mejorado
- **`404.html`** pulida: animación de entrada, logo flotante, barra de progreso del cuenta atrás, foco visible para teclado, flecha animada en el botón, nota de tranquilidad ("tu progreso está a salvo") y respeto a `prefers-reduced-motion`.
- **`scripts/release.sh`** más seguro y multiplataforma: rechaza publicar con cambios sin confirmar (con instrucciones), rechaza tags duplicados, verifica que el bump realmente se aplicó (y revierte si falla) y solo sube `js/app.js`/`sw.js` (+README si cambia la insignia) al commit de release. **Corrige un bug de compatibilidad**: ya no usa `sed -i` (fallaba en macOS/BSD); edita vía archivo temporal, así que funciona igual en Mac y Linux. Además actualiza automáticamente la insignia de versión del README.
- **README.md** renovado: insignias de versión/PWA, sección de capturas, `backup.sh` y `.github/` en el árbol de estructura, y fila de backup en la tabla de mantenimiento.

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
