# Dr.Coach! v3.0.1

Workspace de estudio **local-first**: QBank tracking, Review, Study Board de evidencias, AI Study Dossier y Focus Radio. Funciona 100 % offline y, opcionalmente, sincroniza con **Supabase** (Cloud Sync multi-dispositivo).

Es una web estática: **no necesita instalación, build ni dependencias**. Se abre `index.html` y listo.

---

## 🗂 Estructura del proyecto

Cada carpeta tiene un único propósito, para que el mantenimiento sea simple:

```
drcoach/
├── index.html            ← ENTRADA: la única página (Interfaz y estructura HTML)
├── manifest.webmanifest  ← Configuración de la app instalable (PWA)
├── sw.js                 ← Service Worker: cachea archivos para modo offline
│
├── css/
│   └── styles.css        ← 🎨 TODO el estilo (colores, temas, layout, responsive)
│
├── js/
│   ├── db.js             ← 🗄 Base de datos LOCAL (IndexedDB: intentos, sesiones, ajustes…)
│   ├── app.js            ← ⚙️ Lógica principal de la app (QBank, Review, Study Board, Radio…)
│   └── zip.js            ← Utilidad para generar backups ZIP
│
├── cloud/                ← ☁️ Integración con Supabase (Cloud Sync)
│   ├── supabase-client.js   Carga del SDK + fallback offline
│   ├── auth.js              Overlay de login (2 usuarios + "Solo local")
│   ├── sync.js              Pull/Push de datos, cola de sincronización
│   ├── storage.js           Subida/bajada de capturas (imágenes)
│   └── sync-indicator.js    Indicador "☁ Guardado / 💾 Solo local"
│
├── config/
│   ├── supabase.config.example.js  ← Plantilla de credenciales (SÍ se sube a GitHub)
│   └── supabase.config.js          ← Tus credenciales reales (NO se sube: .gitignore)
│
├── supabase/
│   └── schema.sql        ← 🗄 Base de datos en la NUBE (tablas + seguridad RLS)
│
├── assets/
│   ├── img/              ← Logo y emblema
│   └── icons/            ← Iconos de la app instalable (192/512)
│
├── companions/           ← Extras que NO forman parte de la web
│   ├── browser-extension/   Extensión de Chrome (DrCoach-Companion)
│   └── mobile-userscript/   Script Tampermonkey para móvil
│
├── scripts/
│   ├── serve.py          ← Servidor local (python3 scripts/serve.py)
│   └── Abrir DrCoach.command  ← Doble clic en macOS para abrir la app
│
└── docs/
    ├── ESTRUCTURA.md     ← 📖 Mapa "¿dónde toco qué?" — EMPIEZA AQUÍ
    ├── CHANGELOG.md      ← Historial de versiones
    ├── INSTALL-CLOUD.md  ← Guía de configuración de Supabase paso a paso
    └── DISTRIBUCION.md   ← Notas históricas de distribución (v2.6.7)
```

> **¿Por qué `index.html`, `sw.js` y `manifest.webmanifest` van sueltos en la raíz?**
> El Service Worker solo puede controlar la carpeta donde vive (*scope*). En la raíz cubre toda la app. No los muevas.

---

## 🚀 Cómo abrirla

**Opción A — Local (macOS):** doble clic en `scripts/Abrir DrCoach.command`.
**Opción B — Local (cualquier sistema):** `python3 scripts/serve.py` → abre `http://localhost:8080`.
**Opción C — GitHub Pages:** es la forma recomendada (HTTPS necesario para Focus Radio).

> ⚠️ No abras `index.html` con doble clic como archivo (`file://`): el Service Worker y Focus Radio requieren HTTP/HTTPS.

---

## 🌐 Publicar / actualizar en GitHub Pages

1. Sube/reemplaza el contenido de esta carpeta en tu repositorio (manteniendo las carpetas tal cual).
2. Espera a que GitHub Pages termine el deploy.
3. **Recarga forzada una vez** (Ctrl+Shift+R / Cmd+Shift+R) para que el Service Worker tome la nueva versión.

Con git, desde esta carpeta:

```bash
git init                  # solo la primera vez
git add .
git commit -m "Dr.Coach! v3.0.1"
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main   # (o master, según tu repo)
```

Para futuras actualizaciones: cambia los archivos → `git add .` → `git commit -m "..."` → `git push`.

> 🔒 `config/supabase.config.js` (tus credenciales) está en `.gitignore` y **nunca se sube**. Si tu repo es público y alguien lo clona, crea su propio config a partir de la plantilla.

---

## 🧰 Mantenimiento rápido

| Quiero… | Voy a… |
|---|---|
| Cambiar colores / estilos | `css/styles.css` |
| Corregir un bug de la app | `js/app.js` |
| Arreglar la base de datos local | `js/db.js` (stores de IndexedDB) |
| Arreglar la base de datos de la nube | `supabase/schema.sql` + `cloud/sync.js` |
| Cambiar credenciales de Supabase | `config/supabase.config.js` |
| Cambiar la interfaz (HTML) | `index.html` |
| Actualizar logo / iconos | `assets/img/` y `assets/icons/` |
| Publicar una nueva versión | Ver `docs/ESTRUCTURA.md` § "Publicar una nueva versión" |

Guía completa: **`docs/ESTRUCTURA.md`** · Historial: **`docs/CHANGELOG.md`** · Nube: **`docs/INSTALL-CLOUD.md`**

---

## ☁️ Cloud Sync (opcional)

Sin configurar nada, la app funciona en **modo local** (todo en tu navegador). Para sincronizar entre dispositivos (PC, iPad, Lenovo Pad) con los mismos datos: sigue **`docs/INSTALL-CLOUD.md`** (≈10 minutos: schema SQL + 2 usuarios + config).
