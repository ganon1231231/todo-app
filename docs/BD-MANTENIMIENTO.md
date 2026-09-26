# Mantenimiento de la base de datos (Dr.Coach!)

Guía práctica para diagnosticar y corregir problemas de datos **sin romper nada**.
Complemento de `docs/ESTRUCTURA.md` (mapa general) — aquí solo se habla de DATOS.

---

## 1. Dónde viven tus datos

Dr.Coach! tiene **dos capas de datos independientes**:

| Capa | Dónde | Qué guarda | Se publica en git? |
|---|---|---|---|
| **Local (siempre)** | IndexedDB `mediospira-db` (v2), dentro de tu navegador | Todo el progreso: intentos, sesiones, ajustes, capturas, baselines | **No** — vive solo en tu dispositivo |
| **Nube (opcional)** | Supabase (tabla `public.*`, ver `supabase/schema.sql`) | Espejo de esos datos, por usuario, para multi-dispositivo | Solo `schema.sql` (la estructura), nunca tus datos |

Regla de oro: **la base local es la fuente de verdad**; la nube es una copia sincronizada.

---

## 2. Mapa de la base local (IndexedDB `mediospira-db`)

Definida en `js/db.js` (constantes `DB_NAME`, `DB_VERSION = 2`):

| Store | Guarda | Clave | Índices |
|---|---|---|---|
| `attempts` | Cada intento de pregunta (correcto/incorrecto/omitido, confianza, tiempo) | `id` | sessionId, questionId, createdAt, subject, system |
| `sessions` | Bloques de estudio (estado: active/complete, materia, conteos) | `id` | status, startedAt |
| `settings` | Ajustes clave-valor (meta diaria, fecha de examen, `lastBackupAt`, `schemaVersion`, modo de tema…) | `key` | — |
| `attachments` | Capturas de imágenes (blobs) vinculadas a preguntas | `id` | — |
| `baselines` | Resultados de evaluación inicial por materia | `id` | subject |
| `pending_syncs` | Cola de cambios esperando subirse a Supabase (solo modo nube) | `id` | — |

> ¿Por qué "v2"? La v1 (2.6.7) no tenía `pending_syncs`; la v3.0.0 subió `DB_VERSION` a 2 y creó ese store. La migración es automática en `onupgradeneeded`.

---

## 3. Cómo inspeccionar la base (DevTools)

**Chrome / Edge (escritorio):**
1. Abre Dr.Coach! → F12 → pestaña **Application**
2. Panel izquierdo: **Storage → IndexedDB → mediospira-db**
3. Clic en un store (p.ej. `attempts`) → verás los registros; botón derecho permite borrar claves
4. En **Storage → IndexedDB** también puedes borrar TODA la base (último recurso: borra tu progreso local)

**Safari (macOS):** Desarrollar → Show Web Inspector → Storage → IndexedDB.
**Móvil:** sin inspector fácil — usa los botones de la vista **Datos** (exportar) para examinar el contenido.

Atajos desde consola (F12 → Console):

```js
// Conteo por store
for (const s of ['attempts','sessions','settings','attachments','baselines','pending_syncs']) {
  indexedDB.open('mediospira-db').onsuccess = e => {
    const db = e.target.result;
    db.transaction(s).objectStore(s).count().onsuccess = c => console.log(s, c.target.result);
  };
}
```

---

## 4. Síntoma → causa → arreglo

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| La app queda en "Guardado local" pero los cambios no aparecen en otro dispositivo | `pending_syncs` con cola atascada (falló la subida) | Espera a tener red; la cola se reintentará. Si persiste: F12 → Console busca avisos de `[DrCoachCloud]`; los datos NO se pierden |
| "Base local ✓ IndexedDB" no aparece en Datos | `js/db.js` no cargó o IndexedDB bloqueada | Cierra otras pestañas de Dr.Coach! (solo puede haber una conexión escritora a la vez); recarga |
| La app pide modo otra vez o se comporta rara tras actualizar | Caché vieja del Service Worker | Una recarga normal basta (v3.0.2+ renueva sola); si no, F12 → Application → Storage → Clear site data |
| Cuota llena / capturas fallan | `attachments` creció (límite ~60 MB de capturas) | Vista Datos → exporta backup completo → borra capturas antiguas desde la pregunta correspondiente |
| Datos "a medio hacer" tras un fallo de corriente/cierre | Escritura interrumpida | Vista Datos → **Importar** el último backup JSON/ZIP |
| Cambié algo en `schema.sql` pero la nube no cambia | El schema de Supabase no se aplica solo | Pega el SQL en Supabase → SQL Editor → Run (ver `docs/INSTALL-CLOUD.md`) |
| Quiero empezar de cero (¡borra TODO!) | — | F12 → Application → IndexedDB → borrar `mediospira-db` + Accept: se pierde el progreso local |

---

## 5. Backups: la red de seguridad (úselo SEMANAL)

Vista **Datos**:
- **Exportar JSON** → `drcoach-data-<fecha>.json` (datos sin capturas; rápido)
- **Exportar ZIP** → `drcoach-full-<fecha>.zip` (datos + capturas + `manifest.json` con versión/schema)
- La app recuerda el último backup (`settings.lastBackupAt`; si dice "Nunca ⚠️" es tu señal)

**Importar** (restaurar): Datos → Importar → elige el JSON/ZIP → la app muestra una vista previa con conteos y fecha → **Confirmar**. No fusiona: reemplaza lo importado de forma controlada.

Recomendación: exporta el ZIP completo antes de **cualquier** actualización de la app o de tocar la base.

---

## 6. Corregir bugs de base de datos (para el desarrollador)

1. **Bug de datos LOCAL** → `js/db.js` (schema/índices/migración) o `js/app.js` (lógica que lee/escribe).
   - Añadir un campo nuevo a los registros: no toques `DB_VERSION` salvo que añadas stores/índices — los objetos JSON aceptan campos nuevos solos.
   - Añadir store o índice nuevo: sube `DB_VERSION` (v2 → v3) y añade el `if(!db.objectStoreNames.contains(...))` correspondiente en `onupgradeneeded`. Migración = solo crear, nunca borrar.
2. **Bug de datos NUBE** → `cloud/sync.js` (qué se sube/baja y cuándo) y `supabase/schema.sql` (estructura + RLS).
   - Cambios de estructura en Supabase: edita `schema.sql`, pégalo en el SQL Editor de Supabase, y sube versión con `scripts/release.sh`.
3. Ritual de cualquier cambio de datos:
   ```bash
   # 1. documenta en docs/CHANGELOG.md
   # 2. confirma tus cambios
   git add -A && git commit -m "..."
   # 3. publica versión (sube APP_VERSION + renueva caché SW + tag)
   bash scripts/release.sh patch
   # 4. chequeo
   bash scripts/check.sh
   ```
4. Nunca edites IndexedDB "a mano" en producción: usa export/import como vía de reparación.

---

## 7. Chequeo rápido de salud

```bash
bash scripts/check.sh     # estructura, secretos, versiones, rutas — antes de publicar
```

Dentro de la app, vista **Datos** → caja "Base local ✓ IndexedDB" muestra: persistencia concedida, uso del navegador, peso de capturas, nº de registros y último backup.
