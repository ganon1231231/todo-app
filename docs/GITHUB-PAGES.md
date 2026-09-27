# Publicar Dr.Coach! en GitHub Pages — paso a paso

Guía completa para tener tu web funcionando en `https://TU-USUARIO.github.io` en ~5 minutos, y para actualizarla después sin miedo.

---

## 1. Subir el proyecto a tu repositorio

### Caso A — El repo ya existe y ahí vive tu web actual

Desde la carpeta `drcoach/`:

```bash
# la primera vez (conecta tu repo local con el de GitHub)
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main --tags
```

> Si el repo remoto ya tiene archivos (tu web anterior), GitHub podría rechazar el push. En ese caso usa `git push -u origin main --force` **una sola vez** para que esta versión organizada sustituya a la anterior (tu progreso de estudio NO vive en GitHub, vive en el navegador de cada dispositivo — no se pierde nada).

### Caso B — Repo nuevo desde cero

1. Crea el repo en <https://github.com/new> (nombre, p. ej. `drcoach`).
2. `git remote add origin https://github.com/TU-USUARIO/drcoach.git`
3. `git push -u origin main --tags`

---

## 2. Activar GitHub Pages

**Configuración actual de este repo — Deploy from a branch (recomendado):**

1. En tu repo: **Settings → Pages** (menú lateral izquierdo).
2. **Source**: **Deploy from a branch** · **Branch**: `main` + carpeta **`/ (root)`**.
3. Listo. **Cada `git push` a `main` reconstruye el sitio solo en 1-2 minutos** — no hay que configurar nada más nunca.

**Alternativa — GitHub Actions (solo si algún día cambias Source a «GitHub Actions»):**

Se usaba un workflow (`.github/workflows/deploy-pages.yml`) que publicaba la raíz del repo; fue retirado del repo porque el despliegue por rama no lo necesita y exigía permiso extra de Workflows para pushear. Si cambias a Actions, vuelve a añadirlo siguiendo la documentación oficial de `actions/deploy-pages`.

Espera 1–2 minutos. Aparecerá arriba: *"Your site is live at https://TU-USUARIO.github.io/TU-REPO/"*.

---

## 3. Verificar que todo quedó bien

Abre la URL que te dio GitHub y comprueba:

- [ ] La app carga con el logo Dr.Coach! y pide inicio de sesión (o entra en modo local).
- [ ] Pasa el gate → se ve el Panel de estudio.
- [ ] En la esquina superior derecha aparece el indicador de estado (☁ / 💾).
- [ ] **Recarga forzada una vez** (Ctrl+Shift+R / Cmd+Shift+R) para que el Service Worker cachee esta versión.
- [ ] (Extra) Activa el modo avión y recarga: la app debe seguir abriendo — eso es el modo offline.

---

## 4. Actualizar la web en el futuro

1. Edita lo que necesites en su carpeta (`css/`, `js/`, `docs/`, …).
2. Si es un cambio de versión completo: `bash scripts/release.sh patch` (o `minor`/`major`).
3. Sube:

```bash
git add .
git commit -m "v3.x.y: resumen del cambio"
git push
```

4. Espera ~1 min al deploy automático.
5. En tus dispositivos: **una recarga normal basta** — el Service Worker renueva la caché él solo y borra la vieja (desde v3.0.2). Si algún día dudas: recarga forzada.

> El progreso guardado (IndexedDB) nunca se pierde al actualizar: el nombre de la base no cambia entre versiones.

---

## 5. Dominio personalizado (opcional)

1. Compra el dominio (Namecheap, Cloudflare, etc.).
2. En tu proveedor de DNS crea un registro `CNAME` que apunte a `TU-USUARIO.github.io`.
3. En el repo: **Settings → Pages → Custom domain**, escribe tu dominio y guarda.
4. Marca **Enforce HTTPS** cuando se active el certificado.

---

## 6. Tarjeta social del repo (opcional, 1 minuto)

Cuando compartas el enlace de tu repo (WhatsApp, X, LinkedIn…), GitHub muestra una tarjeta de vista previa. Puedes poner una personalizada con la marca Dr.Coach! — ya está generada en **`docs/img/social-preview.png`** (1280×640):

1. En tu repo: **Settings → General** (pestaña General, baja hasta **Social preview**).
2. Pulsa **Edit → Upload a new image** y elige `docs/img/social-preview.png`.
3. Guarda. A partir de ahora, todo enlace a tu repo lleva la tarjeta con el logo, las funciones y una captura real de la app.

> Esta imagen vive en el repo (docs/img/) pero GitHub la usa solo como tarjeta social; no forma parte de la web ni la descarga el Service Worker.

---

## 7. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `404` al abrir la URL del sitio | El deploy aún no termina (espera 1–2 min) o el repo es privado (Pages requiere repo público o plan Pro). |
| La página carga "fea", sin estilos | Alguien movió `css/styles.css`; revísalo en `docs/ESTRUCTURA.md` § arquitectura. |
| La app no se actualiza en la tablet | Recarga forzada una vez. El SW viejo queda reemplazado por el nuevo caché. |
| El login de Supabase falla solo en la web publicada | Revisa `config/supabase.config.js` (no se sube a GitHub). En el dispositivo, la app funciona igual en modo local; para la nube sigue `docs/INSTALL-CLOUD.md`. |
| Cambié el repo pero no veo cambios | GitHub Pages tarda ~1 min; refresca con Ctrl+Shift+R. |
