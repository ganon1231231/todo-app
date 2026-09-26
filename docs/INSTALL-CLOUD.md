# Dr.Coach! Cloud Sync — Instalación en Supabase

Esta guía describe cómo configurar Supabase para habilitar Cloud Sync en Dr.Coach! v3.0.1.
Tiempo estimado: **10 minutos**.

---

## 1. Crear un proyecto en Supabase

1. Entra a <https://supabase.com> y crea un nuevo proyecto.
2. Anota la **URL** del proyecto (`https://xxxxx.supabase.co`) y la **anon/publishable key** (no la service_role).
3. El plan free es suficiente para 2 usuarios y el volumen típico de Dr.Coach!.

---

## 2. Crear el schema de la base de datos

1. Entra al **SQL Editor** del proyecto (Dashboard → SQL → New query).
2. Copia y pega **todo** el contenido de `supabase/schema.sql` (incluido en este paquete).
3. Ejecuta. El script crea:
   - Tablas: `profiles`, `attempts`, `sessions`, `canvas_objects`, `sync_state`.
   - **Row-Level Security** en todas las tablas: cada usuario solo puede leer/escribir sus propias filas.
   - Un trigger que crea automáticamente una fila en `profiles` cuando se registra un nuevo usuario.
   - El bucket **`study-evidence`** en Storage (privado) con RLS para que cada usuario solo vea su carpeta `study-evidence/{user_id}/...`.

---

## 3. Crear los 2 usuarios permitidos

1. Ve a **Dashboard → Authentication → Users → Add user**.
2. Crea los dos usuarios (email + contraseña). No marques "auto-confirm" si quieres verificar los correos; si los marcaste, ya pueden entrar directamente.
3. Anota los correos; los usarás para iniciar sesión en Dr.Coach!.

> **Registro público deshabilitado**: por defecto, Supabase Auth no permite registro anónimo desde el cliente sin invitar. NO habilites "Enable email signup" en Authentication → Settings si quieres forzar a que solo los usuarios que tú crees puedan entrar.

---

## 4. Configurar Dr.Coach!

1. Copia `config/supabase.config.example.js` → `config/supabase.config.js` (junto al ejemplo).
2. Edita el nuevo archivo y reemplaza los placeholders:

```js
window.DRCOACH_SUPABASE_CONFIG = {
  url: 'https://TU-PROYECTO.supabase.co',
  anonKey: 'TU-ANON-KEY',
  userHints: [
    { email: 'usuario1@tudominio.com', label: 'Usuario 1' },
    { email: 'usuario2@tudominio.com', label: 'Usuario 2' }
  ]
};
```

> ⚠️ NUNCA uses la **service_role** key. Esa es para servidores. Dr.Coach! solo expone la anon key desde el frontend, y la seguridad la garantizan las políticas RLS del schema.

3. Guarda el archivo. Súbelo al mismo servidor donde sirves `index.html`.

---

## 5. Verificación

1. Recarga Dr.Coach!. Deberías ver un overlay de login con dos pestañas: **Iniciar sesión** y **Solo local**.
2. Entra con `usuario1@…` y la contraseña. Verás el chip del usuario en la barra superior y el indicador `☁ Guardado` en la esquina.
3. Resuelve una pregunta. El indicador pasará brevemente a `☁ Sincronizando…` y luego a `☁ Guardado`.
4. Cierra sesión (clic en el chip del usuario → Cerrar sesión) y entra como `usuario2@…`. No deberías ver el progreso del usuario 1 (RLS lo impide).
5. Entra de nuevo como usuario 1 desde otro dispositivo (PC, iPad, Lenovo Pad). Verás el mismo progreso tras unos segundos de Pull.

---

## 6. Modo local (sin Supabase)

Si `supabase.config.js` no existe o contiene los placeholders `YOUR-PROJECT` / `YOUR-PUBLISHABLE-ANON-KEY`, la app arranca automáticamente en **modo local** (idéntico a v2.6.7):
- No aparece overlay de login (o aparece con la pestaña "Solo local" como default).
- El indicador muestra `💾 Solo local`.
- Todo sigue funcionando con IndexedDB, Service Worker y offline.

Esto es lo que permite distribuir el mismo ZIP a un colega que aún no configura Supabase: la app nunca falla por falta de config.

---

## 7. Backup manual

 Aunque exista nube, sigue habiendo Export / Import en la vista **Datos**:
- **Exportar datos** → `drcoach-data-AAAA-MM-DD.json` (sin capturas).
- **Exportar completo** → `drcoach-full-AAAA-MM-DD.zip` (con capturas).
- **Importar** → MERGE o REPLACE local, y (si hay sesión cloud) empuja a la nube.

Recomendado: 1 backup completo al mes + 1 export de datos semanal.

---

## 8. Estructura del cloud

```
supabase/
  schema.sql                    # Ejecuta esto en Supabase SQL editor
config/
  supabase.config.example.js    # Plantilla — copia y renombra
  supabase.config.js            # Tu config real (NO subir a un repo público)
cloud/
  supabase-client.js            # Carga dinámica del SDK + fallback offline
  auth.js                       # Overlay de login (2 usuarios + Solo local)
  sync.js                       # Pull/Push/Background, cola IndexedDB
  storage.js                    # Upload/download imagenes a Supabase Storage
  sync-indicator.js             # Widget visual en #saveState
```

---

## 9. Resolución de problemas

- **"No se pudo iniciar sesión: NetworkError"** → revisa conexión; si el problema persiste, prueba con otro navegador. La pestaña **Solo local** te permite seguir trabajando.
- **"El correo no ha sido confirmado"** → entra a Supabase Dashboard → Authentication → Users → clic en el usuario → **Confirm user** o reenvía el email de confirmación.
- **"permission denied" / RLS** → revisa que ejecutaste `schema.sql` completo, incluyendo las sentencias `create policy`.
- **El indicador se queda en "N cambios pendientes"** → abre DevTools → Console. Si hay errores 401/403, las credenciales están mal; si hay 404, la URL del proyecto está mal; si hay CORS, asegúrate de que la URL no termina en `/`.
- **Las imágenes no se ven en otro dispositivo** → las URLs firmadas expiran en 7 días; al abrir el board, Dr.Coach! descarga y cachea localmente. Si una imagen antigua no carga, el botón "Sincronizar ahora" (en Datos → Cloud) refresca todo.

---

## 10. Seguridad

- ✅ Solo se usa la **anon key** en el frontend. La service_role solo se usa si tú implementas webhooks o funciones server-side (no incluidas en este paquete).
- ✅ Row-Level Security está habilitada en todas las tablas. Cada usuario solo ve y modifica sus filas.
- ✅ Storage con RLS path-based: `study-evidence/{user_id}/...`. Un usuario no puede leer las imágenes de otro.
- ✅ Sesión persistida por Supabase JS en `localStorage` con clave `drcoach.supabase.auth`. Logout la limpia.
- ✅ El JWT se refresca automáticamente mientras la pestaña esté abierta.

Para revocar acceso a un usuario: Dashboard → Authentication → Users → Delete. Sus datos quedan en su dispositivo; en la nube, las cascadas `on delete cascade` borran todo.
