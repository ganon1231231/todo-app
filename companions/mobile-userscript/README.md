# Dr.Coach! Mobile Companion v0.3

**Multi-gestor**: Tampermonkey/Violentmonkey (Android, Edge, PC/Mac) · **Safari iOS/iPadOS** con las apps «Userscripts» o «Stay» · Tampermonkey dentro del navegador Orion.

## Qué hace
- Permite seleccionar y copiar texto dentro de Medicospira (barrita flotante «Copiar / → Stem»).
- `→ Stem` envía la selección al campo Caso clínico de Dr.Coach!.
- Traduce Medicospira **en el mismo iframe** y **reemplaza** el inglés por español (no modo bilingüe).
- El botón `Español / Original` del Workspace controla este userscript.
- Mantiene traducción en páginas dinámicas del QBank.

## Instalación

### iPad (Safari) — app «Userscripts» (gratis, recomendada)
1. App Store → instalar **«Userscripts»** (Justin Wasack).
2. Abrir la app una vez y elegir la carpeta de scripts (iCloud Drive o «En mi iPad»).
3. Ajustes → Safari → Extensiones → **Userscripts**: activar y dar permiso **«Todos los sitios web» → Permitir** (o al menos `ganon1231231.github.io` y `usmle.medicospira.com`).
4. Descargar el script: abrir en Safari https://ganon1231231.github.io/todo-app/companions/mobile-userscript/DrCoach-Mobile-Companion.user.js → se guarda en Descargas → moverlo a la carpeta «Userscripts» (Archivos: mantener pulsado → Mover).
5. Abrir la app Userscripts → ↻ para sincronizar → interruptor del script en verde.
6. Recargar Dr.Coach! → Workspace → botón **Español**. Listo.

### iPad (Safari) — alternativa «Stay»
Instalar Stay (App Store), activarla en Extensiones y usar su importador por URL con el mismo enlace de arriba (es compatible con la sintaxis de Tampermonkey).

### iPad — alternativa «Orion» (Tampermonkey real)
Instalar **Orion Browser** (Kagi) desde el App Store → dentro de Orion, abrir la Chrome Web Store → añadir **Tampermonkey** → instalar el script desde el enlace de arriba. Experiencia idéntica al escritorio.

### Android / Lenovo (Edge) — Tampermonkey
1. Desactiva/elimina el userscript de Immersive Translate para evitar traducciones duplicadas.
2. Tampermonkey → crear/importar script → instala `DrCoach-Mobile-Companion.user.js` (o pega la URL de arriba en la pestaña «Utilidades» → Importar).
3. Recarga Dr.Coach! y Workspace.
4. Pulsa `Español` en la cabecera del Workspace.

## Actualizaciones automáticas
El script declara `@updateURL`/`@downloadURL` apuntando al sitio publicado: Tampermonkey y Stay comprueban actualizaciones solas con cada release (la versión va en la cabecera).

## Privacidad / red
La traducción automática móvil usa Google Translate como motor primario y Bing como fallback mediante endpoints web sin clave. El texto a traducir se envía a esos servicios. No lo uses para texto con datos clínicos identificables de pacientes reales.
