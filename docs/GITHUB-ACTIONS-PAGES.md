# Deploy automático con GitHub Actions (OPCIONAL)

> **Esto es un extra, no es necesario.** Por defecto el repo está configurado para
> GitHub Pages "Deploy from a branch" (ver `docs/GITHUB-PAGES.md`, caso A/B), que
> funciona sin ninguna acción adicional. Usa esta guía **solo** si quieres que cada
> `git push` construya y publique solo, con registro de despliegue.

---

## ¿Cuándo vale la pena?

| Deploy from branch (actual) | GitHub Actions (esta guía) |
|---|---|
| Cero configuración extra | Requiere crear 1 archivo |
| Publica lo que hay en `main` | Publica lo que hay en `main` |
| Sin registro de errores | Registro completo de cada deploy |
| ~1–2 min | ~1–2 min |
| Recomendado para empezar | Útil si el sitio crece o quieres auditoría |

**No hagas los dos a la vez**: elige un método. Si activas Actions, deja
Settings → Pages → Source en **GitHub Actions**.

---

## Pasos (2 minutos)

1. En tu repo local, crea la carpeta y el archivo:
   ```
   .github/workflows/pages.yml
   ```
2. Pega este contenido exacto (el sitio es estático puro: no necesita build):

   ```yaml
   name: Deploy Dr.Coach! a GitHub Pages

   on:
     push:
       branches: [main]
     workflow_dispatch:

   permissions:
     contents: read
     pages: write
     id-token: write

   concurrency:
     group: pages
     cancel-in-progress: true

   jobs:
     deploy:
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - uses: actions/checkout@v4
         - uses: actions/configure-pages@v5
         - uses: actions/upload-pages-artifact@v3
           with:
             path: .          # la raíz del repo ES el sitio (index.html, sw.js, …)
         - id: deployment
           uses: actions/deploy-pages@v4
   ```

3. Commit y push:
   ```bash
   git add .github && git commit -m "Añade deploy automático de Pages" && git push
   ```
4. Ve a **Settings → Pages → Build and deployment → Source** y cámbialo a
   **GitHub Actions** (si estaba en "Deploy from a branch").
5. En la pestaña **Actions** verás el workflow correr (~1 min). Al terminar,
   tu URL de Pages queda publicada.

---

## Verificación

- Pestaña **Actions** del repo → el último run debe estar verde ✓
- Abre tu URL de Pages → la app carga
- Prueba offline una vez dentro (el Service Worker sirve todo localmente)

## Problemas frecuentes

| Error en Actions | Causa | Arreglo |
|---|---|---|
| "Pages not enabled" | Source sigue en "Deploy from a branch" | Settings → Pages → Source: GitHub Actions |
| 404 en la URL | El artifact no incluyó la raíz | Revisa `path: .` en el paso de upload |
| El deploy no corre | Falta `permissions` o el workflow está deshabilitado | Revisa el YAML y la pestaña Actions → enable |
| Funciona pero sin estilos | Sirviendo por "branch" y Actions a la vez | Elige UN método y desactiva el otro |

---

## Notas para Dr.Coach!

- **No hay build step**: el sitio ya es estático (vanilla HTML/CSS/JS). Lo único
  que Actions hace es empaquetar la raíz y publicarla.
- El Service Worker (`sw.js`) y `404.html` funcionan igual que con deploy por rama.
- `config/supabase.config.js` está en `.gitignore` — el deploy se hará sin tus
  credenciales y la app correrá en modo local hasta que copies ese archivo a mano
  en el servidor (o mantén la configuración por usuario según `docs/INSTALL-CLOUD.md`).
- Versionas con `bash scripts/release.sh patch|minor|major` y cada push de un tag
  también dispara el deploy (el workflow escucha pushes a `main`).
