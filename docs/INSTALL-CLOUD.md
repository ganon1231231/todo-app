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

### 🩺 Primero: el botón "Ejecutar diagnóstico" (v3.0.3)

Antes de tocar nada a mano: entra a **Datos → Cloud Sync → 🩺 Ejecutar diagnóstico**. Recorre en un clic toda la cadena (config → sesión → tablas → perfil → cola) y te dice exactamente qué eslabón falla. Con el resultado en la mano, usa esta tabla:

| Qué muestra el indicador / diagnóstico | Qué significa | Arreglo |
|---|---|---|
| ☁ Guardado | Todo subido y sincronizado | Nada que hacer ✅ |
| ☁ N cambios pendientes | Hay cambios locales esperando subida | Con conexión se suben solos (45 s). Puedes forzar con "⬆ Subir todo a la nube" |
| ⚠ Sin conexión | No hay internet (o Supabase no responde) | Revisa tu red; al volver, se reintenta solo |
| ⚠ Error de sync | Supabase rechazó algo (schema/permisos/datos) | Pasa el ratón por el indicador: desde v3.0.4 el tooltip muestra el mensaje real. Mira también el log de la vista Datos |
| ⚠ Sesión expirada (v3.0.4) | El token de sesión caducó y no se pudo renovar | Vuelve a iniciar sesión (cierra sesión en Datos y entra de nuevo). Ya no aparece disfrazado de "Sin conexión" |
| "N registros en error" > 0 | Filas que fallaron 3 veces y quedaron aparcadas | Pulsa **"♻ Reintentar registros en error"** (v3.0.3 las re-subirá con el formato corregido) |
| Cola de subida ✗ con TODO lo demás en ✓ (v3.0.5) | Cambios que no se suben aunque la sesión y las tablas están bien | Mira el **desglose nuevo** de la fila: si "Prueba de escritura" está en ✗ ejecuta `supabase/schema.sql` y usa "⬆ Subir todo"; si está en ✓ y la cola es vieja/duplicada, pulsa **"🧹 Vaciar cola de subida"** (no toca tus datos locales) |
| Prueba de escritura ✗ (v3.0.5) | Tus tablas se LEEN bien pero Supabase RECHAZA las escrituras — tu progreso NO está llegando a la nube | Re-ejecuta `supabase/schema.sql` completo en el SQL Editor (crea las políticas que falten; es seguro) y luego "⬆ Subir todo a la nube" |
| Motor de sync: "operación colgada recuperada" (v3.0.5) | Una petición sin respuesta llegó a congelar el motor | Nada que hacer: el watchdog lo liberó solo y el sync continúa. Si se repite mucho, revisa tu red |
| Perfil: "No existe todavía" | Cuenta creada antes de que el trigger de perfiles existiera | No bloquea nada desde v3.0.3: la fila se crea sola en la próxima subida de preferencias |
| Tabla attempts/sessions: error | El schema no está aplicado o quedó a medias | Re-ejecuta `supabase/schema.sql` completo (es seguro re-ejecutarlo, no toca datos) |
| La fila "Versión de la app" (Datos) difiere entre dispositivos | Un dispositivo sigue con código viejo que la nube rechaza | En el dispositivo viejo: recarga la app (una recarga normal basta desde v3.0.2) y comprueba que la fila muestra la misma versión |

> **Nota v3.0.4:** si el "⚠ Error de sync" aparecía al abrir la app o al volver de dormir el dispositivo, era el token caducado + un pull sin reintento. Ahora la sesión se renueva antes de cada subida/descarga y los fallos transitorios se recuperan solos (2 reintentos + redescarga periódica cada ~2 min). Si aun así persiste, el tooltip del indicador y la fila "Estado" de Datos te dicen el motivo exacto.
>
> **Nota v3.0.5:** toda petición tiene ahora límite de tiempo y un watchdog libera el motor si algo se atasca — la cola ya no puede quedarse "N pendientes" para siempre en silencio. El diagnóstico añade la **Prueba de escritura** (distingue "leer bien pero no poder escribir") y el desglose forense de la cola; y existe el botón **"🧹 Vaciar cola de subida"** para descartar restos viejos sin tocar tus datos locales.

### Otros problemas

- **"No se pudo iniciar sesión: NetworkError"** → revisa conexión; si el problema persiste, prueba con otro navegador. La pestaña **Solo local** te permite seguir trabajando.
- **"El correo no ha sido confirmado"** → entra a Supabase Dashboard → Authentication → Users → clic en el usuario → **Confirm user** o reenvía el email de confirmación.
- **"permission denied" / RLS** → revisa que ejecutaste `schema.sql` completo, incluyendo las sentencias `create policy`.
- **El indicador se queda en "N cambios pendientes"** → abre DevTools → Console. Si hay errores 401/403, las credenciales están mal; si hay 404, la URL del proyecto está mal; si hay CORS, asegúrate de que la URL no termina en `/`.
- **Las imágenes no se ven en otro dispositivo** → las URLs firmadas expiran en 7 días; al abrir el board, Dr.Coach! descarga y cachea localmente. Si una imagen antigua no carga, el botón "Sincronizar ahora" (en Datos → Cloud) refresca todo.
- **El SQL Editor terminó en rojo con "permission denied" citando `auth.users`** → era la limitación habitual del schema antiguo. Con el `schema.sql` de v3.0.3 ese paso ya no puede cortar el script: re-ejecútalo entero y verás solo avisos informativos si algo no aplicó.

---

## 10. Seguridad

- ✅ Solo se usa la **anon key** en el frontend. La service_role solo se usa si tú implementas webhooks o funciones server-side (no incluidas en este paquete).
- ✅ Row-Level Security está habilitada en todas las tablas. Cada usuario solo ve y modifica sus filas.
- ✅ Storage con RLS path-based: `study-evidence/{user_id}/...`. Un usuario no puede leer las imágenes de otro.
- ✅ Sesión persistida por Supabase JS en `localStorage` con clave `drcoach.supabase.auth`. Logout la limpia.
- ✅ El JWT se refresca automáticamente mientras la pestaña esté abierta.

Para revocar acceso a un usuario: Dashboard → Authentication → Users → Delete. Sus datos quedan en su dispositivo; en la nube, las cascadas `on delete cascade` borran todo.
