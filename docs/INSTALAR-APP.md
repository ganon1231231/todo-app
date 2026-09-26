# 📲 Instalar Dr.Coach! como aplicación

Dr.Coach! es una **PWA**: se instala en tu iPad, móvil, Mac o PC como una app más (icono propio, pantalla completa, sin barra del navegador) y **sigue funcionando sin internet**.

> Requisito: abrirla por **HTTPS** (tu web de GitHub Pages ya vale) o en `localhost`. Si la abres como archivo (`file://`) no se puede instalar ni funciona el modo offline.

---

## iPad / iPhone (Safari)

1. Abre tu web de Dr.Coach! en **Safari** (no en Chrome de iOS: Apple solo permite instalar desde Safari).
2. Pulsa el botón **Compartir** ⬆️ (el cuadradito con la flecha).
3. Baja y elige **"Añadir a pantalla de inicio"**.
4. Ponle el nombre que quieras (p. ej. *Dr.Coach!*) y pulsa **Añadir**.

→ Aparece el icono de Dr.Coach! en tu pantalla de inicio y se abre a pantalla completa.

## Android (Chrome)

1. Abre tu web en **Chrome**.
2. Menú **⋮** (arriba a la derecha) → **"Instalar aplicación"** (o "Añadir a pantalla de inicio").
3. Confirma. Chrome te preguntará si la quieres en la pantalla de inicio.

→ También puedes crear un acceso directo desde el propio Chrome si prefieres no instalarla.

## Mac (Chrome o Edge)

1. Abre tu web en **Chrome** o **Edge**.
2. Pulsa el **icono de instalación** que aparece en la barra de direcciones (a la derecha: un monitor con una flecha ↓, o el símbolo ⊕).
3. Confirma **Instalar**.

→ Dr.Coach! se abre en su propia ventana, con icono en el Dock/Launchpad.
*(Safari de Mac no instala PWAs: usa Chrome/Edge, o simplemente mantenla como pestaña fija.)*

## Windows (Chrome o Edge)

1. Abre tu web en **Chrome** o **Edge**.
2. Menú **⋮ / …** → **"Instalar Dr.Coach!"** (o el icono de instalación de la barra de direcciones).
3. Confirma. Puedes anclarla a la barra de tareas o al menú Inicio.

---

## 🔄 Cómo se actualiza la app instalada

Cuando publiques una versión nueva (`scripts/release.sh` + `git push`), en cada dispositivo basta con **abrir la app y una recarga normal**: el Service Worker renueva la caché él solo (desde v3.0.2) y borra la vieja. No hace falta desinstalar ni reinstalar nada.

## 💾 ¿Dónde viven mis datos en cada dispositivo?

- Cada dispositivo tiene **su propia base local** (IndexedDB del navegador). Instalar la app no copia datos: son independientes.
- **Mismo progreso en todos tus dispositivos** → configura Cloud Sync: `docs/INSTALL-CLOUD.md`.
- **Pasar datos de un dispositivo a otro una sola vez** → exporta JSON en el dispositivo viejo (vista **Datos → Exportar**) e importa en el nuevo: `docs/BD-MANTENIMIENTO.md`.
- Si desinstalas la app, el navegador puede borrar su base local: **exporta un respaldo antes** (vista Datos → Exportar).

## ❓ Si algo falla al instalar

| Síntoma | Causa y solución |
|---|---|
| No aparece "Instalar aplicación" | Estás en `file://` o HTTP. Abre la web publicada (HTTPS de GitHub Pages). |
| En iPhone no me deja | Debe ser **Safari**, no Chrome/Firefox (limitación de Apple). |
| La instalada no se actualiza | Abre la app y haz **una** recarga normal; si dudas, recarga forzada. |
| Se instaló pero sin icono propio | Borra el acceso directo, verifica que la web publicada tenga `manifest.webmanifest` y vuelve a instalar (`scripts/check.sh` lo comprueba). |
